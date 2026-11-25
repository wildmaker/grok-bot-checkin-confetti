/* SYNTHETIC fixture app. Mimics client-side routing only; contains no Luma markup. */
(function () {
  const app = document.getElementById('app');
  const SCAN = /^\/check-in\/[^/]+\/scan\/?$/;
  let clicks = 0;

  function scanView() {
    app.innerHTML =
      '<div class="cam" id="fake-camera"></div>' +
      '<div class="panel"><div id="counter-line"><span id="counter">0</span> synthetic-counter</div>' +
      '<button id="fake-btn" type="button">Synthetic button</button>' +
      '<div id="result-region" role="alert"></div><div id="click-count">0</div></div>';
    document.getElementById('fake-camera').addEventListener('click', () => bump());
    document.getElementById('fake-btn').addEventListener('click', () => bump());
    const preset = new URLSearchParams(location.search).get('preset');
    if (preset) window.__fx.setResult(preset, 'preset-guest');
  }

  function eventView() {
    app.innerHTML =
      '<div id="event-page"><h1>Synthetic event page</h1>' +
      '<div data-synthetic-result data-state="success" data-synthetic-token="off-route"></div>' +
      '<button id="to-scan" type="button">Go to scan</button></div>';
    document.getElementById('to-scan').addEventListener('click', () => window.__fx.goto('/check-in/evt-SYNTHETIC/scan'));
  }

  function bump() {
    clicks += 1;
    const el = document.getElementById('click-count');
    if (el) el.textContent = String(clicks);
  }

  function render() {
    if (SCAN.test(location.pathname)) scanView();
    else eventView();
  }

  function region() {
    return document.getElementById('result-region');
  }

  function markup(state, token) {
    return `<div data-synthetic-result data-state="${state}" data-synthetic-token="${token}">${state}</div>`;
  }

  window.__fx = {
    goto(path) {
      history.pushState({}, '', path);
      render();
    },
    setResult(state, token) {
      region().innerHTML = markup(state, token);
    },
    rerender() {
      const node = region().firstElementChild;
      if (!node) return;
      region().innerHTML = markup(node.getAttribute('data-state'), node.getAttribute('data-synthetic-token'));
    },
    clear() {
      region().innerHTML = '';
    },
    setCounter(n) {
      document.getElementById('counter').textContent = String(n);
    },
    clicks: () => clicks,
  };
  window.addEventListener('popstate', render);
  render();
})();
