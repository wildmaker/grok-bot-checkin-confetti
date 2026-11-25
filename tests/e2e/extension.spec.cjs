/* The shipped extension (dist/extension) in real Chromium against local fixtures. Never contacts Luma. */
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startServer, launch, watchErrors, hostCount, stat, fx, sleep, HOST } = require('./helpers.cjs');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(() => server.close());

async function open(opts) {
  const env = await launch(server.port, opts);
  const page = await env.context.newPage();
  const errors = watchErrors(page);
  return { ...env, page, errors };
}

test('loads as MV3, mounts on the scan route only, no console errors', async () => {
  const { context, page, errors, eventUrl, scanUrl } = await open();
  await page.goto(eventUrl);
  await sleep(300);
  expect(await hostCount(page)).toBe(0);
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelectorAll('.bot').length, HOST)).toBe(4);
  for (const other of ['/check-in/evt-SYNTHETIC', '/check-in/evt-SYNTHETIC/scan/extra', '/e/abc']) {
    await page.goto(new URL(other, eventUrl).href);
    await sleep(200);
    expect(await hostCount(page)).toBe(0);
  }
  expect(errors).toEqual([]);
  await context.close();
});

test('SPA entry from /event and exit are handled; re-entry leaves exactly one host', async () => {
  const { context, page, errors, eventUrl } = await open();
  await page.goto(eventUrl);
  await page.click('#to-scan');
  await expect.poll(() => hostCount(page)).toBe(1);
  await fx(page, 'goto', '/event/evt-SYNTHETIC');
  await expect.poll(() => hostCount(page)).toBe(0);
  await fx(page, 'goto', '/check-in/evt-SYNTHETIC/scan');
  await expect.poll(() => hostCount(page)).toBe(1);
  await page.goBack();
  await expect.poll(() => hostCount(page)).toBe(0);
  await page.goForward();
  await expect.poll(() => hostCount(page)).toBe(1);
  for (let i = 0; i < 5; i++) {
    await fx(page, 'goto', '/event/evt-SYNTHETIC');
    await fx(page, 'goto', '/check-in/evt-SYNTHETIC/scan');
  }
  await expect.poll(() => hostCount(page)).toBe(1);
  expect(errors).toEqual([]);
  await context.close();
});

test('overlay never intercepts pointer input or covers the camera or status UI', async () => {
  const { context, page, scanUrl } = await open();
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);

  const hits = await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    const rects = [...host.shadowRoot.querySelectorAll('.bot')].map((b) => b.getBoundingClientRect());
    const cam = document.getElementById('fake-camera').getBoundingClientRect();
    const result = document.getElementById('row-status').getBoundingClientRect();
    const points = [
      ...rects.filter((r) => r.width > 0).map((r) => [r.left + r.width / 2, r.top + r.height / 2]),
      [cam.left + cam.width / 2, cam.top + cam.height / 2],
      [result.left + result.width / 2, result.top + result.height / 2],
    ];
    return points.map(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return { id: el && el.id, isHost: el === host };
    });
  }, HOST);
  expect(hits.length).toBeGreaterThanOrEqual(5);
  expect(hits.every((h) => !h.isHost)).toBe(true);

  const botCenter = await page.evaluate((sel) => {
    const r = document.querySelector(sel).shadowRoot.querySelector('.bot').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, HOST);
  await page.mouse.click(botCenter.x, botCenter.y);
  expect(await page.evaluate(() => window.__fx.clicks())).toBe(1);
  await page.click('#fake-btn');
  expect(await page.evaluate(() => window.__fx.clicks())).toBe(2);

  const styles = await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    const cs = getComputedStyle(host);
    const sr = host.shadowRoot;
    return {
      host: cs.pointerEvents,
      stage: getComputedStyle(sr.querySelector('.stage')).pointerEvents,
      bots: [...sr.querySelectorAll('.bot')].map((b) => getComputedStyle(b).pointerEvents),
      controls: getComputedStyle(sr.querySelector('.controls')).pointerEvents,
    };
  }, HOST);
  expect(styles.host).toBe('none');
  expect(styles.stage).toBe('none');
  expect(styles.bots.every((v) => v === 'none')).toBe(true);
  expect(styles.controls).toBe('auto');
  await context.close();
});

