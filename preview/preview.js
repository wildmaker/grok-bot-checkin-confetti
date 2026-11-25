const SUCCESS_TEXT = '已签到。';
const toasts = document.getElementById('toasts');
const live = document.getElementById('live');
const log = document.getElementById('log');
const HOST = '#grok-bot-checkin-host';
let toastSeq = 0;

function note(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  log.prepend(li);
  while (log.children.length > 12) log.lastChild.remove();
}

function addToast(text, role = 'status', ttl = 4500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', role);
  el.dataset.toast = String(++toastSeq);
  el.textContent = text;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), ttl);
  return el;
}

const actions = {
  success() {
    addToast(SUCCESS_TEXT);
    note('added a role="status" toast with the native success text');
  },
  'two-guests'() {
    addToast(SUCCESS_TEXT, 'status', 5500);
    setTimeout(() => addToast(SUCCESS_TEXT, 'status', 5500), 700);
    note('added two success toasts 0.7 s apart (two guests)');
  },
  remount() {
    const first = addToast(SUCCESS_TEXT, 'status', 6000);
    note('added a success toast, re-rendering it in 0.8 s');
    setTimeout(() => {
      if (!first.isConnected) return;
      const fresh = first.cloneNode(true);
      first.replaceWith(fresh);
      setTimeout(() => fresh.remove(), 3500);
      note('replaced the visible toast with an identical node (no second celebration expected)');
    }, 800);
  },
  repeat() {
    addToast('[Synthetic] Already checked in');
    note('added a made-up "already checked in" status (not Luma wording)');
  },
  failure() {
    addToast('[Synthetic] Not valid');
    note('added a made-up "not valid" status (not Luma wording)');
  },
  live(button) {
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    live.replaceChildren();
    if (on) {
      const clone = document.createElement('div');
      clone.className = 'live-clone';
      clone.setAttribute('aria-live', 'polite');
      clone.textContent = SUCCESS_TEXT;
      live.appendChild(clone);
    }
    note(on ? 'added a lingering aria-live clone (never counted)' : 'removed the aria-live clone');
  },
};

document.getElementById('actions').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (button) actions[button.dataset.action](button);
});

function readStats() {
  const host = document.querySelector(HOST);
  for (const name of ['celebrations', 'skipped', 'queued']) {
    document.getElementById(`stat-${name}`).textContent = host ? host.getAttribute(`data-${name}`) || '0' : 'n/a';
  }
}
setInterval(readStats, 200);
readStats();
note('demo ready: extension scripts loaded from ./extension/');
