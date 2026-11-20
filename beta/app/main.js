/* Boots the plugin's own view (WorkLogView) the way the CubeLV host would. */
(function () {
  'use strict';
  var PluginClass = window.__plugin__.WorkLogPlugin;
  var p = new PluginClass();
  p.onload();
  var viewDef = p.folderTypes[0].views[0];
  var view = viewDef.creator({ id: 'leaf-work-log' });
  ReactDOM.createRoot(document.getElementById('root')).render(view.renderComponent());
})();
