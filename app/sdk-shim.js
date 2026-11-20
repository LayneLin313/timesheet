/* Stand-in for the CubeLV host SDK, so the WorkLogPlugin bundle runs on its own.
 * Data: localStorage 'worklog.v1' = Record<date, WorkLog> (same key and format as before).
 * Only what the plugin uses is implemented. */
(function () {
  'use strict';
  var h = React.createElement;
  var STORAGE_KEY = 'worklog.v1';
  var FOLDER_ID = 'local_work_log_folder';
  var FIELDS = ['date', 'clockIn', 'clockOut', 'breaks', 'workMinutes', 'isLeave', 'isSpecialLeave', 'isOvertimePay', 'note'];

  // ---------- storage ----------
  var storage = (function () {
    try { var s = window.localStorage; s.setItem('__probe', '1'); s.removeItem('__probe'); return s; }
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
  var itemStoreState = {
    upsertItem: function (item) {
      var map = readMap();
      map[item.date] = pick(item);
      writeMap(map); // throws on quota: the plugin's save stops and nothing changes
      rebuild();
      return Promise.resolve(item);
    },
    removeItems: function (ids) {
      var map = readMap();
      ids.forEach(function (id) {
        var hit = snap.WORK_LOG.find(function (i) { return i.id === id; });
        if (hit) delete map[hit.date];
      });
      writeMap(map);
      rebuild();
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
    return h('header', { className: 'cl-topbar' }, h('h1', { className: 'cl-topbar-title' }, p.title), Extra ? h(Extra) : null);
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
    STORAGE_KEY: STORAGE_KEY, storage: storage, persistent: persistent, readMap: readMap, rebuild: rebuild, sdk: SDK,
    dirtyDates: function () { return Array.from(dirty).sort(); },
    discardDrafts: function () { if (SDK.__discardAll) SDK.__discardAll(); dirty.clear(); },
    // Import: copy the current raw value to worklog.v1.backup.<ts>, then write. On failure
    // (e.g. quota) worklog.v1 is untouched and the backup made for it is removed again.
    importLogs: function (logs, mode, now) {
      var raw = storage.getItem(STORAGE_KEY);
      var base = {};
      if (mode === 'merge' && raw) {
        try { var p = JSON.parse(raw); if (p && typeof p === 'object' && !Array.isArray(p)) base = p; } catch (e) { base = {}; }
      }
      var backupKey = null;
      if (raw) { backupKey = STORAGE_KEY + '.backup.' + (now || Date.now()); storage.setItem(backupKey, raw); }
      var map = Object.assign({}, base);
      logs.forEach(function (l) { map[l.date] = l; });
      try { storage.setItem(STORAGE_KEY, JSON.stringify(map)); }
      catch (e) { if (backupKey) storage.removeItem(backupKey); throw e; }
      return { backupKey: backupKey, total: Object.keys(map).length };
    },
  };
  rebuild();
})();
