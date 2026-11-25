/* Route gating: pure functions, no DOM access. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCAN_PATH = /^\/check-in\/[^/]+\/scan\/?$/;

  function isScanPath(pathname) {
    return typeof pathname === 'string' && SCAN_PATH.test(pathname);
  }

  function isScanLocation(loc) {
    return !!loc && loc.protocol === 'https:' && loc.hostname === 'luma.com' && isScanPath(loc.pathname);
  }

  /**
   * Calls onChange(location) whenever the document URL changes without a reload.
   * Uses the Navigation API when present and falls back to popstate/hashchange plus a
   * slow URL poll, so client-side routing is handled without patching history methods.
   */
  function watchRoute(win, onChange, pollMs) {
    let last = win.location.href;
    const check = () => {
      const href = win.location.href;
      if (href === last) return;
      last = href;
      onChange(win.location);
    };
    const cleanups = [];
    const listen = (target, type) => {
      target.addEventListener(type, check);
      cleanups.push(() => target.removeEventListener(type, check));
    };
    if (win.navigation && typeof win.navigation.addEventListener === 'function') {
      listen(win.navigation, 'currententrychange');
    } else {
      const timer = win.setInterval(check, pollMs || 750);
      cleanups.push(() => win.clearInterval(timer));
    }
    listen(win, 'popstate');
    listen(win, 'hashchange');
    listen(win, 'pageshow');
    return () => cleanups.splice(0).forEach((fn) => fn());
  }

  return { isScanPath, isScanLocation, watchRoute };
});
