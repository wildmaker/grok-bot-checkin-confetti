const test = require('node:test');
const assert = require('node:assert/strict');
const { isScanPath, isScanLocation, watchRoute } = require('../../src/route.js');

const loc = (href) => new URL(href);

test('isScanPath accepts only /check-in/<id>/scan', () => {
  assert.equal(isScanPath('/check-in/evt-ABC123/scan'), true);
  assert.equal(isScanPath('/check-in/evt-ABC123/scan/'), true);
  for (const p of ['/check-in/evt-ABC123', '/check-in/evt-ABC123/scan/extra', '/check-in//scan', '/check-in/evt-ABC123/scanner',
    '/event/evt-ABC123', '/x/check-in/evt-ABC123/scan', '/check-in/a/b/scan', '', undefined, null]) {
    assert.equal(isScanPath(p), false, String(p));
  }
});

test('isScanLocation requires https://luma.com and ignores query/hash', () => {
  assert.equal(isScanLocation(loc('https://luma.com/check-in/evt-X/scan')), true);
  assert.equal(isScanLocation(loc('https://luma.com/check-in/evt-X/scan?a=1#b')), true);
  assert.equal(isScanLocation(loc('https://luma.com:8443/check-in/evt-X/scan')), true);
  assert.equal(isScanLocation(loc('http://luma.com/check-in/evt-X/scan')), false);
  assert.equal(isScanLocation(loc('https://evil-luma.com/check-in/evt-X/scan')), false);
  assert.equal(isScanLocation(loc('https://luma.com.evil.test/check-in/evt-X/scan')), false);
  assert.equal(isScanLocation(loc('https://luma.com/event/evt-X')), false);
  assert.equal(isScanLocation(null), false);
});

function fakeWindow({ withNavigation }) {
  const listeners = {};
  const mk = () => ({
    addEventListener: (t, f) => ((listeners[t] = listeners[t] || new Set()).add(f)),
    removeEventListener: (t, f) => listeners[t] && listeners[t].delete(f),
  });
  const win = Object.assign(mk(), {
    location: { href: 'https://luma.com/event/evt-X' },
    intervals: new Map(),
    setInterval(fn) { const id = win.intervals.size + 1; win.intervals.set(id, fn); return id; },
    clearInterval(id) { win.intervals.delete(id); },
    emit: (target, type) => (listeners[type] || new Set()).forEach((f) => f()),
  });
  if (withNavigation) {
    const nav = mk();
    const navListeners = {};
    nav.addEventListener = (t, f) => ((navListeners[t] = navListeners[t] || new Set()).add(f));
    nav.removeEventListener = (t, f) => navListeners[t] && navListeners[t].delete(f);
    nav.fire = () => (navListeners.currententrychange || new Set()).forEach((f) => f());
    nav.count = () => (navListeners.currententrychange || new Set()).size;
    win.navigation = nav;
  }
  return win;
}

test('watchRoute uses Navigation API when available and reports each URL change once', () => {
  const win = fakeWindow({ withNavigation: true });
  const seen = [];
  const stop = watchRoute(win, (l) => seen.push(l.href));
  assert.equal(win.intervals.size, 0, 'no polling when Navigation API exists');
  win.location.href = 'https://luma.com/check-in/evt-X/scan';
  win.navigation.fire();
  win.navigation.fire();
  assert.deepEqual(seen, ['https://luma.com/check-in/evt-X/scan']);
  stop();
  assert.equal(win.navigation.count(), 0, 'listener removed');
  win.location.href = 'https://luma.com/event/evt-X';
  win.navigation.fire();
  assert.equal(seen.length, 1);
});

test('watchRoute falls back to popstate and a poll without Navigation API', () => {
  const win = fakeWindow({ withNavigation: false });
  const seen = [];
  const stop = watchRoute(win, (l) => seen.push(l.href));
  assert.equal(win.intervals.size, 1);
  win.location.href = 'https://luma.com/check-in/evt-X/scan';
  [...win.intervals.values()][0]();
  win.location.href = 'https://luma.com/event/evt-X';
  win.emit(win, 'popstate');
  assert.deepEqual(seen, ['https://luma.com/check-in/evt-X/scan', 'https://luma.com/event/evt-X']);
  stop();
  assert.equal(win.intervals.size, 0);
});
