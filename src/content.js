/* Controller: route lifecycle, success watching, settings persistence. */
(async function () {
  const G = globalThis.GrokBotCheckin;
  if (!G || G.started) return;
  G.started = true;

  const STORAGE_KEY = 'settings';
  const EVAL_INTERVAL_MS = 50;
  let overlay = null;
  let mounting = false;
  let observer = null;
  let evalTimer = null;

  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const value = stored[STORAGE_KEY] || {};
      return { paused: value.paused === true, hidden: value.hidden === true };
    } catch {
      return { paused: false, hidden: false };
    }
  }

  async function saveSettings(settings) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: { paused: settings.paused, hidden: settings.hidden } });
    } catch {
      /* extension context may be invalidated after an update; settings stay in-memory */
    }
  }

  function startWatching() {
    const detector = G.createDetector(G.profile, () => {
      if (overlay) overlay.celebrate();
    });
    if (!detector.enabled) return;
    detector.prime(document);
    observer = new MutationObserver((records) => {
      if (!overlay || evalTimer) return;
      if (records.every((r) => overlay.contains(r.target))) return;
      evalTimer = setTimeout(() => {
        evalTimer = null;
        detector.evaluate(document);
      }, EVAL_INTERVAL_MS);
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }

  function stopWatching() {
    if (observer) observer.disconnect();
    observer = null;
    if (evalTimer) clearTimeout(evalTimer);
    evalTimer = null;
  }

  async function mount() {
    if (overlay || mounting) return;
    mounting = true;
    const settings = await loadSettings();
    mounting = false;
    if (overlay || !G.isScanLocation(location)) return;
    overlay = G.createOverlay({
      document,
      settings,
      art: G.botArt,
      botShapes: G.botShapes,
      cssText: G.overlayCss,
      onSettingsChange: saveSettings,
    });
    startWatching();
  }

  function unmount() {
    stopWatching();
    if (overlay) overlay.destroy();
    overlay = null;
  }

  function sync() {
    if (G.isScanLocation(location)) mount();
    else unmount();
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY] || !overlay) return;
      const value = changes[STORAGE_KEY].newValue || {};
      overlay.setSettings({ paused: value.paused === true, hidden: value.hidden === true });
    });
  } catch {
    /* storage unavailable: controls still work for the current page */
  }

  G.watchRoute(window, sync);
  sync();
})();
