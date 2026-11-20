/* 工時記錄：本機快取 + 雲端同步核心（不依賴 DOM / React / supabase-js，可在 node 測試）。
 *
 * 本機資料
 *   'worklog.v1'      Record<date, WorkLog>   ← 格式與舊版完全相同（io.js 匯入匯出照用）
 *   'worklog.sync.v1' { v, owner, cursor, skew, lastSyncAt, meta: { [date]: { t, dirty, del } } }
 *       owner  這份快取屬於哪個帳號（null = 尚未登入過的本機資料）
 *       t      這一天最後編輯時間（毫秒，已加上伺服器時差 skew），按日 LWW 比較用
 *       dirty  尚未上傳；del 已刪除（tombstone）
 *       lp     local-priority：第一次登入時這台裝置原有的日子（從沒同步過）。直到成功上傳前，
 *              與雲端不同（含雲端 tombstone、出勤寫入）一律以本機為準，並以比雲端新的時間戳上傳。
 *
 * 遠端介面（remote）：
 *   pull(sinceIso)  -> rows   updated_at > sinceIso，依 updated_at 排序
 *   push(rows)      -> rows   伺服器實際寫入的列（被 LWW 擋下的不會回傳）
 *   fetchDates(ds)  -> rows
 *   row = { date, data, deleted, client_updated_at, updated_at }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorkLogSyncCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DATA_KEY_DEFAULT = 'worklog.v1';
  var SYNC_KEY_DEFAULT = 'worklog.sync.v1';
  var PULL_OVERLAP_MS = 5000; // 重抓游標前 5 秒，避免交易提交順序造成漏抓（重複套用是安全的）
  var PUSH_BATCH = 500;

  // key-order-independent equality (jsonb from the server does not keep key order)
  function canon(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
  }
  function same(a, b) { return canon(a) === canon(b); }

  // ---------- field-level 3-way merge ----------
  // Time fields move together (workMinutes must match the times); every other field is its own unit.
  // A unit changed on only one side takes that side; changed on both sides -> the later edit wins.
  var TIME_UNIT = ['clockIn', 'clockOut', 'breaks', 'workMinutes'];
  function emptyLog(date) { return { date: date, clockIn: '', clockOut: '', breaks: [], workMinutes: 0, isLeave: false, isSpecialLeave: false, isOvertimePay: false, note: '' }; }
  function unitVal(o, u) { var r = {}; u.forEach(function (k) { r[k] = o ? o[k] : undefined; }); return r; }
  function merge3(base, local, remote, localT, remoteT) {
    var keys = {}, out = {};
    [base, local, remote].forEach(function (o) { Object.keys(o || {}).forEach(function (k) { keys[k] = 1; }); });
    var units = [TIME_UNIT].concat(Object.keys(keys).filter(function (k) { return TIME_UNIT.indexOf(k) < 0; }).map(function (k) { return [k]; }));
    units.forEach(function (u) {
      var b = unitVal(base, u), l = unitVal(local, u), r = unitVal(remote, u);
      var lc = !same(l, b), rc = !same(r, b);
      var pick = lc && rc ? (localT > remoteT ? l : r) : lc ? l : r;
      u.forEach(function (k) { if (pick[k] !== undefined) out[k] = pick[k]; });
    });
    return out;
  }

  function createEngine(opts) {
    var storage = opts.storage;
    var clock = opts.now || function () { return Date.now(); };
    var readMap = opts.readMap, writeMap = opts.writeMap; // shim 提供（含損毀保護）
    var onChange = opts.onChange || function () {};
    var onStatus = opts.onStatus || function () {};
    var remote = null, userId = null;
    var running = null, again = false, lastError = null;

    // localStorage keys: default = production ('worklog.v1' / 'worklog.sync.v1'); the beta build passes 'worklog.beta.*'
    var DATA_KEY = opts.dataKey || DATA_KEY_DEFAULT, SYNC_KEY = opts.syncKey || SYNC_KEY_DEFAULT;
    function loadState() {
      var raw = storage.getItem(SYNC_KEY), s = null;
      try { s = raw ? JSON.parse(raw) : null; } catch (e) { s = null; }
      if (!s || typeof s !== 'object' || s.v !== 1) s = { v: 1, owner: null, cursor: null, skew: 0, lastSyncAt: 0, meta: {} };
      if (!s.meta || typeof s.meta !== 'object') s.meta = {};
      return s;
    }
    var st = loadState();
    // v8：上傳會蓋掉／刪掉的雲端版本，先存到 <DATA_KEY>.backup.cloud.<ts>（出現在「本機備份」清單，可下載、還原）
    var cloudBk = {};
    function writeCloudBackup(obj) {
      var key = DATA_KEY + '.backup.cloud.' + clock(), old = null;
      try { old = JSON.parse(storage.getItem(key) || 'null'); } catch (e) { old = null; }
      storage.setItem(key, JSON.stringify(Object.assign(old && typeof old === 'object' ? old : {}, obj))); // 寫不進去（容量）就丟出：不上傳
      return key;
    }
    function flushCloudBackup(out) {
      if (!Object.keys(cloudBk).length) return;
      var key = writeCloudBackup(cloudBk); cloudBk = {};
      if (out.cloudBackups.indexOf(key) < 0) out.cloudBackups.push(key);
    }
    function save() { storage.setItem(SYNC_KEY, JSON.stringify(st)); }
    function serverNow() { return clock() + (st.skew || 0); }
    // 新版本一定比它所依據的上一版新，時鐘偏慢也不會輸給自己剛同步下來的資料
    function stamp(date) { var m = st.meta[date]; return Math.max(Math.round(serverNow()), m ? m.t + 1 : 0); }
    function pendingCount() { var n = 0; for (var d in st.meta) if (st.meta[d].dirty) n++; return n; }
    function status() {
      return { signedIn: !!userId, userId: userId, owner: st.owner, pending: pendingCount(), syncing: !!running,
        lastSyncAt: st.lastSyncAt || 0, lastError: lastError };
    }
    function emit() { onStatus(status()); }

    // ---------- 本機寫入（本機模式與登入模式都一樣，登入時另外排程同步） ----------
    // base = the last server version this device knows for that day (3-way merge reference).
    // A day that never existed here starts from an empty log; legacy data has no base (day-level LWW).
    function baseFor(date, map) {
      var m = st.meta[date];
      if (m) return m.base;
      return date in map ? undefined : emptyLog(date);
    }
    function put(log) {
      var map = readMap();
      var base = baseFor(log.date, map), m0 = st.meta[log.date];
      map[log.date] = log;
      writeMap(map); // quota 錯誤直接丟出，meta 不動
      st.meta[log.date] = { t: stamp(log.date), dirty: true, del: false, base: base, bt: m0 ? m0.bt : -1 };
      if (m0 && m0.lp) st.meta[log.date].lp = true; // still this device's never-synced day
      save(); emit();
    }
    function remove(date) {
      var map = readMap();
      if (!(date in map) && !(st.meta[date] && !st.meta[date].del)) return;
      var base = baseFor(date, map), m0 = st.meta[date];
      delete map[date];
      writeMap(map);
      st.meta[date] = { t: stamp(date), dirty: true, del: true, base: base, bt: m0 ? m0.bt : -1 };
      save(); emit();
    }
    // 匯入等「直接改 worklog.v1」之後呼叫：比對前後，有變的日期標成待上傳
    function noteBulkChange(before, after) {
      var d;
      for (d in after) if (!(d in before) || !same(before[d], after[d])) st.meta[d] = { t: stamp(d), dirty: true, del: false, base: baseFor(d, before), bt: st.meta[d] ? st.meta[d].bt : -1 };
      for (d in before) if (!(d in after)) st.meta[d] = { t: stamp(d), dirty: true, del: true, base: baseFor(d, before), bt: st.meta[d] ? st.meta[d].bt : -1 };
      save(); emit();
    }

    // ---------- 帳號切換 ----------
    // 回傳 { mode: 'migrate'|'resume'|'switch', backupKey }
    function setUser(id, rem) {
      userId = id || null; remote = id ? rem : null; lastError = null;
      if (!id) { emit(); return { mode: 'local' }; }
      var result = { mode: 'resume', backupKey: null };
      cloudBk = {};
      if (st.owner === id) {
        // 同一帳號：照常同步。v8：若有待送出的刪除（例如登出時「取代全部」），送出前先把雲端那幾天備份到本機
        for (var dd in st.meta) if (st.meta[dd].dirty && st.meta[dd].del) { st.preDeleteBackup = true; break; }
      }
      else if (st.owner == null) {
        // 第一次登入：本機現有資料搬上雲端。先備份原始值，再把沒有 meta 的舊資料標成待上傳。
        // 舊資料 t = 0：雲端若已有同一天（別台裝置上傳過），以雲端為準；本機原值留在備份。
        // 在本機模式下新編輯過的日期有真實時間戳，與雲端照 LWW 公平比較。
        // v7：聯集，衝突時本機優先（lp）。本機每一天都標 lp；雲端的版本（含 tombstone）不會蓋掉本機，
        // 本機版以比雲端新的時間戳上傳（見 applyRows 的 lp 分支與上傳被擋時的重送）。只有雲端有的日子照常拉下來。
        // 本機模式下刪掉的日子（從沒上傳過）不帶到雲端：聯集不刪雲端，雲端若有那天就拉下來。
        result.mode = 'migrate';
        var raw = storage.getItem(DATA_KEY);
        if (raw && raw !== '{}') { result.backupKey = DATA_KEY + '.backup.' + clock(); storage.setItem(result.backupKey, raw); }
        var map = readMap(), meta = {};
        for (var d in map) meta[d] = { t: Math.max(st.meta[d] ? st.meta[d].t : 0, stamp(d)), dirty: true, del: false, lp: true };
        st.meta = meta; st.owner = id; st.cursor = null;
      } else {
        // 換了另一個帳號：不合併別人的資料。舊快取備份後清空，再從雲端全部拉下來。
        result.mode = 'switch';
        var raw2 = storage.getItem(DATA_KEY);
        if (raw2 && raw2 !== '{}') { result.backupKey = DATA_KEY + '.backup.' + clock(); storage.setItem(result.backupKey, raw2); }
        writeMap({});
        st = { v: 1, owner: id, cursor: null, skew: st.skew || 0, lastSyncAt: 0, meta: {} };
        onChange();
      }
      save(); emit();
      return result;
    }
    // 登出：快取留在本機（仍標記屬於此帳號），之後可繼續以本機模式使用；
    // clearLocal = true 時清掉快取（若還有未上傳的資料就先備份）。
    function signOut(clearLocal) {
      var backupKey = null;
      if (clearLocal) {
        var raw = storage.getItem(DATA_KEY);
        if (pendingCount() > 0 && raw && raw !== '{}') { backupKey = DATA_KEY + '.backup.' + clock(); storage.setItem(backupKey, raw); }
        writeMap({});
        st = { v: 1, owner: null, cursor: null, skew: st.skew || 0, lastSyncAt: 0, meta: {} };
        save(); onChange();
      }
      userId = null; remote = null; emit();
      return { backupKey: backupKey };
    }

    // ---------- 套用雲端資料（按日 LWW） ----------
    // force：伺服器已判定雲端較新（上傳被 LWW 擋下），不再比時間，直接合併/採用
    function applyRows(rows, report, force, merged, kept) {
      var map = readMap(), changed = false;
      rows.forEach(function (row) {
        var d = row.date, t = Number(row.client_updated_at), m = st.meta[d];
        var remoteVal = row.deleted ? null : row.data;
        // 第一次登入、尚未上傳成功的本機日子：本機優先（雲端不同或是 tombstone 都不採用）
        if (m && m.lp && m.dirty && !m.del && map[d]) {
          if (!row.deleted && same(map[d], row.data)) { st.meta[d] = { t: Math.max(t, m.t), dirty: false, del: false, base: remoteVal, bt: t }; return; }
          st.meta[d] = { t: Math.max(m.t, stamp(d), t + 1), dirty: true, del: false, base: remoteVal, bt: t, lp: true, tries: m.tries || 0 };
          if (!row.deleted && row.data) cloudBk[d] = row.data; // 本機會蓋掉這個雲端版本 → 上傳前先備份（v8）
          if (kept && kept.indexOf(d) < 0) kept.push(d);
          return;
        }
        if (!force && m && !m.dirty && m.t >= t && !row.deleted === !m.del) return; // 已經是這版
        if (m && m.dirty && m.bt != null && t <= m.bt) return; // 這一版（或更舊）早就知道了：本機修改照常等上傳
        if (m && m.dirty) {
          var localVal = m.del ? null : (map[d] || null);
          if (same(localVal, remoteVal)) { st.meta[d] = { t: Math.max(t, m.t), dirty: m.t > t, del: !!row.deleted, base: remoteVal, bt: t }; return; }
          // 兩邊都有內容、且知道共同的上一版 → 逐欄合併（例：離線改備註 + 出勤同步寫時間，兩者都保留）
          if (localVal && remoteVal && m.base) {
            var mergedVal = merge3(m.base, localVal, remoteVal, m.t, t);
            if (same(mergedVal, remoteVal)) { if (report) report.push(d); /* 本機的修改輸給較新的雲端版 → 下面照常採用 */ }
            else {
              map[d] = mergedVal; changed = true;
              st.meta[d] = { t: Math.max(stamp(d), t + 1), dirty: true, del: false, base: remoteVal, bt: t };
              if (merged) merged.push(d);
              return;
            }
          } else if (!force && m.t > t) return; // 無法逐欄合併：按日 LWW，本機較新，等著上傳
          else if (report && !same(localVal, remoteVal)) report.push(d);
        }
        if (row.deleted) { if (d in map) { delete map[d]; changed = true; } }
        else if (!same(map[d], row.data)) { map[d] = row.data; changed = true; }
        st.meta[d] = { t: t, dirty: false, del: !!row.deleted, base: remoteVal, bt: t };
      });
      if (changed) writeMap(map);
      return changed;
    }

    async function syncOnce() {
      var rem = remote, uid = userId;
      var out = { pulled: 0, pushed: 0, rejected: 0, overridden: [], merged: [], keptLocal: [], cloudBackups: [] };
      // 1) pull
      var since = st.cursor ? new Date(Date.parse(st.cursor) - PULL_OVERLAP_MS).toISOString() : null;
      var rows = await rem.pull(since);
      if (userId !== uid) return out; // 同步中途登出/換帳號
      out.pulled = rows.length;
      var changed = applyRows(rows, out.overridden, false, out.merged, out.keptLocal);
      rows.forEach(function (r) { if (!st.cursor || Date.parse(r.updated_at) > Date.parse(st.cursor)) st.cursor = r.updated_at; });
      save();
      if (changed) onChange();
      // 1b) 重新登入後第一次上傳前：要送出的刪除，先把雲端還活著的那幾天備份（v8）
      if (st.preDeleteBackup) {
        var dels = Object.keys(st.meta).filter(function (d) { return st.meta[d].dirty && st.meta[d].del; });
        if (dels.length) {
          var live = await rem.fetchDates(dels);
          if (userId !== uid) return out;
          live.forEach(function (w) { if (!w.deleted && w.data) cloudBk[w.date] = w.data; });
        }
        flushCloudBackup(out);
        delete st.preDeleteBackup; save();
      }
      // 2) push 待上傳
      flushCloudBackup(out); // 第一次登入時本機蓋掉的雲端版本（applyRows 收集）
      var map = readMap(), dates = Object.keys(st.meta).filter(function (d) { return st.meta[d].dirty; });
      for (var i = 0; i < dates.length; i += PUSH_BATCH) {
        var batch = dates.slice(i, i + PUSH_BATCH).map(function (d) {
          var m = st.meta[d];
          return { date: d, data: m.del ? null : (map[d] || null), deleted: !!m.del || !map[d], client_updated_at: m.t };
        });
        flushCloudBackup(out);
        var t0 = clock();
        var written = await rem.push(batch);
        var t1 = clock();
        if (userId !== uid) return out;
        var got = {};
        written.forEach(function (w) {
          got[w.date] = w;
          var m = st.meta[w.date];
          // 只在上傳後沒被再次編輯時才清掉 dirty
          if (m && m.dirty && m.t === batch.find(function (b) { return b.date === w.date; }).client_updated_at) {
            st.meta[w.date] = { t: Number(w.client_updated_at), dirty: false, del: !!w.deleted, base: w.deleted ? null : w.data, bt: Number(w.client_updated_at) };
          }
        });
        // 用伺服器 updated_at 估計時差（取請求中點），讓之後的時間戳貼近伺服器時鐘
        if (written.length) {
          var srv = Date.parse(written[written.length - 1].updated_at);
          if (isFinite(srv)) st.skew = Math.round(srv - (t0 + t1) / 2);
        }
        var rejected = batch.filter(function (b) { return !got[b.date]; }).map(function (b) { return b.date; });
        out.pushed += written.length; out.rejected += rejected.length;
        // 3) 被 LWW 擋下的日期：雲端較新，抓回來覆蓋本機
        if (rejected.length) {
          var winners = await rem.fetchDates(rejected);
          if (userId !== uid) return out;
          // 只採用仍是被擋下那一版的日期（期間又被編輯的留給下一輪）
          var stillSame = winners.filter(function (w) {
            var m = st.meta[w.date], b = batch.find(function (x) { return x.date === w.date; });
            return m && b && m.t === b.client_updated_at;
          });
          // 本機優先的日子被擋（雲端在 pull 之後又被寫入，或時鐘被伺服器壓回）：改用比雲端新的時間戳再送，最多 3 次
          var lpRetry = stillSame.filter(function (w) { var m = st.meta[w.date]; return m && m.lp && (m.tries || 0) < 3; });
          lpRetry.forEach(function (w) { st.meta[w.date].tries = (st.meta[w.date].tries || 0) + 1; });
          if (lpRetry.length) { applyRows(lpRetry, null, false, null, out.keptLocal); again = true; }
          var rest = stillSame.filter(function (w) { return lpRetry.indexOf(w) < 0 && !(st.meta[w.date] && st.meta[w.date].lp); });
          if (applyRows(rest, out.overridden, true, out.merged)) onChange();
        }
        save();
      }
      st.lastSyncAt = clock();
      save();
      return out;
    }

    // 合併並行的同步請求：執行中再被叫一次，結束後再跑一輪
    function sync() {
      if (!userId || !remote) return Promise.resolve(null);
      if (running) { again = true; return running; }
      for (var d0 in st.meta) if (st.meta[d0].tries) st.meta[d0].tries = 0; // lp 重送次數每次 sync() 重算（防無限迴圈）
      running = (async function () {
        var total = null;
        try {
          do {
            again = false;
            var r = await syncOnce();
            if (!total) total = r;
            else { total.pulled += r.pulled; total.pushed += r.pushed; total.rejected += r.rejected; total.overridden = total.overridden.concat(r.overridden); total.merged = total.merged.concat(r.merged); r.keptLocal.forEach(function (d) { if (total.keptLocal.indexOf(d) < 0) total.keptLocal.push(d); }); r.cloudBackups.forEach(function (k) { if (total.cloudBackups.indexOf(k) < 0) total.cloudBackups.push(k); }); }
          } while (again && userId);
          lastError = null;
          return total;
        } catch (e) {
          lastError = e && e.message ? e.message : String(e);
          throw e;
        } finally { running = null; emit(); }
      })();
      emit();
      return running;
    }

    return { put: put, remove: remove, noteBulkChange: noteBulkChange, setUser: setUser, signOut: signOut, sync: sync,
      status: status, _state: function () { return st; } };
  }

  // ---------- supabase-js v2 介面卡 ----------
  var COLS = 'date,data,deleted,client_updated_at,updated_at';
  function supabaseRemote(client, userId, table) {
    table = table || 'worklogs';
    function check(res) { if (res.error) throw new Error(res.error.message || 'Supabase error'); return res.data || []; }
    return {
      pull: async function (sinceIso) {
        var out = [], from = 0, PAGE = 1000;
        for (;;) {
          var q = client.from(table).select(COLS).eq('user_id', userId).order('updated_at', { ascending: true }).range(from, from + PAGE - 1);
          if (sinceIso) q = q.gt('updated_at', sinceIso);
          var rows = check(await q);
          out = out.concat(rows);
          if (rows.length < PAGE) return out;
          from += PAGE;
        }
      },
      push: async function (rows) {
        var payload = rows.map(function (r) { return { user_id: userId, date: r.date, data: r.data, deleted: r.deleted, client_updated_at: r.client_updated_at }; });
        return check(await client.from(table).upsert(payload, { onConflict: 'user_id,date' }).select(COLS));
      },
      fetchDates: async function (dates) {
        return check(await client.from(table).select(COLS).eq('user_id', userId).in('date', dates));
      },
    };
  }

  return { merge3: merge3, createEngine: createEngine, supabaseRemote: supabaseRemote, DATA_KEY: DATA_KEY_DEFAULT, SYNC_KEY: SYNC_KEY_DEFAULT };
});
