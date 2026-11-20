/* Stand-in for the CubeLV host SDK, so the WorkLogPlugin bundle runs on its own.
 * Data: localStorage 'worklog.v1' = Record<date, WorkLog> (same key and format as before).
 * Only what the plugin uses is implemented.
 *
 * Cloud sync edition: drop-in replacement for the original sdk-shim.js (same public API:
 * require('@cubelv/sdk'), window.WorkLogLocal; adds window.WorkLogSync).
 *   Needs app/sync-core.js (window.WorkLogSyncCore) loaded before this file.
 *   Optional: vendor/supabase.js (window.supabase) + app/config.js (window.WORKLOG_CONFIG).
 *   Without a real config or without supabase-js it runs in pure local mode, like before.
 *   Signed in: worklog.v1 stays the offline cache; changes sync per day (LWW) to Supabase. */
(function () {
  'use strict';
  var h = React.createElement;
  // Storage namespace: every localStorage key this app uses starts with NS.
  //   production: 'worklog'      → worklog.v1, worklog.v1.backup.<ts>, worklog.sync.v1, worklog.auth(-code-verifier), worklog.auth.pendingEmail
  //   beta build: 'worklog.beta' → worklog.beta.v1, worklog.beta.v1.backup.<ts>, worklog.beta.sync.v1, worklog.beta.auth, ...
  // integration/build.mjs --beta rewrites DEFAULT_NS, so the beta files stay on beta keys even if config.js is missing.
  var DEFAULT_NS = 'worklog.beta'; // beta build
  var CFG0 = window.WORKLOG_CONFIG || {};
  var NS = typeof CFG0.storageNamespace === 'string' && /^worklog(\.[a-z0-9-]+)?$/.test(CFG0.storageNamespace) ? CFG0.storageNamespace : DEFAULT_NS;
  if (DEFAULT_NS !== 'worklog' && NS === 'worklog') NS = DEFAULT_NS; // a beta build never falls back to production keys
  var STORAGE_KEY = NS + '.v1';
  var FOLDER_ID = 'local_work_log_folder';
  var FIELDS = ['date', 'clockIn', 'clockOut', 'breaks', 'workMinutes', 'isLeave', 'isSpecialLeave', 'isOvertimePay', 'note'];

  // ---------- storage ----------
  var storage = (function () {
    try { var s = window.localStorage; s.setItem(NS + '.__probe', '1'); s.removeItem(NS + '.__probe'); return s; }
    catch (e) { var m = new Map(); return { persistent: false, getItem: function (k) { return m.has(k) ? m.get(k) : null; }, setItem: function (k, v) { m.set(k, String(v)); }, removeItem: function (k) { m.delete(k); } }; }
  })();
  var persistent = storage.persistent !== false;

  function readMap() {
    var raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    var parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { storage.setItem(STORAGE_KEY + '.corrupt.' + Date.now(), raw); return {}; } // never wipe silently
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }
  function writeMap(map) { storage.setItem(STORAGE_KEY, JSON.stringify(map)); }
  function pick(src) { var o = {}; FIELDS.forEach(function (k) { if (k in src) o[k] = src[k]; }); return o; }
  function toItem(log) {
    return Object.assign({}, log, { id: 'wl_' + log.date, itemType: 'WORK_LOG', name: log.date, parents: (function () { var p = {}; p[FOLDER_ID] = 0; return p; })(), createdAt: 0, updatedAt: 0 });
  }

  // ---------- item store ----------
  var folder = { id: FOLDER_ID, itemType: 'WORK_LOG_FOLDER', name: '\u5DE5\u6642\u8A18\u9304' };
  var snap = { WORK_LOG: [], WORK_LOG_FOLDER: [folder] };
  var listeners = new Set();
  function rebuild() {
    var map = readMap();
    var logs = [];
    Object.keys(map).forEach(function (k) { var v = map[k]; if (v && typeof v === 'object' && typeof v.date === 'string') logs.push(toItem(v)); });
    logs.sort(function (a, b) { return a.date.localeCompare(b.date); });
    snap = { WORK_LOG: logs, WORK_LOG_FOLDER: [folder] };
    listeners.forEach(function (fn) { fn(); });
  }
  function subscribe(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
  var engine = window.WorkLogSyncCore.createEngine({
    storage: storage, readMap: readMap, writeMap: writeMap, dataKey: STORAGE_KEY, syncKey: NS + '.sync.v1',
    onChange: function () { rebuild(); },
    onStatus: function (s) { Cloud.setStatus(s); },
  });
  var itemStoreState = {
    upsertItem: function (item) {
      engine.put(pick(item)); // throws on quota: the plugin's save stops and nothing changes
      rebuild();
      Cloud.scheduleSync();
      return Promise.resolve(item);
    },
    removeItems: function (ids) {
      ids.forEach(function (id) {
        var hit = snap.WORK_LOG.find(function (i) { return i.id === id; });
        if (hit) engine.remove(hit.date);
      });
      rebuild();
      Cloud.scheduleSync();
      return Promise.resolve();
    },
  };
  function useItemsByType(type) {
    return React.useSyncExternalStore(subscribe, function () { return snap[type] || []; });
  }

  // ---------- toast ----------
  var toastBox = null, toastTimer = 0;
  function toast(msg) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'wl-toast';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    toastBox.textContent = String(msg);
    toastBox.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastBox.classList.remove('show'); }, 2500);
  }

  // ---------- UI primitives (shadcn-like look of the CubeLV host) ----------
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }
  var Button = React.forwardRef(function (p, ref) {
    var variant = p.variant || 'default', size = p.size || 'default';
    var rest = Object.assign({}, p); delete rest.variant; delete rest.size; delete rest.className; delete rest.asChild;
    return h('button', Object.assign({ type: 'button', ref: ref }, rest, { className: cx('cl-btn', 'cl-btn-' + variant, 'cl-size-' + size, p.className) }));
  });
  var Input = React.forwardRef(function (p, ref) {
    return h('input', Object.assign({ ref: ref }, p, { className: cx('cl-input', p.className) }));
  });
  var ToggleCtx = React.createContext(null);
  function ToggleGroup(p) {
    return h(ToggleCtx.Provider, { value: p }, h('div', { role: 'group', className: cx('cl-toggle-group', p.className) }, p.children));
  }
  function ToggleGroupItem(p) {
    var g = React.useContext(ToggleCtx);
    var on = g && g.value === p.value;
    return h('button', {
      type: 'button', className: cx('cl-toggle-item', p.className), 'data-state': on ? 'on' : 'off', 'aria-pressed': on,
      onClick: function () { if (g && g.onValueChange) g.onValueChange(on ? '' : p.value); },
    }, p.children);
  }
  var CustomScrollbar = React.forwardRef(function (p, ref) {
    return h('div', { ref: ref, className: cx('cl-scroll', p.className) }, p.children);
  });
  function PluginTopbar(p) {
    var Extra = SDK.__TopbarActions;
    return h('header', { className: 'cl-topbar' }, h('h1', { className: 'cl-topbar-title' }, p.title), Extra ? h(Extra) : null, Cloud.enabled ? h(AccountButton) : null);
  }

  // ---------- class + decorator stubs ----------
  function BaseItem() {}
  function View(leaf) { this.leaf = leaf; }
  function Plugin() { this.folderTypes = []; }
  Plugin.prototype.registerPluginRoot = function () {};
  Plugin.prototype.registerSection = function () {};
  Plugin.prototype.registerFolderType = function (cls, opts) { this.folderTypes.push(opts); };
  function itemType() { return function (cls) { return cls; }; }
  function plugin(id, opts) { return function (cls) { cls.pluginId = id; cls.pluginOptions = opts; return cls; }; }
  function generateObjectID() {
    var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // ---------- dirty dates (fed by the plugin, read by the import dialog) ----------
  var dirty = new Set();

  var SDK = {
    BaseItem: BaseItem, View: View, Plugin: Plugin, itemType: itemType, plugin: plugin,
    Button: Button, Input: Input, ToggleGroup: ToggleGroup, ToggleGroupItem: ToggleGroupItem,
    CustomScrollbar: CustomScrollbar, PluginTopbar: PluginTopbar, toast: toast, generateObjectID: generateObjectID,
    useItemStore: { getState: function () { return itemStoreState; } },
    useItemsByType: useItemsByType,
    useSelectedItemsStore: function (sel) { return sel({ lastFolderId: FOLDER_ID }); },
    __onDirty: function (date, on) { if (on) dirty.add(date); else dirty.delete(date); },
    __onDirtyClear: function () { dirty.clear(); },
    __discardAll: null, // set by the plugin view
    __TopbarActions: null, // set by app/io.js
  };

  function jsx(type, props, key) { return h(type, key === undefined ? props : Object.assign({}, props, { key: key })); }
  var JSX = { jsx: jsx, jsxs: jsx, Fragment: React.Fragment };

  window.require = function (name) {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return JSX;
    if (name === '@cubelv/sdk') return SDK;
    throw new Error('Unknown module ' + name);
  };

  // used by app/io.js
  window.WorkLogLocal = {
    STORAGE_KEY: STORAGE_KEY, NS: NS, storage: storage, persistent: persistent, readMap: readMap, rebuild: rebuild, sdk: SDK,
    dirtyDates: function () { return Array.from(dirty).sort(); },
    discardDrafts: function () { if (SDK.__discardAll) SDK.__discardAll(); dirty.clear(); },
    // Import: copy the current raw value to worklog.v1.backup.<ts>, then write. On failure
    // (e.g. quota) worklog.v1 is untouched and the backup made for it is removed again.
    importLogs: function (logs, mode, now) {
      // "replace" removes days. Ask first (listing them) when that reaches the cloud: signed in now, or this device is
      // bound to an account (owner \u2192 the deletions are sent at the next sign-in), or deletions are already queued.
      // Cancel \u2192 nothing is written (io.js stays on its dialog). v8: also when signed out.
      if (mode === 'replace') {
        var keep = {}; logs.forEach(function (l) { keep[l.date] = 1; });
        var gone = Object.keys(readMap()).filter(function (d) { return !keep[d]; }).sort();
        var es = engine._state(), queuedDel = Object.keys(es.meta).some(function (d) { return es.meta[d].dirty && es.meta[d].del; });
        var when = Cloud.getStatus().signedIn ? 'now' : es.owner ? 'later' : queuedDel ? 'local' : null;
        if (gone.length && when && !confirmCloudDelete(gone, replaceLabel, when)) { var c = new Error('cancelled'); c.cancelled = true; throw c; }
      }
      var raw = storage.getItem(STORAGE_KEY);
      var base = {};
      if (mode === 'merge' && raw) {
        try { var p = JSON.parse(raw); if (p && typeof p === 'object' && !Array.isArray(p)) base = p; } catch (e) { base = {}; }
      }
      var backupKey = null;
      if (raw) { backupKey = STORAGE_KEY + '.backup.' + (now || Date.now()); storage.setItem(backupKey, raw); }
      var map = Object.assign({}, base);
      logs.forEach(function (l) { map[l.date] = l; });
      var before = readMap();
      try { storage.setItem(STORAGE_KEY, JSON.stringify(map)); }
      catch (e) { if (backupKey) storage.removeItem(backupKey); throw e; }
      engine.noteBulkChange(before, map); // changed / removed days are queued for upload
      Cloud.scheduleSync();
      return { backupKey: backupKey, total: Object.keys(map).length };
    },
    listBackups: listBackups,
  };
  // ---------- local backups (NS.v1.backup.<ms>): made before import / restore / first sign-in / account switch ----------
  // <NS>.v1.backup.<ms> = this device's data before an import/restore/sign-in/switch;
  // <NS>.v1.backup.cloud.<ms> = cloud versions saved before this device overwrote or deleted them (v8)
  var BACKUP_RE = new RegExp('^' + STORAGE_KEY.replace(/\./g, '\\.') + '\\.backup\\.(?:(cloud)\\.)?(\\d+)$');
  function listBackups() {
    var out = [];
    if (typeof storage.key !== 'function') return out; // in-memory fallback: nothing persisted
    for (var i = 0; i < storage.length; i++) {
      var k = storage.key(i), m = k && BACKUP_RE.exec(k);
      if (!m) continue;
      var raw = storage.getItem(k), days = 0, ok = true;
      try { var o = JSON.parse(raw); if (!o || typeof o !== 'object' || Array.isArray(o)) ok = false; else for (var d in o) if (o[d] && typeof o[d] === 'object' && o[d].date === d) days++; } catch (e) { ok = false; }
      out.push({ key: k, at: Number(m[2]), kind: m[1] ? 'cloud' : 'local', days: days, bytes: raw ? raw.length : 0, ok: ok });
    }
    return out.sort(function (a, b) { return b.at - a.at; });
  }
  function backupExportJson(key) {
    var o = JSON.parse(storage.getItem(key) || '{}');
    var logs = Object.keys(o).sort().map(function (d) { return o[d]; }).filter(function (l) { return l && typeof l === 'object' && l.date; });
    return JSON.stringify({ app: 'work-log', version: 1, exportedAt: new Date().toISOString(), logs: logs }, null, 2);
  }
  var replaceLabel = '\u300C\u53D6\u4EE3\u5168\u90E8\u300D';
  function confirmCloudDelete(gone, label, when) {
    var list = gone.slice(0, 8).join('\u3001') + (gone.length > 8 ? ' \u2026\u7B49' : '');
    var msg = when === 'now'
      ? label + '\u6703\u540C\u6B65\u522A\u9664\u96F2\u7AEF\u8CC7\u6599\u3002\n\n\u5C07\u5F9E\u96F2\u7AEF\u522A\u9664 ' + gone.length + ' \u5929\uFF1A' + list + '\n\u5DF2\u767B\u5165\u7684\u5176\u4ED6\u88DD\u7F6E\u540C\u6B65\u5F8C\u4E5F\u6703\u522A\u9664\u9019\u4E9B\u65E5\u5B50\u3002\u9019\u53F0\u88DD\u7F6E\u6703\u5148\u5099\u4EFD\u76EE\u524D\u7684\u8CC7\u6599\u3002'
      : when === 'later'
      ? label + '\u6703\u522A\u9664 ' + gone.length + ' \u5929\uFF1A' + list + '\n\n\u9019\u53F0\u88DD\u7F6E\u767B\u5165\u904E\u96F2\u7AEF\u5E33\u865F\uFF1A\u91CD\u65B0\u767B\u5165\u5F8C\uFF0C\u9019\u4E9B\u65E5\u5B50\u6703\u5F9E\u96F2\u7AEF\u522A\u9664\uFF0C\u5DF2\u767B\u5165\u7684\u5176\u4ED6\u88DD\u7F6E\u540C\u6B65\u5F8C\u4E5F\u6703\u522A\u9664\u3002\u9001\u51FA\u522A\u9664\u524D\uFF0C\u6703\u5148\u628A\u96F2\u7AEF\u90A3\u5E7E\u5929\u5099\u4EFD\u5230\u300C\u672C\u6A5F\u5099\u4EFD\u300D\u3002\u9019\u53F0\u88DD\u7F6E\u4E5F\u6703\u5148\u5099\u4EFD\u76EE\u524D\u7684\u8CC7\u6599\u3002'
      : label + '\u6703\u522A\u9664 ' + gone.length + ' \u5929\uFF1A' + list + '\n\n\u9019\u53F0\u88DD\u7F6E\u9084\u6709\u5C1A\u672A\u9001\u51FA\u7684\u522A\u9664\u3002\u9019\u53F0\u88DD\u7F6E\u6C92\u6709\u767B\u5165\u904E\u5E33\u865F\uFF0C\u7B2C\u4E00\u6B21\u767B\u5165\u6642\u4EE5\u806F\u96C6\u8655\u7406\uFF0C\u4E0D\u6703\u522A\u9664\u96F2\u7AEF\u8CC7\u6599\u3002\u9019\u53F0\u88DD\u7F6E\u6703\u5148\u5099\u4EFD\u76EE\u524D\u7684\u8CC7\u6599\u3002';
    return typeof window.confirm === 'function' && window.confirm(msg + '\n\n\u78BA\u5B9A\u8981\u53D6\u4EE3\u55CE\uFF1F');
  }
  // restore = the same path as importing that backup (merge by default; replace asks before deleting cloud days)
  function restoreBackup(key, mode) {
    var raw = storage.getItem(key);
    var res = window.WorkLogIO && window.WorkLogIO.parseImportJson ? window.WorkLogIO.parseImportJson(raw || '') : null;
    if (!res || !res.ok) throw new Error('\u9019\u4EFD\u5099\u4EFD\u7121\u6CD5\u8B80\u53D6\uFF1A' + (res && res.error || '\u683C\u5F0F\u4E0D\u6B63\u78BA'));
    var r;
    replaceLabel = '\u300C\u53D6\u4EE3\u300D\u9084\u539F';
    try { r = window.WorkLogLocal.importLogs(res.logs, mode === 'replace' ? 'replace' : 'merge'); } finally { replaceLabel = '\u300C\u53D6\u4EE3\u5168\u90E8\u300D'; }
    window.WorkLogLocal.discardDrafts(); rebuild();
    return { backupKey: r.backupKey, total: r.total, restored: res.logs.length };
  }
  // ---------- cloud: auth (Supabase) + auto sync ----------
  // Providers are data, so adding one later (e.g. Apple) is a config change, not a code change.
  var PROVIDERS = {
    google: { label: '\u4F7F\u7528 Google \u767B\u5165' },   // 使用 Google 登入
    apple: { label: '\u4F7F\u7528 Apple \u767B\u5165' },     // 使用 Apple 登入（未啟用，見 SETUP.md 附錄）
    github: { label: '\u4F7F\u7528 GitHub \u767B\u5165' },
  };
  var AUTH_KEY = NS + '.auth';                 // supabase-js session (+ '-code-verifier' during PKCE)
  var PENDING_EMAIL_KEY = NS + '.auth.pendingEmail';
  var Cloud = (function () {
    var cfg = window.WORKLOG_CONFIG || {};
    // URL: https://<20-char ref>.supabase.co ; key: new 'sb_publishable_…' or legacy anon JWT 'eyJ…'
    var keyOk = typeof cfg.supabaseAnonKey === 'string' && (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(cfg.supabaseAnonKey) || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cfg.supabaseAnonKey));
    if (typeof cfg.supabaseAnonKey === 'string' && /^sb_secret_/.test(cfg.supabaseAnonKey)) { keyOk = false; console.error('WORKLOG_CONFIG: a secret key must never be shipped to the browser'); }
    var configured = typeof cfg.supabaseUrl === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/.test(cfg.supabaseUrl) && keyOk;
    var enabled = configured && !!(window.supabase && window.supabase.createClient);
    var providers = (Array.isArray(cfg.providers) ? cfg.providers : []).filter(function (p) { return PROVIDERS[p]; });
    var emailOtp = cfg.emailOtp === true; // off unless explicitly enabled (needs custom SMTP + template, see SETUP.md)
    var client = null, user = null, statusListeners = new Set();
    var timer = 0, linkLogin = false;
    function online() { return typeof navigator === 'undefined' || navigator.onLine !== false; }
    // GitHub Pages subpath: https://laynelin313.github.io/timesheet/  (never the bare origin)
    function redirectUrl() { var u = new URL('./', location.href); u.search = ''; u.hash = ''; return u.href; }
    function compose(s) {
      return Object.assign({}, s, { enabled: enabled, configured: configured, email: user && user.email || null, online: online(), providers: providers.slice(), emailOtp: emailOtp });
    }
    var status = compose(engine.status());
    function setStatus(s) {
      status = compose(s);
      statusListeners.forEach(function (fn) { try { fn(status); } catch (e) { console.error(e); } });
      try { window.dispatchEvent(new CustomEvent('worklogsync:change', { detail: status })); } catch (e) { /* old browsers */ }
    }
    function subscribeStatus(fn) { statusListeners.add(fn); return function () { statusListeners.delete(fn); }; }
    function getStatus() { return status; }

    function syncNow(quiet) {
      clearTimeout(timer);
      if (!user || !online()) { setStatus(engine.status()); return Promise.resolve(null); }
      return engine.sync().then(function (r) {
        if (r && r.overridden.length && !quiet) toast('\u5DF2\u540C\u6B65\uFF1B' + r.overridden.length + ' \u5929\u63A1\u7528\u4E86\u96F2\u7AEF\u8F03\u65B0\u7684\u7248\u672C');
        return r;
      }).catch(function (e) {
        if (!quiet) toast('\u540C\u6B65\u5931\u6557\uFF0C\u7A0D\u5F8C\u6703\u81EA\u52D5\u91CD\u8A66\uFF1A' + (e && e.message || e));
        return null;
      });
    }
    function scheduleSync() { if (!user) return; clearTimeout(timer); timer = setTimeout(function () { syncNow(true); }, 1500); }

    function onUser(next) {
      var id = next && next.id;
      if (id === (user && user.id)) { user = next || null; return; }
      if (!id) { user = null; engine.signOut(false); return; }
      // A sign-in link this browser did not ask for could be someone else's account (login CSRF):
      // ask before this device's data is merged into it.
      if (linkLogin) {
        linkLogin = false;
        var okToUse = typeof window.confirm !== 'function' || window.confirm('\u8981\u7528 ' + (next.email || '\u9019\u500B\u5E33\u865F') + ' \u767B\u5165\uFF0C\u4E26\u8B93\u9019\u53F0\u88DD\u7F6E\u7684\u8CC7\u6599\u8DDF\u5B83\u540C\u6B65\u55CE\uFF1F');
        if (!okToUse) { client.auth.signOut({ scope: 'local' }); return; }
      }
      user = next;
      var res = engine.setUser(id, window.WorkLogSyncCore.supabaseRemote(client, id));
      if (res.mode === 'switch') { if (SDK.__discardAll) SDK.__discardAll(); dirty.clear(); }
      syncNow(true).then(function (r) {
        if (res.mode === 'migrate') toast(r ? '\u5DF2\u628A\u672C\u6A5F\u8CC7\u6599\u642C\u4E0A\u96F2\u7AEF' + (r.keptLocal.length ? '\uFF08' + r.keptLocal.length + ' \u5929\u4EE5\u9019\u53F0\u88DD\u7F6E\u70BA\u6E96' + (r.cloudBackups.length ? '\uFF0C\u96F2\u7AEF\u820A\u7248\u5DF2\u5099\u4EFD' : '') + '\uFF09' : '') : '\u5DF2\u767B\u5165\uFF0C\u9023\u7DDA\u5F8C\u6703\u628A\u672C\u6A5F\u8CC7\u6599\u642C\u4E0A\u96F2\u7AEF');
        else if (r && r.cloudBackups.length) toast('\u5DF2\u540C\u6B65\uFF1B\u9001\u51FA\u522A\u9664\u524D\uFF0C\u96F2\u7AEF\u90A3\u5E7E\u5929\u5DF2\u5099\u4EFD\u5230\u300C\u672C\u6A5F\u5099\u4EFD\u300D');
        else if (res.mode === 'switch') toast('\u5DF2\u5207\u63DB\u5E33\u865F\uFF1B\u539F\u672C\u7684\u672C\u6A5F\u8CC7\u6599\u5DF2\u5099\u4EFD\uFF0C\u672A\u5408\u4F75');
      });
    }

    // Callback URLs handled here (supabase-js only does PKCE ?code=…, see detectSessionInUrl below):
    //   ?code=…                    OAuth or default-template magic link (PKCE). Works only in the browser that asked.
    //   #access_token=…            implicit links (e.g. sent from the dashboard): accepted via setSession.
    //   ?token_hash=…&type=email   custom email template (SETUP.md, needs custom SMTP).
    //   ?error_description= / #error_description=
    function pendingEmail() {
      try { var p = JSON.parse(storage.getItem(PENDING_EMAIL_KEY) || 'null'); return p && Date.now() - p.at < 3600e3 ? p : null; } catch (e) { return null; }
    }
    function handleAuthRedirect() {
      var q = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.replace(/^#/, ''));
      var clean = function () { history.replaceState(null, '', redirectUrl()); };
      var err = q.get('error_description') || hash.get('error_description');
      if (err) { toast('\u767B\u5165\u5931\u6557\uFF1A' + err); clean(); return; }
      if (q.get('token_hash')) {
        if (!pendingEmail()) linkLogin = true;
        client.auth.verifyOtp({ token_hash: q.get('token_hash'), type: q.get('type') || 'email' }).then(function (r) {
          if (r.error) toast('\u767B\u5165\u9023\u7D50\u7121\u6548\u6216\u5DF2\u904E\u671F\uFF1A' + r.error.message);
          else storage.removeItem(PENDING_EMAIL_KEY);
          clean();
        });
      } else if (hash.get('access_token') && hash.get('refresh_token')) {
        if (!pendingEmail()) linkLogin = true;
        client.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') }).then(function (r) {
          if (r.error) toast('\u767B\u5165\u9023\u7D50\u7121\u6548\u6216\u5DF2\u904E\u671F\uFF1A' + r.error.message);
          else storage.removeItem(PENDING_EMAIL_KEY);
          clean();
        });
      } else if (q.get('code')) {
        if (!storage.getItem(AUTH_KEY + '-code-verifier')) {
          // PKCE link opened in another browser / the home-screen app: nothing to exchange it with
          toast('\u8ACB\u5728\u9001\u51FA\u767B\u5165\u8981\u6C42\u7684\u540C\u4E00\u500B\u700F\u89BD\u5668\u958B\u555F\u9019\u500B\u9023\u7D50\uFF0C\u6216\u91CD\u65B0\u767B\u5165\u3002');
          clean();
        } else {
          // supabase-js exchanges it during init; tidy the URL once it is done
          client.auth.getSession().then(function (r) { if (!r.data.session) toast('\u767B\u5165\u672A\u5B8C\u6210\uFF0C\u8ACB\u518D\u8A66\u4E00\u6B21\u3002'); else storage.removeItem(PENDING_EMAIL_KEY); clean(); });
        }
      }
    }

    function start() {
      if (!enabled) return;
      client = window.supabase.createClient(cfg.supabaseUrl.replace(/\/$/, ''), cfg.supabaseAnonKey, {
        auth: {
          flowType: 'pkce', persistSession: true, autoRefreshToken: true,
          // only PKCE (?code=) is detected by supabase-js; implicit #access_token is handled in handleAuthRedirect
          detectSessionInUrl: function () { return false; },
          // every repo on laynelin313.github.io shares one origin/localStorage: use an app-specific key
          storageKey: AUTH_KEY,
          // session storage confined to our namespace (AUTH_KEY, AUTH_KEY-code-verifier, AUTH_KEY-user, ...):
          // supabase-js can never read or write another app's (or the production/beta twin's) keys through this
          storage: {
            getItem: function (k) { return String(k).indexOf(AUTH_KEY) === 0 ? storage.getItem(k) : null; },
            setItem: function (k, v) { if (String(k).indexOf(AUTH_KEY) === 0) storage.setItem(k, v); },
            removeItem: function (k) { if (String(k).indexOf(AUTH_KEY) === 0) storage.removeItem(k); },
          },
        },
      });
      client.auth.onAuthStateChange(function (event, session) {
        // never await supabase calls inside this callback (supabase-js docs); defer instead
        setTimeout(function () { onUser(session ? session.user : null); }, 0);
      });
      handleAuthRedirect();
      window.addEventListener('online', function () { setStatus(engine.status()); syncNow(true); });
      window.addEventListener('offline', function () { setStatus(engine.status()); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') syncNow(true); });
      setInterval(function () { if (document.visibilityState === 'visible') syncNow(true); }, 5 * 60 * 1000);
    }
    function need(cond, msg) { if (!cond) return Promise.reject(new Error(msg)); return null; }
    function signInWithProvider(provider) {
      return need(client, 'cloud sync is not configured') || need(providers.indexOf(provider) >= 0, 'provider not enabled: ' + provider) ||
        client.auth.signInWithOAuth({ provider: provider, options: { redirectTo: redirectUrl() } }).then(function (r) { if (r.error) throw r.error; });
    }
    function sendEmail(email) {
      return need(client, 'cloud sync is not configured') || need(emailOtp, 'email sign-in is disabled') ||
        client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } }).then(function (r) {
          if (r.error) throw r.error;
          storage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email: email, at: Date.now() }));
        });
    }
    function verifyCode(email, code) {
      return need(client, 'cloud sync is not configured') || need(emailOtp, 'email sign-in is disabled') ||
        client.auth.verifyOtp({ email: email, token: code, type: 'email' }).then(function (r) { if (r.error) throw r.error; storage.removeItem(PENDING_EMAIL_KEY); });
    }
    function signOut(clearLocal) {
      if (!client) return Promise.resolve({ backupKey: null });
      var push = user && online() ? syncNow(true) : Promise.resolve();
      return push.then(function () { return client.auth.signOut({ scope: 'local' }); }).then(function () {
        user = null;
        var r = engine.signOut(!!clearLocal);
        if (clearLocal) { if (SDK.__discardAll) SDK.__discardAll(); dirty.clear(); }
        return r;
      });
    }
    // ---- ingest tokens for the attendance agent (signed-in owner only; RLS + RPC on the server) ----
    var TOKEN_COLS = 'id,label,scope,token_hint,created_at,last_used_at,use_count,expires_at,revoked_at';
    function rpcCheck(r) { if (r.error) throw new Error(r.error.message || 'Supabase error'); return r.data; }
    function listIngestTokens() {
      return need(client && user, 'not signed in') || client.from('ingest_tokens').select(TOKEN_COLS).order('created_at', { ascending: false }).then(rpcCheck);
    }
    function createIngestToken(label, days) {
      return need(client && user, 'not signed in') || client.rpc('create_ingest_token', { p_label: label || '\u51FA\u52E4\u540C\u6B65\u5C08\u54E1', p_valid_days: days == null ? null : days /* null = never expires (default) */ }).then(rpcCheck);
    }
    function revokeIngestToken(id) {
      return need(client && user, 'not signed in') || client.rpc('revoke_ingest_token', { p_id: id }).then(rpcCheck);
    }
    return {
      enabled: enabled, configured: configured, start: start, setStatus: setStatus, getStatus: getStatus, subscribeStatus: subscribeStatus,
      scheduleSync: scheduleSync, syncNow: syncNow, signInWithProvider: signInWithProvider, sendEmail: sendEmail, verifyCode: verifyCode, signOut: signOut,
      listIngestTokens: listIngestTokens, createIngestToken: createIngestToken, revokeIngestToken: revokeIngestToken,
      providers: providers, emailOtp: emailOtp,
    };
  })();

  // ---------- account UI ----------
  // Front-end constraints (v4): nothing is inserted between .cl-topbar and the next div; the button lives inside
  // the topbar; the panel is a modal <dialog> (top layer, z-index 10 as a fallback); no backdrop-filter;
  // colours only from --topbar-bg/--topbar-fg/--topbar-border/--background/--foreground.
  (function injectCss() {
    if (typeof document === 'undefined') return;
    var css =
      '.wl-acct-dialog{position:fixed;z-index:10;margin:auto;width:min(380px,calc(100vw - 24px));max-height:calc(100dvh - 24px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow-y:auto;padding:16px;border:1px solid var(--topbar-border);border-radius:10px;background:var(--background);color:var(--foreground);-webkit-backdrop-filter:none;backdrop-filter:none}' +
      '.wl-acct-dialog::backdrop{background:color-mix(in srgb,var(--foreground) 40%,transparent);-webkit-backdrop-filter:none;backdrop-filter:none}' +
      '.wl-acct-col{display:flex;flex-direction:column;gap:10px}.wl-acct-row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;align-items:center}' +
      '.wl-acct-title{font-size:1rem;font-weight:700;line-height:1.4}.wl-acct-small{font-size:.8125rem;line-height:1.5}.wl-acct-strong{font-weight:700}' +
      '.wl-acct-sep{border-top:1px solid var(--topbar-border);margin:2px 0}' +
      '.wl-acct-b{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 14px;border-radius:6px;border:1px solid var(--foreground);background:var(--background);color:var(--foreground);font-size:.875rem;font-weight:600}' +
      '.wl-acct-b.primary{background:var(--foreground);color:var(--background)}.wl-acct-b.sm{min-height:32px;padding:0 10px}.wl-acct-b:disabled{opacity:.55;cursor:not-allowed}' +
      '.wl-acct-b:focus-visible,.wl-acct-in:focus-visible{outline:2px solid var(--foreground);outline-offset:2px}' +
      '.wl-acct-in{height:38px;padding:0 10px;border:1px solid var(--foreground);border-radius:6px;background:var(--background);color:var(--foreground);font-size:16px;width:100%}' +
      '.wl-acct-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}' +
      '.wl-acct-stack{flex-direction:column;align-items:stretch}.wl-acct-list{display:flex;flex-direction:column;gap:6px}.wl-acct-item{display:flex;gap:8px;align-items:center;justify-content:space-between;border:1px solid var(--topbar-border);border-radius:6px;padding:6px 8px}' +
      '.wl-acct-btn{position:relative}.wl-acct-dot{position:absolute;top:9px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--topbar-fg);box-shadow:0 0 0 2px var(--topbar-bg)}';
    var s = document.createElement('style'); s.textContent = '@layer components{' + css + '}'; document.head.appendChild(s);
  })();
  function icon(paths) { return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, paths.map(function (d, i) { return h('path', { key: i, d: d }); })); }
  var CloudIcon = icon(['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z']);
  var CloudOffIcon = icon(['m2 2 20 20', 'M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193', 'M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07']);
  function fmtTime(v) { if (!v) return '\u2014'; var d = new Date(v); return d.toLocaleString('zh-TW', { hour12: false }); }
  function fmtDate(v) { if (!v) return '\u2014'; return new Date(v).toLocaleDateString('zh-TW'); }
  function B(p, label) { return h('button', Object.assign({ type: 'button' }, p, { className: 'wl-acct-b' + (p.className ? ' ' + p.className : '') }), label); }

  function AccountButton() {
    var s = React.useSyncExternalStore(Cloud.subscribeStatus, Cloud.getStatus);
    var _o = React.useState(false), open = _o[0], setOpen = _o[1];
    var label = !s.signedIn ? '\u672C\u6A5F\u6A21\u5F0F\uFF1A\u767B\u5165\u4EE5\u540C\u6B65' : s.lastError || !s.online ? '\u540C\u6B65\u66AB\u505C' : s.pending ? '\u5F85\u540C\u6B65 ' + s.pending + ' \u7B46' : '\u5DF2\u540C\u6B65';
    return h(React.Fragment, null,
      h(Button, { variant: 'ghost', size: 'icon', className: 'wl-acct-btn', 'aria-label': label, title: label, 'aria-haspopup': 'dialog', onClick: function () { setOpen(true); } },
        s.signedIn ? CloudIcon : CloudOffIcon, s.signedIn && (s.pending || s.lastError || !s.online) ? h('span', { className: 'wl-acct-dot', 'aria-hidden': true }) : null),
      open ? h(AccountDialog, { status: s, onClose: function () { setOpen(false); } }) : null);
  }

  function useRunner() {
    var _st = React.useState(false), busy = _st[0], setBusy = _st[1];
    var _m = React.useState(''), msg = _m[0], setMsg = _m[1];
    function run(promise) {
      setMsg(''); setBusy(true);
      return promise.then(function (x) { setBusy(false); return { ok: true, value: x }; }, function (e) { setBusy(false); setMsg(e && e.message || String(e)); return { ok: false }; });
    }
    return { busy: busy, msg: msg, run: run };
  }

  function TokenSection() {
    var R = useRunner();
    var _l = React.useState(null), list = _l[0], setList = _l[1];
    var _n = React.useState(null), fresh = _n[0], setFresh = _n[1];
    function reload() { return R.run(Cloud.listIngestTokens()).then(function (r) { if (r.ok) setList(r.value || []); }); }
    React.useEffect(function () { reload(); }, []);
    var now = Date.now();
    var active = (list || []).filter(function (t) { return !t.revoked_at && (t.expires_at == null || Date.parse(t.expires_at) > now); });
    return h('div', { className: 'wl-acct-col', 'aria-label': '\u51FA\u52E4\u540C\u6B65\u6B0A\u6756' },
      h('div', { className: 'wl-acct-sep' }),
      h('p', { className: 'wl-acct-strong' }, '\u51FA\u52E4\u540C\u6B65\u6B0A\u6756'),
      h('p', { className: 'wl-acct-small' }, '\u8B93\u300C\u51FA\u52E4\u540C\u6B65\u5C08\u54E1\u300D\u628A\u6253\u5361\u6642\u9593\u76F4\u63A5\u5BEB\u9032\u4F60\u7684\u96F2\u7AEF\u8CC7\u6599\u3002\u53EA\u80FD\u5BEB\u4E0A\u4E0B\u73ED\u6642\u9593\u3001\u4F11\u606F\u548C\u5DE5\u6642\uFF0C\u4E0D\u80FD\u8B80\u53D6\u3002\u6B0A\u6756\u4E0D\u6703\u904E\u671F\uFF0C\u4E0D\u7528\u6642\u6216\u61F7\u7591\u5916\u6D29\u8ACB\u6309\u300C\u64A4\u92B7\u300D\u3002'),
      fresh ? h('div', { className: 'wl-acct-col', role: 'region', 'aria-label': '\u65B0\u6B0A\u6756' },
        h('p', { className: 'wl-acct-small wl-acct-strong' }, '\u9019\u628A\u6B0A\u6756\u53EA\u6703\u986F\u793A\u9019\u4E00\u6B21\u3002\u8ACB\u8CBC\u5230\u51FA\u52E4\u540C\u6B65\u5C08\u54E1\u7684\u5B89\u5168\u8868\u55AE\uFF08secret\uFF09\uFF0C\u4E0D\u8981\u8CBC\u5728\u804A\u5929\u6216\u6A94\u6848\u88E1\u3002'),
        h('input', { className: 'wl-acct-in wl-acct-mono', readOnly: true, value: fresh.token, 'aria-label': '\u65B0\u6B0A\u6756', 'data-ingest-token': '', onFocus: function (e) { e.target.select(); } }),
        h('div', { className: 'wl-acct-row' },
          B({ className: 'sm', onClick: function () { if (navigator.clipboard) navigator.clipboard.writeText(fresh.token).then(function () { toast('\u5DF2\u8907\u88FD'); }, function () {}); } }, '\u8907\u88FD'),
          B({ className: 'sm primary', onClick: function () { setFresh(null); } }, '\u6211\u5DF2\u5B58\u597D'))) : null,
      list === null ? h('p', { className: 'wl-acct-small' }, '\u8F09\u5165\u4E2D\u2026') :
        active.length ? h('div', { className: 'wl-acct-list' }, active.map(function (t) {
          return h('div', { key: t.id, className: 'wl-acct-item' },
            h('div', { className: 'wl-acct-small' }, h('span', { className: 'wl-acct-strong' }, t.label + ' \u2026' + t.token_hint), h('br'),
              (t.expires_at == null ? '\u4E0D\u904E\u671F' : '\u5230\u671F ' + fmtDate(t.expires_at)) + '\u3000\u6700\u5F8C\u4F7F\u7528 ' + fmtTime(t.last_used_at)),
            B({ className: 'sm', disabled: R.busy, 'aria-label': '\u64A4\u92B7 ' + t.label + ' \u2026' + t.token_hint, onClick: function () { R.run(Cloud.revokeIngestToken(t.id)).then(function (r) { if (r.ok) { toast('\u5DF2\u64A4\u92B7'); reload(); } }); } }, '\u64A4\u92B7'));
        })) : h('p', { className: 'wl-acct-small' }, '\u76EE\u524D\u6C92\u6709\u6709\u6548\u7684\u6B0A\u6756\u3002'),
      h('div', { className: 'wl-acct-row' },
        B({ className: 'sm', disabled: R.busy || !!fresh, onClick: function () { R.run(Cloud.createIngestToken('\u51FA\u52E4\u540C\u6B65\u5C08\u54E1', null)).then(function (r) { if (r.ok) { setFresh(r.value); reload(); } }); } }, '\u5EFA\u7ACB\u6B0A\u6756\uFF08\u6C38\u4E0D\u904E\u671F\uFF09')),
      R.msg ? h('p', { className: 'wl-acct-small wl-acct-strong', role: 'alert' }, R.msg) : null);
  }

  function fmtStamp(ms) { var d = new Date(ms), z = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()); }
  function BackupSection() {
    var _v = React.useState(0), ver = _v[0], setVer = _v[1];
    var _m = React.useState(''), msg = _m[0], setMsg = _m[1];
    var list = listBackups();
    var signedIn = Cloud.getStatus().signedIn;
    function restore(b, mode) {
      setMsg('');
      try { var r = restoreBackup(b.key, mode); toast('\u5DF2\u9084\u539F ' + r.restored + ' \u5929' + (mode === 'replace' ? '\uFF08\u53D6\u4EE3\uFF09' : '\uFF08\u5408\u4F75\uFF09') + (r.backupKey ? '\uFF1B\u9084\u539F\u524D\u7684\u8CC7\u6599\u5DF2\u5099\u4EFD' : '')); setVer(ver + 1); }
      catch (e) { if (!(e && e.cancelled)) setMsg(e && e.message || String(e)); }
    }
    function download(b) {
      var url = URL.createObjectURL(new Blob([backupExportJson(b.key)], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = url; a.download = NS.replace(/\./g, '-') + '-backup-' + (b.kind === 'cloud' ? 'cloud-' : '') + fmtStamp(b.at) + '.json'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    return h('div', { className: 'wl-acct-col', role: 'region', 'aria-label': '\u672C\u6A5F\u5099\u4EFD' },
      h('div', { className: 'wl-acct-sep' }),
      h('p', { className: 'wl-acct-strong' }, '\u672C\u6A5F\u5099\u4EFD'),
      h('p', { className: 'wl-acct-small' }, '\u532F\u5165\u3001\u9084\u539F\u3001\u7B2C\u4E00\u6B21\u767B\u5165\u3001\u5207\u63DB\u5E33\u865F\u4E4B\u524D\u6703\u81EA\u52D5\u5099\u4EFD\u3002\u300C\u9084\u539F\uFF08\u5408\u4F75\uFF09\u300D\u628A\u5099\u4EFD\u7684\u65E5\u5B50\u52A0\u56DE\u4F86\uFF0C\u540C\u4E00\u5929\u4EE5\u5099\u4EFD\u70BA\u6E96\uFF0C\u4E0D\u522A\u9664\u4EFB\u4F55\u65E5\u5B50' + (signedIn ? '\uFF0C\u4E26\u540C\u6B65\u5230\u96F2\u7AEF' : '') + '\uFF1B\u300C\u53D6\u4EE3\u300D\u53EA\u7559\u5099\u4EFD\u88E1\u7684\u65E5\u5B50' + (signedIn ? '\uFF0C\u6703\u5148\u78BA\u8A8D\u8981\u5F9E\u96F2\u7AEF\u522A\u9664\u54EA\u4E9B\u5929' : '') + '\u3002\u300C\u96F2\u7AEF\u820A\u7248\u300D\u662F\u9019\u53F0\u88DD\u7F6E\u84CB\u6389\u6216\u522A\u9664\u4E4B\u524D\u7684\u96F2\u7AEF\u7248\u672C\u3002\u9084\u539F\u524D\u6703\u5148\u5099\u4EFD\u76EE\u524D\u7684\u8CC7\u6599\u3002'),
      list.length ? h('div', { className: 'wl-acct-list' }, list.map(function (b) {
        var label = (b.kind === 'cloud' ? '\u96F2\u7AEF\u820A\u7248 \u00B7 ' : '') + fmtTime(b.at) + ' \u00B7 ' + b.days + ' \u5929';
        return h('div', { key: b.key, className: 'wl-acct-item wl-acct-stack', 'data-backup-key': b.key },
          h('div', { className: 'wl-acct-small' }, h('span', { className: 'wl-acct-strong' }, label), b.ok ? null : '\uFF08\u7121\u6CD5\u8B80\u53D6\uFF09'),
          h('div', { className: 'wl-acct-row' },
            B({ className: 'sm', disabled: !b.ok, 'aria-label': '\u4E0B\u8F09\u5099\u4EFD ' + label, onClick: function () { download(b); } }, '\u4E0B\u8F09'),
            b.kind === 'cloud' ? null : B({ className: 'sm', disabled: !b.ok, 'aria-label': '\u53D6\u4EE3\u70BA\u5099\u4EFD ' + label, onClick: function () { restore(b, 'replace'); } }, '\u53D6\u4EE3'), // \u96F2\u7AEF\u820A\u7248\u53EA\u542B\u90E8\u5206\u65E5\u5B50\uFF1A\u53EA\u7D66\u5408\u4F75
            B({ className: 'sm primary', disabled: !b.ok, 'aria-label': '\u9084\u539F\u5099\u4EFD ' + label + '\uFF08\u5408\u4F75\uFF09', onClick: function () { restore(b, 'merge'); } }, '\u9084\u539F\uFF08\u5408\u4F75\uFF09')));
      })) : h('p', { className: 'wl-acct-small' }, '\u76EE\u524D\u6C92\u6709\u5099\u4EFD\u3002'),
      msg ? h('p', { className: 'wl-acct-small wl-acct-strong', role: 'alert' }, msg) : null);
  }

  function AccountDialog(p) {
    var ref = React.useRef(null), s = p.status;
    var _e = React.useState(''), email = _e[0], setEmail = _e[1];
    var _c = React.useState(''), code = _c[0], setCode = _c[1];
    var _sent = React.useState(false), sent = _sent[0], setSent = _sent[1];
    var R = useRunner();
    React.useEffect(function () { var d = ref.current; if (d && !d.open && d.showModal) d.showModal(); }, []);
    var body;
    if (!s.signedIn) {
      body = h('div', { className: 'wl-acct-col' },
        h('p', { className: 'wl-acct-small' }, '\u76EE\u524D\u662F\u672C\u6A5F\u6A21\u5F0F\uFF0C\u8CC7\u6599\u53EA\u5B58\u5728\u9019\u53F0\u88DD\u7F6E\u3002\u767B\u5165\u5F8C\u6703\u628A\u73FE\u6709\u8CC7\u6599\u642C\u4E0A\u96F2\u7AEF\uFF0C\u4E26\u5728\u5404\u88DD\u7F6E\u81EA\u52D5\u540C\u6B65\uFF1B\u96E2\u7DDA\u4E5F\u80FD\u7E7C\u7E8C\u4F7F\u7528\u3002'),
        !s.online ? h('p', { className: 'wl-acct-small wl-acct-strong' }, '\u76EE\u524D\u96E2\u7DDA\uFF0C\u9023\u7DDA\u5F8C\u624D\u80FD\u767B\u5165\u3002') : null,
        s.providers.map(function (prov) {
          return B({ key: prov, className: 'primary', disabled: R.busy || !s.online, onClick: function () { R.run(Cloud.signInWithProvider(prov)); } }, PROVIDERS[prov].label);
        }),
        s.emailOtp ? h(React.Fragment, null,
          h('div', { className: 'wl-acct-sep' }),
          h('input', { className: 'wl-acct-in', type: 'email', autoComplete: 'email', inputMode: 'email', placeholder: 'Email', value: email, 'aria-label': 'Email', onChange: function (e) { setEmail(e.target.value.trim()); } }),
          !sent ? B({ disabled: R.busy || !s.online || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), onClick: function () { R.run(Cloud.sendEmail(email)).then(function (r) { if (r.ok) setSent(true); }); } }, '\u5BC4\u9001\u767B\u5165\u9023\u7D50')
            : h(React.Fragment, null,
              h('p', { className: 'wl-acct-small' }, '\u5DF2\u5BC4\u51FA\u3002\u9EDE\u4FE1\u4E2D\u7684\u9023\u7D50\uFF0C\u6216\u628A\u4FE1\u4E2D\u7684 6 \u4F4D\u6578\u9A57\u8B49\u78BC\u8F38\u5165\u9019\u88E1\uFF08\u5B89\u88DD\u5230\u4E3B\u756B\u9762\u7684 App \u8ACB\u7528\u9A57\u8B49\u78BC\uFF09\u3002'),
              h('input', { className: 'wl-acct-in', inputMode: 'numeric', autoComplete: 'one-time-code', placeholder: '123456', value: code, 'aria-label': '\u9A57\u8B49\u78BC', onChange: function (e) { setCode(e.target.value.replace(/\D/g, '').slice(0, 10)); } }),
              h('div', { className: 'wl-acct-row' },
                B({ className: 'sm', disabled: R.busy, onClick: function () { R.run(Cloud.sendEmail(email)); } }, '\u91CD\u65B0\u5BC4\u9001'),
                B({ className: 'sm primary', disabled: R.busy || code.length < 6, onClick: function () { R.run(Cloud.verifyCode(email, code)).then(function (r) { if (r.ok) p.onClose(); }); } }, '\u767B\u5165')))) : null,
        !s.providers.length && !s.emailOtp ? h('p', { className: 'wl-acct-small' }, '\u5C1A\u672A\u555F\u7528\u4EFB\u4F55\u767B\u5165\u65B9\u5F0F\u3002') : null,
        h(BackupSection));
    } else {
      body = h('div', { className: 'wl-acct-col' },
        h('p', null, '\u5DF2\u767B\u5165\uFF1A', h('span', { className: 'wl-acct-strong' }, s.email || '')),
        h('p', { className: 'wl-acct-small' },
          !s.online ? '\u96E2\u7DDA\u4E2D\uFF1B\u4FEE\u6539\u6703\u5148\u5B58\u5728\u672C\u6A5F\uFF0C\u9023\u7DDA\u5F8C\u81EA\u52D5\u540C\u6B65\u3002' : s.syncing ? '\u540C\u6B65\u4E2D\u2026' : s.pending ? '\u5F85\u4E0A\u50B3 ' + s.pending + ' \u7B46' : '\u5168\u90E8\u5DF2\u540C\u6B65',
          h('br'), '\u4E0A\u6B21\u540C\u6B65\uFF1A' + fmtTime(s.lastSyncAt)),
        s.lastError ? h('p', { className: 'wl-acct-small wl-acct-strong' }, '\u4E0A\u6B21\u540C\u6B65\u5931\u6557\uFF1A' + s.lastError) : null,
        h('div', { className: 'wl-acct-row' },
          B({ className: 'sm', disabled: R.busy || !s.online, onClick: function () { R.run(Cloud.syncNow(false)); } }, '\u7ACB\u5373\u540C\u6B65'),
          B({ className: 'sm', disabled: R.busy, onClick: function () { R.run(Cloud.signOut(false)).then(function (r) { if (r.ok) p.onClose(); }); } }, '\u767B\u51FA'),
          B({ className: 'sm', disabled: R.busy, title: '\u767B\u51FA\u4E26\u6E05\u9664\u9019\u53F0\u88DD\u7F6E\u4E0A\u7684\u8CC7\u6599\uFF08\u96F2\u7AEF\u4FDD\u7559\uFF09', onClick: function () { R.run(Cloud.signOut(true)).then(function (r) { if (r.ok) p.onClose(); }); } }, '\u767B\u51FA\u4E26\u6E05\u9664\u672C\u6A5F')),
        h('p', { className: 'wl-acct-small' }, '\u767B\u51FA\u5F8C\u8CC7\u6599\u4ECD\u7559\u5728\u9019\u53F0\u88DD\u7F6E\uFF0C\u53EF\u7E7C\u7E8C\u4EE5\u672C\u6A5F\u6A21\u5F0F\u4F7F\u7528\u3002\u5171\u7528\u88DD\u7F6E\u8ACB\u9078\u300C\u767B\u51FA\u4E26\u6E05\u9664\u672C\u6A5F\u300D\u3002'),
        h(BackupSection),
        s.online ? h(TokenSection) : null);
    }
    return h('dialog', { ref: ref, className: 'wl-acct-dialog', 'aria-label': '\u5E33\u865F\u8207\u540C\u6B65', onClose: p.onClose, onCancel: p.onClose },
      h('div', { className: 'wl-acct-col' },
        h('h2', { className: 'wl-acct-title' }, '\u5E33\u865F\u8207\u540C\u6B65'),
        body,
        R.msg ? h('p', { className: 'wl-acct-small wl-acct-strong', role: 'alert' }, R.msg) : null,
        h('div', { className: 'wl-acct-row' }, B({ className: 'sm', onClick: p.onClose }, '\u95DC\u9589'))));
  }

  // ---------- public API for the front end (documented in README) ----------
  window.WorkLogSync = {
    get enabled() { return Cloud.enabled; },
    getState: function () { return Cloud.getStatus(); },
    status: function () { return Cloud.getStatus(); },          // alias of getState()
    subscribe: function (cb) { return Cloud.subscribeStatus(cb); }, // returns unsubscribe(); also window 'worklogsync:change'
    signIn: function (provider) { return Cloud.signInWithProvider(provider || Cloud.providers[0]); },
    signInWithProvider: function (p) { return Cloud.signInWithProvider(p); },
    sendEmail: function (e) { return Cloud.sendEmail(e); },
    verifyCode: function (e, c) { return Cloud.verifyCode(e, c); },
    signOut: function (opts) { return Cloud.signOut(opts === true || !!(opts && opts.clearLocal)); },
    syncNow: function () { return Cloud.syncNow(false); },
    listIngestTokens: function () { return Cloud.listIngestTokens(); },
    createIngestToken: function (label, days) { return Cloud.createIngestToken(label, days); },
    revokeIngestToken: function (id) { return Cloud.revokeIngestToken(id); },
  };

  window.WorkLogLocal.sync = window.WorkLogSync;
  rebuild();
  Cloud.start();
})();
