/* Production build (unverified, fail-closed profile) against SYNTHETIC fixtures. */
const { test, expect } = require('@playwright/test');
const { startServer, launch, watchErrors, hostCount, stat, fx, sleep, HOST } = require('./helpers.cjs');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(() => server.close());

async function open(opts) {
  const env = await launch('prod', server.port, opts);
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

test('overlay never intercepts pointer input or covers the camera/result region', async () => {
  const { context, page, scanUrl } = await open();
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);

  const hits = await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    const rects = [...host.shadowRoot.querySelectorAll('.bot')].map((b) => b.getBoundingClientRect());
    const cam = document.getElementById('fake-camera').getBoundingClientRect();
    const result = document.getElementById('result-region').getBoundingClientRect();
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

test('production detector is fail-closed: success-looking text, counters and markers never celebrate', async () => {
  const { context, page, scanUrl } = await open();
  await page.goto(scanUrl());
  await expect.poll(() => hostCount(page)).toBe(1);
  await page.evaluate(() => {
    const region = document.getElementById('result-region');
    region.innerHTML = '<div data-synthetic-result data-state="success" data-synthetic-token="x">Checked in</div>';
    document.getElementById('counter').textContent = '1';
    document.getElementById('counter-line').append(' checked in');
  });
  await fx(page, 'setResult', 'success', 'another');
  await fx(page, 'setCounter', 2);
  await sleep(600);
  expect(await stat(page, 'celebrations')).toBe(0);
  expect(await stat(page, 'particles')).toBe(0);
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
  await page.screenshot({ path: 'docs/evidence/synthetic-mobile-idle.png' });
  await context.close();
});