test('pause and hide controls work, persist across reload, and reset cleanly', async () => {
  const { context, page, scanUrl } = await open();
  await page.goto(scanUrl());
  const pause = page.locator(`${HOST} button[data-action=pause]`);
  const hide = page.locator(`${HOST} button[data-action=hide]`);
  const animState = () => page.evaluate((s) => getComputedStyle(document.querySelector(s).shadowRoot.querySelector('.bot')).animationPlayState, HOST);
  await expect(pause).toHaveText('Pause bots');
  expect(await animState()).toBe('running');
  await pause.click();
  await expect(pause).toHaveText('Resume bots');
  expect(await animState()).toBe('paused');
  await page.reload();
  await expect(page.locator(`${HOST} button[data-action=pause]`)).toHaveText('Resume bots');
  await page.locator(`${HOST} button[data-action=pause]`).click();
  expect(await animState()).toBe('running');

  await hide.click();
  await expect(hide).toHaveText('Show bots');
  const botDisplay = () => page.evaluate((s) => getComputedStyle(document.querySelector(s).shadowRoot.querySelector('.bot')).display, HOST);
  expect(await botDisplay()).toBe('none');
  await page.reload();
  await expect.poll(() => botDisplay()).toBe('none');
  await page.locator(`${HOST} button[data-action=hide]`).click();
  expect(await botDisplay()).toBe('block');
  await context.close();
});

test('prefers-reduced-motion disables drift; normal motion drifts', async () => {
  const { context, page, scanUrl } = await open();
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);
  const animName = () => page.evaluate((s) => getComputedStyle(document.querySelector(s).shadowRoot.querySelector('.bot')).animationName, HOST);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await animName()).toBe('drift');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await animName()).toBe('none');
  await context.close();
});

test('styles are namespaced: page CSS cannot restyle the overlay and the overlay does not leak styles', async () => {
  const { context, page, scanUrl } = await open();
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);
  const info = await page.evaluate((sel) => {
    const hostile = new CSSStyleSheet();
    hostile.replaceSync('div,span,button,svg,path,.bot,.stage{display:none !important;opacity:0 !important;pointer-events:auto !important}');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, hostile];
    const host = document.querySelector(sel);
    const bot = host.shadowRoot.querySelector('.bot');
    return {
      botStillRendered: getComputedStyle(bot).display === 'block' && bot.getBoundingClientRect().width > 0,
      botPointer: getComputedStyle(bot).pointerEvents,
      shadowSheets: host.shadowRoot.adoptedStyleSheets.length,
      docSheetsAddedByExt: [...document.styleSheets].filter((s) => (s.ownerNode && s.ownerNode.textContent || '').includes('.bot')).length,
      hostPointer: getComputedStyle(host).pointerEvents,
    };
  }, HOST);
  expect(info.botStillRendered).toBe(true);
  expect(info.botPointer).toBe('none');
  expect(info.shadowSheets).toBe(1);
  expect(info.docSheetsAddedByExt).toBe(0);
  expect(info.hostPointer).toBe('none');
  await context.close();
});

test('responsive: fewer bots on narrow viewports and none inside the central scan area', async () => {
  const { context, page, scanUrl } = await open({ viewport: { width: 390, height: 844 } });
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);
  const info = await page.evaluate((sel) => {
    const bots = [...document.querySelector(sel).shadowRoot.querySelectorAll('.bot')].filter((b) => getComputedStyle(b).display !== 'none');
    const panel = document.querySelector('.panel').getBoundingClientRect();
    let overlapsPanel = false;
    for (const phase of [0, 1]) {
      for (const b of bots) {
        const anim = b.getAnimations()[0];
        anim.pause();
        anim.currentTime = phase ? anim.effect.getTiming().duration : 0;
        const r = b.getBoundingClientRect();
        if (r.right > panel.left && r.left < panel.right && r.bottom > panel.top && r.top < panel.bottom) overlapsPanel = true;
      }
    }
    return { visible: bots.length, overlapsPanel };
  }, HOST);
  expect(info.visible).toBe(2);
  expect(info.overlapsPanel).toBe(false);
  await page.screenshot({ path: 'docs/evidence/fixture-mobile-idle.png' });
  await context.close();
});

async function openScan(opts) {
  const env = await open(opts);
  await env.page.goto(env.scanUrl(opts && opts.query));
  await expect.poll(() => hostCount(env.page)).toBe(1);
  return env;
}

// ---- Celebration behaviour: only Luma's native role="status" "已签到。" toast counts ----

const celebrations = (page) => stat(page, 'celebrations');
const idle = (page) =>
  expect.poll(async () => (await stat(page, 'particles')) === 0 && (await stat(page, 'queued')) === 0, { timeout: 60_000 }).toBe(true);
const toast = (page, ...a) => page.evaluate((args) => window.__fx.toast(...args), a);
const call = (page, fn, ...a) => page.evaluate(([f, args]) => window.__fx[f](...args), [fn, a]);

