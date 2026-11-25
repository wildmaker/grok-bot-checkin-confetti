/*
 * Fixture app: a tiny client-side router plus generic localized UI strings that mirror the
 * *kinds* of nodes seen in the native UI (role=status toast, aria-live clone, counters, row
 * status, revoke button). It contains no guest data and no captured Luma markup.
 */
(function () {
  const app = document.getElementById('app');
  const SCAN = /^\/check-in\/[^/]+\/scan\/?$/;
  const toasts = document.getElementById('toasts');
  const live = document.getElementById('live');
  let clicks = 0;
  let toastSeq = 0;

  function scanView() {
    app.innerHTML =
      '<div class="cam" id="fake-camera"></div>' +
      '<div class="panel"><div id="counter-line">已签到 <span id="counter">0</span></div>' +
      '<button id="fake-btn" type="button">签到</button>' +
      '<div id="row-status">参加</div><div id="click-count">0</div></div>';
    document.getElementById('fake-camera').addEventListener('click', () => bump());
    document.getElementById('fake-btn').addEventListener('click', () => bump());
    const preset = new URLSearchParams(location.search).get('preset');
    if (preset === 'status') window.__fx.toast();
    if (preset === 'live') window.__fx.live();
  }

  function eventView() {
    app.innerHTML = '<div id="event-page"><h1>Event page</h1><button id="to-scan" type="button">Go to scan</button></div>';
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

  window.__fx = {
    goto(path) {
      history.pushState({}, '', path);
      render();
    },
    toast(text = '已签到。', role = 'status') {
      const el = document.createElement('div');
      el.setAttribute('role', role);
      el.dataset.toast = String(++toastSeq);
      if (text !== null) el.textContent = text;
      toasts.appendChild(el);
      return toastSeq;
    },
    fill(id, text = '已签到。') {
      toasts.querySelector(`[data-toast="${id}"]`).textContent = text;
    },
    rewrite(id) {
      const el = toasts.querySelector(`[data-toast="${id}"]`);
      el.textContent = el.textContent;
    },
    remount(id) {
      const el = toasts.querySelector(`[data-toast="${id}"]`);
      const fresh = el.cloneNode(true);
      el.replaceWith(fresh);
    },
    clear(id) {
      toasts.querySelector(`[data-toast="${id}"]`).textContent = '';
    },
    dismiss(id) {
      const el = toasts.querySelector(`[data-toast="${id}"]`);
      if (el) el.remove();
    },
    live(text = '已签到。') {
      live.innerHTML = '';
      const el = document.createElement('div');
      el.setAttribute('aria-live', 'polite');
      el.textContent = text;
      live.appendChild(el);
    },
    clearLive() {
      live.innerHTML = '';
    },
    markRowCheckedIn() {
      document.getElementById('row-status').textContent = '已签到 现在';
      document.getElementById('fake-btn').textContent = '撤销签到';
      document.getElementById('counter').textContent = String(Number(document.getElementById('counter').textContent) + 1);
    },
    clicks: () => clicks,
  };
  window.addEventListener('popstate', render);
  render();
})();
