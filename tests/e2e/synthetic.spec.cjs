/*
 * Test build (SYNTHETIC detection profile) against SYNTHETIC fixtures.
 * These tests prove the overlay/detector plumbing only. They are NOT evidence about Luma's real DOM.
 */
const { test, expect } = require('@playwright/test');
const { startServer, launch, watchErrors, hostCount, stat, fx, sleep, HOST } = require('./helpers.cjs');

let server;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(() => server.close());

async function open(opts) {
  const env = await launch('test', server.port, opts);
  const page = await env.context.newPage();
  const errors = watchErrors(page);
  await page.goto(env.scanUrl(opts && opts.query));
  await expect.poll(() => hostCount(page)).toBe(1);
  return { ...env, page, errors };
}

const idle = (page) => expect.poll(async () => (await stat(page, 'particles')) === 0 && (await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelectorAll('.confetti').length, HOST)) === 0, { timeout: 10_000 }).toBe(true);
const settle = () => sleep(250);

test('one success -> exactly one celebration, then DOM returns to baseline', async () => {
  const { context, page, errors } = await open();
  expect(await stat(page, 'celebrations')).toBe(0);
  await fx(page, 'setResult', 'success', 'guest-1');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
  expect(await stat(page, 'particles')).toBeLessThanOrEqual(48);
  await idle(page);
  await settle();
  expect(await stat(page, 'celebrations')).toBe(1);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelector('.stage').childElementCount, HOST)).toBe(4);
  expect(errors).toEqual([]);
  await context.close();
});

test('failure, duplicate, pending, no-match and ambiguous states never celebrate', async () => {
  const { context, page } = await open();
  for (const state of ['failure', 'duplicate', 'pending', 'nomatch']) {
    await fx(page, 'setResult', state, 'g');
    await sleep(120);
  }
  await page.evaluate(() => {
    document.getElementById('result-region').innerHTML =
      '<div data-synthetic-result data-state="success" data-synthetic-token="a"></div><div data-synthetic-result data-state="failure" data-synthetic-token="a"></div>';
  });
  await sleep(300);
  expect(await stat(page, 'celebrations')).toBe(0);
  await context.close();
});

test('rerenders of a displayed success do not repeat the celebration', async () => {
  const { context, page } = await open();
  await fx(page, 'setResult', 'success', 'guest-r');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  for (let i = 0; i < 6; i++) { await fx(page, 'rerender'); await sleep(70); }
  await page.evaluate(() => { document.getElementById('result-region').title = 'x'; document.getElementById('counter').textContent = '9'; });
  await sleep(300);
  expect(await stat(page, 'celebrations')).toBe(1);
  await context.close();
});

test('two different guests back to back are both celebrated; a later guest is celebrated too', async () => {
  const { context, page } = await open();
  await fx(page, 'setResult', 'success', 'guest-a');
  await sleep(80);
  await fx(page, 'setResult', 'success', 'guest-b');
  await expect.poll(() => stat(page, 'celebrations'), { timeout: 10_000 }).toBe(2);
  await idle(page);
  await fx(page, 'clear');
  await sleep(150);
  await fx(page, 'setResult', 'success', 'guest-c');
  await expect.poll(() => stat(page, 'celebrations'), { timeout: 10_000 }).toBe(3);
  await idle(page);
  await settle();
  expect(await stat(page, 'celebrations')).toBe(3);
  await context.close();
});

test('success -> duplicate for the same guest does not add a celebration', async () => {
  const { context, page } = await open();
  await fx(page, 'setResult', 'success', 'guest-d');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  await fx(page, 'setResult', 'duplicate', 'guest-d');
  await sleep(300);
  expect(await stat(page, 'celebrations')).toBe(1);
  await context.close();
});

test('a success already on screen when the page loads is not celebrated', async () => {
  const { context, page } = await open({ query: '?preset=success' });
  await sleep(500);
  expect(await stat(page, 'celebrations')).toBe(0);
  await fx(page, 'setResult', 'success', 'next-guest');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  await context.close();
});