test('native success toast -> exactly one celebration; DOM drains afterwards', async () => {
  const { context, page, errors } = await openScan();
  expect(await celebrations(page)).toBe(0);
  await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
  expect(await stat(page, 'particles')).toBeLessThanOrEqual(160);
  await idle(page);
  await sleep(250);
  expect(await celebrations(page)).toBe(1);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelector('.stage').childElementCount, HOST)).toBe(4);
  expect(errors).toEqual([]);
  await context.close();
});

test('toast filled after mount, rewritten, and re-rendered with row/counter/button updates: still one', async () => {
  const { context, page } = await openScan();
  const id = await toast(page, null);
  await sleep(150);
  expect(await celebrations(page)).toBe(0);
  await call(page, 'fill', id);
  await expect.poll(() => celebrations(page)).toBe(1);
  for (let i = 0; i < 5; i++) { await call(page, 'rewrite', id); await sleep(70); }
  await call(page, 'markRowCheckedIn');
  await idle(page);
  await sleep(300);
  expect(await celebrations(page)).toBe(1);
  await context.close();
});

test('transient toast followed by the persistent aria-live clone does not double-celebrate', async () => {
  for (const overlap of [false, true]) {
    const { context, page } = await openScan();
    const id = await toast(page);
    if (overlap) await call(page, 'live');
    await expect.poll(() => celebrations(page)).toBe(1);
    await sleep(100);
    await call(page, 'dismiss', id);
    await sleep(150);
    if (!overlap) await call(page, 'live');
    await sleep(500);
    await call(page, 'live');
    await idle(page);
    await sleep(300);
    expect(await celebrations(page)).toBe(1);
    await context.close();
  }
});

test('the aria-live clone alone, near-miss texts and wrong roles never celebrate', async () => {
  const { context, page } = await openScan();
  await call(page, 'live');
  await call(page, 'markRowCheckedIn');
  for (const [text, role] of [['已签到', 'status'], ['已签到。 撤销', 'status'], ['已签到。', 'alert'], ['Checked in.', 'status'], ['已撤销签到。', 'status'], ['', 'status']]) {
    await toast(page, text, role);
    await sleep(100);
  }
  await sleep(300);
  expect(await celebrations(page)).toBe(0);
  await context.close();
});

test('a toast already on screen at load, or before entering the scan route, is not celebrated', async () => {
  const preset = await openScan({ query: '?preset=status' });
  await sleep(500);
  expect(await celebrations(preset.page)).toBe(0);
  await preset.context.close();

  const { context, page, eventUrl } = await openScan();
  await call(page, 'goto', '/event/evt-SYNTHETIC');
  await expect.poll(() => hostCount(page)).toBe(0);
  const old = await toast(page);
  await sleep(200);
  await call(page, 'goto', '/check-in/evt-SYNTHETIC/scan');
  await expect.poll(() => hostCount(page)).toBe(1);
  await sleep(500);
  expect(await celebrations(page)).toBe(0);
  await call(page, 'dismiss', old);
  await sleep(150);
  await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  await context.close();
});

test('SUPPORTED: React remount of the same visible toast does not duplicate', async () => {
  const { context, page } = await openScan();
  const id = await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  for (let i = 0; i < 3; i++) { await call(page, 'remount', id); await sleep(120); }
  await idle(page);
  await sleep(300);
  expect(await celebrations(page)).toBe(1);
  await context.close();
});

test('SUPPORTED: same node cleared, then success again counts again', async () => {
  const { context, page } = await openScan();
  const id = await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  await idle(page);
  await call(page, 'clear', id);
  await sleep(200);
  await call(page, 'fill', id);
  await expect.poll(() => celebrations(page), { timeout: 10_000 }).toBe(2);
  await idle(page);
  await sleep(300);
  expect(await celebrations(page)).toBe(2);
  await context.close();
});

test('SUPPORTED: persistent aria-live clone never counts; each transient toast recurrence counts', async () => {
  const { context, page } = await openScan();
  await call(page, 'live');
  for (let i = 1; i <= 3; i++) {
    const id = await toast(page);
    await expect.poll(() => celebrations(page), { timeout: 15_000 }).toBe(i);
    await sleep(100);
    await call(page, 'dismiss', id);
    await call(page, 'live');
    await idle(page);
    await sleep(200);
  }
  expect(await celebrations(page)).toBe(3);
  await context.close();
});

test('AMBIGUOUS (counted once): a different guest whose identical toast replaces the visible one in one step', async () => {
  const { context, page } = await openScan();
  const id = await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  await page.evaluate((i) => { window.__fx.dismiss(i); window.__fx.toast(); }, id);
  await idle(page);
  await sleep(300);
  expect(await celebrations(page)).toBe(1);
  await context.close();
});

