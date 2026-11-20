/* 匯入 / 匯出 JSON for the standalone 工時記錄 PWA (not part of the CubeLV plugin). */
(function () {
  'use strict';
  var h = React.createElement;
  var L = window.WorkLogLocal;
  var Button = L.sdk.Button;

  // ---------- parse + validate ----------
  // Accepted:
  //  1. this app's export: { app: 'work-log', version: 1, exportedAt, logs: WorkLog[] }
  //  2. the raw localStorage value: Record<date, WorkLog>
  //  3. a CubeLV items dump ({ subtree: [...] } or [...] of items, WORK_LOG ones are used;
  //     null flags -> false, latest updatedAt wins per date, deleted items skipped)
  // All or nothing: one bad record rejects the whole file. Records are kept as they are.
  var EXPORT_VERSION = 1;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var TYPES = { clockIn: 'string', clockOut: 'string', workMinutes: 'number', isLeave: 'boolean', isSpecialLeave: 'boolean', isOvertimePay: 'boolean', note: 'string' };
  var TYPE_TEXT = { string: '\u6587\u5B57', number: '\u6578\u5B57', boolean: 'true/false' };
  function isObj(v) { return typeof v === 'object' && v !== null && !Array.isArray(v); }
  function realDate(s) {
    if (!DATE_RE.test(s)) return false;
    var p = s.split('-').map(Number), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return t.getUTCFullYear() === p[0] && t.getUTCMonth() === p[1] - 1 && t.getUTCDate() === p[2];
  }
  function checkLog(r) {
    if (!isObj(r)) return '\u4E0D\u662F\u4E00\u7B46\u7D00\u9304';
    if (typeof r.date !== 'string' || !realDate(r.date)) return 'date \u8981\u662F YYYY-MM-DD \u7684\u65E5\u671F';
    for (var k in TYPES) {
      if (!(k in r)) return '\u7F3A\u5C11 ' + k;
      if (typeof r[k] !== TYPES[k]) return k + ' \u8981\u662F ' + TYPE_TEXT[TYPES[k]];
    }
    if (!Number.isFinite(r.workMinutes)) return 'workMinutes \u8981\u662F\u6578\u5B57';
    if (!Array.isArray(r.breaks) || !r.breaks.every(function (b) { return isObj(b) && typeof b.start === 'string' && typeof b.end === 'string'; }))
      return 'breaks \u8981\u662F { start, end } \u7684\u6E05\u55AE';
    return null;
  }
  function pick(r) {
    return { date: r.date, clockIn: r.clockIn, clockOut: r.clockOut, breaks: r.breaks.map(function (b) { return { start: b.start, end: b.end }; }),
      workMinutes: r.workMinutes, isLeave: r.isLeave, isSpecialLeave: r.isSpecialLeave, isOvertimePay: r.isOvertimePay, note: r.note };
  }
  function fromCubeItem(it) {
    var o = Object.assign({}, it);
    ['isLeave', 'isSpecialLeave', 'isOvertimePay'].forEach(function (k) { if (o[k] == null) o[k] = false; });
    if (o.note == null) o.note = '';
    if (o.date == null && typeof o.name === 'string') o.date = o.name;
    return o;
  }
  function fail(error, details) { return { ok: false, error: error, details: details || [] }; }
  function parseImportJson(text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { return fail('\u6A94\u6848\u4E0D\u662F\u6709\u6548\u7684 JSON\u3002'); }
    var entries, format;
    var cubeList = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.subtree) ? data.subtree : null;
    if (isObj(data) && 'logs' in data) {
      if (data.app !== 'work-log') return fail('\u9019\u4E0D\u662F\u5DE5\u6642\u7D00\u9304\u532F\u51FA\u7684\u6A94\u6848\u3002');
      if (data.version !== EXPORT_VERSION) return fail('\u4E0D\u652F\u63F4\u7684\u6A94\u6848\u7248\u672C\uFF08' + String(data.version) + '\uFF09\u3002');
      if (!Array.isArray(data.logs)) return fail('\u6A94\u6848\u683C\u5F0F\u4E0D\u6B63\u78BA\uFF1Alogs \u4E0D\u662F\u6E05\u55AE\u3002');
      entries = data.logs.map(function (r, i) { return ['\u7B2C ' + (i + 1) + ' \u7B46', r, null]; });
      format = 'export';
    } else if (cubeList && cubeList.some(function (it) { return isObj(it) && it.itemType === 'WORK_LOG'; })) {
      var latest = new Map();
      cubeList.forEach(function (it) {
        if (!isObj(it) || it.itemType !== 'WORK_LOG' || it.deletedAt) return;
        var o = fromCubeItem(it), prev = latest.get(o.date);
        if (!prev || Number(o.updatedAt || 0) >= Number(prev.updatedAt || 0)) latest.set(o.date, o);
      });
      entries = Array.from(latest.values()).map(function (r) { return [String(r.date), r, null]; });
      format = 'cubelv';
    } else if (isObj(data) && Object.keys(data).length > 0 && Object.keys(data).every(function (k) { return DATE_RE.test(k); })) {
      entries = Object.keys(data).map(function (k) { return [k, data[k], k]; });
      format = 'map';
    } else {
      return fail('\u9019\u4E0D\u662F\u5DE5\u6642\u7D00\u9304\u532F\u51FA\u7684\u6A94\u6848\u3002');
    }
    if (entries.length === 0) return fail('\u6A94\u6848\u88E1\u6C92\u6709\u4EFB\u4F55\u7D00\u9304\u3002');
    var details = [], seen = new Set(), logs = [];
    entries.forEach(function (e) {
      var label = e[0], r = e[1], key = e[2];
      var err = checkLog(r);
      if (!err && key !== null && key !== r.date) err = '\u65E5\u671F ' + key + ' \u548C\u7D00\u9304\u5167\u7684 date\uFF08' + r.date + '\uFF09\u4E0D\u4E00\u81F4';
      if (!err && seen.has(r.date)) err = '\u65E5\u671F ' + r.date + ' \u91CD\u8907';
      if (err) { details.push(label + (format === 'export' && isObj(r) && typeof r.date === 'string' ? '\uFF08' + r.date + '\uFF09' : '') + '\uFF1A' + err); return; }
      seen.add(r.date); logs.push(pick(r));
    });
    if (details.length) return fail('\u6709 ' + details.length + ' \u7B46\u7D00\u9304\u683C\u5F0F\u4E0D\u6B63\u78BA\uFF0C\u6574\u500B\u6A94\u6848\u90FD\u6C92\u6709\u532F\u5165\u3002', details);
    logs.sort(function (a, b) { return a.date.localeCompare(b.date); });
    return { ok: true, logs: logs, format: format };
  }
  function monthCounts(logs) {
    var m = new Map();
    logs.forEach(function (l) { var k = l.date.slice(0, 7); m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m).sort(function (a, b) { return a[0].localeCompare(b[0]); }).map(function (x) { return { ym: x[0], count: x[1] }; });
  }

  // ---------- export ----------
  function buildExportJson(now) {
    var map = L.readMap();
    var logs = Object.keys(map).map(function (k) { return map[k]; }).filter(function (l) { return l && typeof l.date === 'string'; });
    logs.sort(function (a, b) { return a.date.localeCompare(b.date); });
    return JSON.stringify({ app: 'work-log', version: EXPORT_VERSION, exportedAt: (now || new Date()).toISOString(), logs: logs }, null, 2);
  }
  function exportFileName(now) {
    var d = now || new Date();
    return 'worklog-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
  }

  // ---------- dialog with focus management ----------
  function Dialog(p) {
    var box = React.useRef(null);
    React.useEffect(function () {
      var first = box.current && box.current.querySelector('[data-autofocus]');
      if (first) first.focus();
      var back = p.returnFocus && p.returnFocus.current;
      return function () { if (back) back.focus(); };
    }, []);
    function onKeyDown(e) {
      if (e.key === 'Escape') { e.stopPropagation(); p.onCancel(); return; }
      if (e.key !== 'Tab') return;
      var items = Array.prototype.slice.call(box.current.querySelectorAll('button:not([disabled]), textarea, input'));
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return h('div', { className: 'fixed inset-0 z-20 flex items-center justify-center bg-background/60 px-4 wl-dialog-overlay', role: 'presentation' },
      h('div', { ref: box, className: 'w-full max-w-sm rounded-lg border border-border bg-card p-4 wl-dialog', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': p.id + '-title', 'aria-describedby': p.id + '-body', onKeyDown: onKeyDown },
        h('h2', { id: p.id + '-title', className: 'text-sm font-semibold' }, p.title),
        h('div', { id: p.id + '-body', className: 'mt-1 text-sm text-muted-foreground' }, p.children),
        h('div', { className: 'mt-3 flex justify-end gap-2 wl-wrap' }, p.actions)));
  }

  function readFileText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(String(r.result)); }; r.onerror = function () { reject(r.error); }; r.readAsText(file); });
  }
  function isQuotaError(e) { return e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014); }

  var UploadIcon = h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M12 21V9m0 0 4 4m-4-4-4 4M4 3h16' }));
  var DownloadIcon = h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16' }));

  // The file picker opens straight from the tap (iOS only allows that inside the gesture).
  function ImportButton() {
    var input = React.useRef(null), button = React.useRef(null);
    var st = React.useState(null), phase = st[0], setPhase = st[1];
    var bs = React.useState(false), busy = bs[0], setBusy = bs[1];
    function pick() { if (!input.current) return; input.current.value = ''; input.current.click(); }
    function onFile(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      readFileText(file).then(function (text) {
        var res = parseImportJson(text);
        if (!res.ok) { setPhase({ kind: 'error', error: res.error, details: res.details }); return; }
        var localCount = L.sdk.useItemStore && Object.keys(L.readMap()).length;
        setPhase({ kind: 'confirm', fileName: file.name, logs: res.logs, format: res.format, months: monthCounts(res.logs), localCount: localCount, dirty: L.dirtyDates() });
      }, function () { setPhase({ kind: 'error', error: '\u7121\u6CD5\u8B80\u53D6\u9019\u500B\u6A94\u6848\u3002', details: [] }); });
    }
    function run(mode) {
      var p = phase, result;
      setBusy(true);
      try { result = L.importLogs(p.logs, mode); }
      catch (err) {
        setBusy(false);
        if (err && err.cancelled) return; // [auth-sync] replace-all cancelled at the cloud-delete confirmation: nothing changed
        setPhase({ kind: 'error', details: [], error: isQuotaError(err)
          ? '\u5132\u5B58\u7A7A\u9593\u4E0D\u8DB3\uFF0C\u5DF2\u53D6\u6D88\u532F\u5165\uFF0C\u539F\u672C\u7684\u8CC7\u6599\u6C92\u6709\u8B8A\u66F4\u3002\u53EF\u522A\u9664\u820A\u7684\u5099\u4EFD\u6216\u6E05\u6389\u90E8\u5206\u8CC7\u6599\u5F8C\u518D\u8A66\u3002'
          : '\u532F\u5165\u5931\u6557\uFF0C\u539F\u672C\u7684\u8CC7\u6599\u6C92\u6709\u8B8A\u66F4\u3002' });
        return;
      }
      L.discardDrafts(); // unsaved edits were based on the old data; the user was told in the dialog
      L.rebuild();       // list, month and year totals read the new data
      setBusy(false);
      setPhase({ kind: 'done', count: p.logs.length, total: result.total, backupKey: result.backupKey });
    }
    function close() { setPhase(null); }
    var dialog = null;
    if (phase && phase.kind === 'error') {
      dialog = h(Dialog, { key: 'error', id: 'import', title: '\u7121\u6CD5\u532F\u5165', onCancel: close, returnFocus: button,
        actions: h(Button, { size: 'sm', 'data-autofocus': true, onClick: close }, '\u95DC\u9589') },
        h('p', { className: 'text-destructive', role: 'alert' }, phase.error),
        phase.details.length ? h('ul', { className: 'wl-list import-errors' },
          phase.details.slice(0, 5).map(function (d) { return h('li', { key: d }, d); }),
          phase.details.length > 5 ? h('li', null, '\u2026\u2026\u53E6\u5916 ' + (phase.details.length - 5) + ' \u7B46') : null) : null,
        h('p', { className: 'mt-1' }, '\u6C92\u6709\u5BEB\u5165\u4EFB\u4F55\u8CC7\u6599\u3002'));
    } else if (phase && phase.kind === 'confirm') {
      var hasLocal = phase.localCount > 0;
      var actions = [h(Button, { key: 'c', variant: 'outline', size: 'sm', 'data-autofocus': true, disabled: busy, onClick: close }, '\u53D6\u6D88')];
      if (hasLocal) actions.push(
        h(Button, { key: 'm', variant: 'outline', size: 'sm', disabled: busy, onClick: function () { run('merge'); } }, '\u5408\u4F75\uFF08\u532F\u5165\u7684\u65E5\u671F\u8986\u84CB\uFF09'),
        h(Button, { key: 'r', variant: 'destructive', size: 'sm', disabled: busy, onClick: function () { run('replace'); } }, '\u53D6\u4EE3\u5168\u90E8'));
      else actions.push(h(Button, { key: 'i', size: 'sm', disabled: busy, onClick: function () { run('replace'); } }, '\u532F\u5165'));
      dialog = h(Dialog, { key: 'confirm', id: 'import', title: '\u532F\u5165\u8CC7\u6599', onCancel: function () { if (!busy) close(); }, returnFocus: button, actions: actions },
        h('p', null, phase.fileName + '\uFF1A\u5171 ' + phase.logs.length + ' \u7B46'),
        h('ul', { className: 'wl-list tabular-nums import-months text-foreground' }, phase.months.map(function (m) { return h('li', { key: m.ym }, m.ym + '\uFF1A' + m.count + ' \u7B46'); })),
        hasLocal ? h('p', { className: 'mt-1 import-note' }, '\u9019\u53F0\u88DD\u7F6E\u5DF2\u6709 ' + phase.localCount + ' \u7B46\u7D00\u9304\uFF0C\u532F\u5165\u524D\u6703\u5148\u5099\u4EFD\u3002\u300C\u53D6\u4EE3\u5168\u90E8\u300D\u6703\u6E05\u6389\u73FE\u6709\u7D00\u9304\uFF1B\u300C\u5408\u4F75\u300D\u4FDD\u7559\u73FE\u6709\u7D00\u9304\uFF0C\u540C\u4E00\u5929\u4EE5\u532F\u5165\u7684\u70BA\u6E96\u3002') : null,
        phase.dirty.length ? h('p', { className: 'mt-1 text-chart-tangerineOrange import-dirty' }, '\u672A\u5132\u5B58\u7684\u8B8A\u66F4\uFF08' + phase.dirty.join('\u3001') + '\uFF09\u5728\u532F\u5165\u5F8C\u6703\u6368\u68C4\u3002') : null);
    } else if (phase && phase.kind === 'done') {
      dialog = h(Dialog, { key: 'done', id: 'import', title: '\u532F\u5165\u5B8C\u6210', onCancel: close, returnFocus: button,
        actions: h(Button, { size: 'sm', 'data-autofocus': true, onClick: close }, '\u95DC\u9589') },
        h('p', { role: 'status' }, '\u5DF2\u532F\u5165 ' + phase.count + ' \u7B46\uFF0C\u73FE\u5728\u5171 ' + phase.total + ' \u7B46\u3002'),
        phase.backupKey ? h('p', { className: 'mt-1 import-backup' }, '\u539F\u672C\u7684\u8CC7\u6599\u5DF2\u5099\u4EFD\u70BA ' + phase.backupKey + '\u3002') : null);
    }
    return h(React.Fragment, null,
      h(Button, { ref: button, variant: 'ghost', size: 'icon', 'aria-label': '\u532F\u5165 JSON', title: '\u532F\u5165 JSON', onClick: pick }, UploadIcon),
      h('input', { ref: input, type: 'file', accept: 'application/json,.json', className: 'wl-file-input', tabIndex: -1, 'aria-hidden': 'true', onChange: onFile }),
      dialog);
  }

  // Shows the text too, so it can be copied where a download is blocked.
  function ExportButton() {
    var st = React.useState(null), json = st[0], setJson = st[1];
    var ns = React.useState(''), note = ns[0], setNote = ns[1];
    var area = React.useRef(null), button = React.useRef(null);
    function copy() {
      (navigator.clipboard ? navigator.clipboard.writeText(json || '') : Promise.reject()).then(function () { setNote('\u5DF2\u8907\u88FD'); },
        function () { if (area.current) area.current.select(); setNote('\u8ACB\u9577\u6309\u9078\u53D6\u5168\u90E8\u5F8C\u8907\u88FD'); });
    }
    function download() {
      var url = URL.createObjectURL(new Blob([json || ''], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = url; a.download = exportFileName(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    return h(React.Fragment, null,
      h(Button, { ref: button, variant: 'ghost', size: 'icon', 'aria-label': '\u532F\u51FA\u5168\u90E8\u8CC7\u6599 JSON', title: '\u532F\u51FA\u5168\u90E8\u8CC7\u6599 JSON', onClick: function () { setNote(''); setJson(buildExportJson()); } }, DownloadIcon),
      json !== null ? h(Dialog, { id: 'export', title: '\u532F\u51FA\u5168\u90E8\u8CC7\u6599', onCancel: function () { setJson(null); }, returnFocus: button,
        actions: [
          h('span', { key: 'n', className: 'wl-note text-xs text-muted-foreground' }, note),
          h(Button, { key: 'd', variant: 'outline', size: 'sm', onClick: download }, '\u4E0B\u8F09\u6A94\u6848'),
          h(Button, { key: 'c', variant: 'outline', size: 'sm', onClick: copy }, '\u8907\u88FD'),
          h(Button, { key: 'x', size: 'sm', 'data-autofocus': true, onClick: function () { setJson(null); } }, '\u95DC\u9589')] },
        h('textarea', { ref: area, className: 'cl-input wl-export-text tabular-nums', readOnly: true, value: json, 'aria-label': 'JSON' })) : null);
  }

  function TopbarActions() {
    return h('div', { className: 'cl-topbar-actions' },
      !L.persistent ? h('span', { className: 'wl-warn text-xs' }, '\u6B64\u74B0\u5883\u7121\u6CD5\u4FDD\u5B58\u8CC7\u6599') : null,
      h(ImportButton), h(ExportButton));
  }
  L.sdk.__TopbarActions = TopbarActions;
  window.WorkLogIO = { parseImportJson: parseImportJson, monthCounts: monthCounts, buildExportJson: buildExportJson };
})();