test('off-route success markers are ignored; leaving and re-entering does not double count', async () => {
  const { context, page, eventUrl } = await open();
  await fx(page, 'goto', '/event/evt-SYNTHETIC');
  await expect.poll(() => hostCount(page)).toBe(0);
  await sleep(300);
  for (let i = 0; i < 3; i++) {
    await fx(page, 'goto', '/check-in/evt-SYNTHETIC/scan');
    await expect.poll(() => hostCount(page)).toBe(1);
    await fx(page, 'goto', '/event/evt-SYNTHETIC');
    await expect.poll(() => hostCount(page)).toBe(0);
  }
  await fx(page, 'goto', '/check-in/evt-SYNTHETIC/scan');
  await expect.poll(() => hostCount(page)).toBe(1);
  await fx(page, 'setResult', 'success', 'after-reentry');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  await sleep(500);
  expect(await stat(page, 'celebrations')).toBe(1);
  await context.close();
});

test('reduced motion: success is acknowledged without particles or movement', async () => {
  const { context, page } = await open();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fx(page, 'setResult', 'success', 'guest-rm');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  expect(await stat(page, 'particles')).toBe(0);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelectorAll('.p').length, HOST)).toBe(0);
  await context.close();
});

test('paused or hidden bots skip celebrations instead of animating', async () => {
  const { context, page } = await open();
  await page.locator(`${HOST} button[data-action=pause]`).click();
  await fx(page, 'setResult', 'success', 'guest-p');
  await expect.poll(() => stat(page, 'skipped')).toBe(1);
  expect(await stat(page, 'celebrations')).toBe(0);
  await page.locator(`${HOST} button[data-action=pause]`).click();
  await page.locator(`${HOST} button[data-action=hide]`).click();
  await fx(page, 'setResult', 'success', 'guest-h');
  await expect.poll(() => stat(page, 'skipped')).toBe(2);
  expect(await stat(page, 'celebrations')).toBe(0);
  await context.close();
});

test('bounded under a burst: queue caps pending work, particles never exceed 48, DOM drains', async () => {
  test.setTimeout(120_000);
  const { context, page } = await open();
  await page.evaluate((s) => {
    window.__maxParticles = 0;
    const host = document.querySelector(s);
    new MutationObserver(() => { window.__maxParticles = Math.max(window.__maxParticles, Number(host.getAttribute('data-particles'))); })
      .observe(host, { attributes: true });
  }, HOST);
  for (let i = 0; i < 14; i++) { await fx(page, 'setResult', 'success', `burst-${i}`); await sleep(80); }
  await expect.poll(() => stat(page, 'dropped')).toBeGreaterThan(0);
  const started = await stat(page, 'celebrations');
  await expect.poll(async () => (await stat(page, 'celebrations')) + (await stat(page, 'skipped')), { timeout: 60_000 }).toBeLessThanOrEqual(7);
  await expect.poll(() => stat(page, 'celebrations'), { timeout: 60_000 }).toBe(7);
  await idle(page);
  expect(await page.evaluate(() => window.__maxParticles)).toBeLessThanOrEqual(48);
  expect(await stat(page, 'dropped')).toBe(14 - 7);
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelector('.stage').childElementCount, HOST)).toBe(4);
  expect(started).toBeGreaterThanOrEqual(1);
  await context.close();
});

test('the extension does not interfere with the page scan UI during a celebration', async () => {
  const { context, page } = await open();
  await fx(page, 'setResult', 'success', 'guest-ui');
  await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
  await page.click('#fake-btn');
  const point = await page.evaluate(() => { const r = document.getElementById('fake-camera').getBoundingClientRect(); return [r.width / 2, r.height / 2]; });
  await page.mouse.click(point[0], point[1] + 150);
  expect(await page.evaluate(() => window.__fx.clicks())).toBe(2);
  const topEl = await page.evaluate((s) => {
    const host = document.querySelector(s);
    const ps = [...host.shadowRoot.querySelectorAll('.p')].slice(0, 20).map((p) => p.getBoundingClientRect());
    return ps.some((r) => document.elementFromPoint(r.left + 1, r.top + 1) === host);
  }, HOST);
  expect(topEl).toBe(false);
  await context.close();
});

test('evidence: synthetic screenshots mid-celebration (desktop and mobile)', async () => {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const { context, page } = await open({ viewport });
    await fx(page, 'setResult', 'success', 'guest-shot');
    await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
    await sleep(450);
    await page.screenshot({ path: `docs/evidence/synthetic-${name}-celebration.png` });
    await context.close();
  }
});
