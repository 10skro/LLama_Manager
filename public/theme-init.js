// Theme re-applier: runs synchronously during HTML parse, BEFORE any CSS is fetched.
// The Tauri initialization_script sets window.__INITIAL_THEME__ and window.__INITIAL_BG__
// in a blank document, but those DOM modifications are lost when the actual HTML loads.
// This external script (allowed by CSP script-src 'self') re-applies the theme
// using those persisted window variables, setting --background (HSL) inline on <html>
// which overrides the :root CSS declaration due to higher specificity.
(function () {
  var theme = window.__INITIAL_THEME__;
  var bg = window.__INITIAL_BG__;
  if (!theme || !bg) return;

  var el = document.documentElement;
  el.setAttribute('data-theme', theme);
  el.style.backgroundColor = bg;

  // Convert hex to HSL for CSS var(--background) used by Tailwind
  var h = bg.slice(1);
  var r = parseInt(h.substring(0, 2), 16) / 255;
  var g = parseInt(h.substring(2, 4), 16) / 255;
  var b = parseInt(h.substring(4, 6), 16) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  var l = (mx + mn) / 2, hh = 0, s = 0;
  if (mx !== mn) {
    var d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) hh = ((b - r) / d + 2) / 6;
    else hh = ((r - g) / d + 4) / 6;
  }
  el.style.setProperty('--background', Math.round(hh * 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%');
  console.log('[THEME-BOOT] ①.5 theme-init.js re-applied: theme=' + theme + ', --background=' + el.style.getPropertyValue('--background'));
})();