test('different guests each count: overlapping toasts, sequential toasts, with a persistent clone throughout', async () => {
  test.setTimeout(60_000);
  const { context, page } = await openScan();
  await call(page, 'live');
  const a = await toast(page);
  await sleep(80);
  const b = await toast(page);
  await expect.poll(() => celebrations(page), { timeout: 10_000 }).toBe(2);
  await call(page, 'dismiss', a);
  await sleep(150);
  expect(await celebrations(page)).toBe(2);
  await call(page, 'dismiss', b);
  await idle(page);
  await sleep(150);
  await toast(page);
  await expect.poll(() => celebrations(page), { timeout: 10_000 }).toBe(3);
  await idle(page);
  await sleep(300);
  expect(await celebrations(page)).toBe(3);
  await context.close();
});

test('leaving and re-entering the scan route neither double counts nor leaks observers', async () => {
  const { context, page } = await openScan();
  for (let i = 0; i < 3; i++) {
    await call(page, 'goto', '/event/evt-SYNTHETIC');
    await expect.poll(() => hostCount(page)).toBe(0);
    await call(page, 'goto', '/check-in/evt-SYNTHETIC/scan');
    await expect.poll(() => hostCount(page)).toBe(1);
  }
  await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  await idle(page);
  await sleep(300);
  expect(await celebrations(page)).toBe(1);
  await context.close();
});

test('reduced motion: success is acknowledged without particles', async () => {
  const { context, page } = await openScan();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  expect(await stat(page, 'particles')).toBe(0);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelectorAll('.p').length, HOST)).toBe(0);
  await context.close();
});

test('paused or hidden bots skip celebrations', async () => {
  const { context, page } = await openScan();
  await page.locator(`${HOST} button[data-action=pause]`).click();
  await toast(page);
  await expect.poll(() => stat(page, 'skipped')).toBe(1);
  await page.locator(`${HOST} button[data-action=pause]`).click();
  await page.locator(`${HOST} button[data-action=hide]`).click();
  await toast(page);
  await expect.poll(() => stat(page, 'skipped')).toBe(2);
  expect(await celebrations(page)).toBe(0);
  await context.close();
});

test('bounded under a burst: pending cap, <=160 particles, DOM drains', async () => {
  test.setTimeout(120_000);
  const { context, page } = await openScan();
  await page.evaluate((s) => {
    window.__maxParticles = 0;
    const host = document.querySelector(s);
    new MutationObserver(() => { window.__maxParticles = Math.max(window.__maxParticles, Number(host.getAttribute('data-particles'))); })
      .observe(host, { attributes: true });
  }, HOST);
  for (let i = 0; i < 12; i++) { await toast(page); await sleep(80); }
  await expect.poll(() => stat(page, 'dropped')).toBeGreaterThan(0);
  await expect.poll(() => celebrations(page), { timeout: 60_000 }).toBe(7);
  await idle(page);
  expect(await page.evaluate(() => window.__maxParticles)).toBeLessThanOrEqual(160);
  expect(await stat(page, 'dropped')).toBe(12 - 7);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelector('.stage').childElementCount, HOST)).toBe(4);
  await context.close();
});

test('celebration does not interfere with the page UI', async () => {
  const { context, page } = await openScan();
  await toast(page);
  await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
  await page.click('#fake-btn');
  await page.mouse.click(40, 700);
  expect(await page.evaluate(() => window.__fx.clicks())).toBe(2);
  const covered = await page.evaluate((s) => {
    const host = document.querySelector(s);
    return [...host.shadowRoot.querySelectorAll('.p')].slice(0, 20).some((p) => {
      const r = p.getBoundingClientRect();
      return document.elementFromPoint(r.left + 1, r.top + 1) === host;
    });
  }, HOST);
  expect(covered).toBe(false);
  await context.close();
});

test('evidence: fixture screenshots mid-celebration (desktop and mobile)', async () => {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const { context, page } = await openScan({ viewport });
    await toast(page);
    await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
    await sleep(450);
    await page.screenshot({ path: `docs/evidence/fixture-${name}-celebration.png` });
    await context.close();
  }
});

test('evidence: synthetic preview video (fixture is bannered as synthetic)', async () => {
  test.setTimeout(60_000);
  const dir = path.join(__dirname, '../../test-results/preview');
  const env = await launch(server.port, { recordVideoDir: dir });
  const page = await env.context.newPage();
  await page.goto(env.scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);
  await sleep(1500);
  const a = await toast(page);
  await expect.poll(() => celebrations(page)).toBe(1);
  await sleep(1200);
  await toast(page);
  await expect.poll(() => celebrations(page)).toBe(2);
  await call(page, 'live');
  await call(page, 'dismiss', a);
  await idle(page);
  await sleep(800);
  await page.close();
  await page.video().saveAs(path.join(dir, 'synthetic-preview.webm'));
  await env.context.close();
});
