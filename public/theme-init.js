// Anti-flash: runs synchronously during HTML parse, BEFORE any CSS is fetched.
// Sets background color on html, body, #root to match the WebView's background_color.
// This eliminates the brief flash between WebView creation and CSS load.
// The style tag is removed by applyTheme() once React mounts.
(function(){
  var theme = window.__INITIAL_THEME__ || {name:'catppuccin-mocha',bg:'#1e1e2e',fg:'#cdd6f4'};
  document.documentElement.setAttribute('data-theme', theme.name);
  var s = document.createElement('style');
  s.setAttribute('data-theme-init', 'true');
  s.textContent = 'html,body,#root{background-color:'+theme.bg+'!important;color:'+theme.fg+'!important}';
  document.head.appendChild(s);
})();
