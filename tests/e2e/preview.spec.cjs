/* Runs the released preview ZIP exactly as a user would: unzip, ./start.sh, open in a browser. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '../..');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const HOST = '#grok-bot-checkin-host';
let server;
let dir;
let origin;

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
  execFileSync('unzip', ['-q', path.join(ROOT, `release/grok-bot-checkin-confetti-preview-v${version}.zip`), '-d', dir]);
  dir = path.join(dir, 'grok-bot-confetti-preview');
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  server = spawn('./start.sh', [String(port)], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('http://') && resolve());
    server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
    setTimeout(() => reject(new Error('server start timeout')), 10_000);
  });
});
test.afterAll(() => server && server.kill());

async function open(page, viewport) {
  const external = [];
  const errors = [];
  if (viewport) await page.setViewportSize(viewport);
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(origin)) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${origin}/`);
  await expect(page.locator(HOST)).toHaveCount(1);
  return { external, errors };
}

const stat = (page, n) => page.evaluate(([s, k]) => Number(document.querySelector(s).getAttribute(`data-${k}`)), [HOST, n]);
const drained = (page) => expect.poll(async () => (await stat(page, 'particles')) === 0 && (await stat(page, 'queued')) === 0, { timeout: 30_000 }).toBe(true);
const click = (page, action) => page.click(`button[data-action=${action}]`);

test('bundle contents, start script and MIME types work with the Python standard library server', async ({ request }) => {
  expect(fs.statSync(path.join(dir, 'start.sh')).mode & 0o111).not.toBe(0);
  for (const [file, type] of [['index.html', 'text/html'], ['preview.js', 'text/javascript'], ['extension/overlay.js', 'text/javascript'], ['preview.css', 'text/css']]) {
    const res = await request.get(`${origin}/${file}`);
    expect(res.status(), file).toBe(200);
    expect(res.headers()['content-type'], file).toContain(type);
  }
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  expect(html).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost)/);
  expect(fs.readFileSync(path.join(dir, 'README.md'), 'utf8')).toMatch(/SYNTHETIC DEMO/);
});

test('banner, bots and controls are visible; nothing leaves localhost; no console errors', async ({ page }) => {
  const { external, errors } = await open(page);
  await expect(page.locator('.demo-banner')).toContainText('SYNTHETIC DEMO');
  await expect(page.locator('.demo-banner')).toBeVisible();
  expect(await page.evaluate((s) => document.querySelector(s).shadowRoot.querySelectorAll('.bot').length, HOST)).toBe(4);
  for (const a of ['success', 'two-guests', 'remount', 'repeat', 'failure', 'live']) await expect(page.locator(`button[data-action=${a}]`)).toBeVisible();
  await page.waitForTimeout(400);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('success button -> one celebration, counters update, DOM drains', async ({ page }) => {
  await open(page);
  await click(page, 'success');
  await expect.poll(() => stat(page, 'celebrations')).toBe(1);
  await expect(page.locator('#stat-celebrations')).toHaveText('1');
  await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
  await drained(page);
  expect(await stat(page, 'celebrations')).toBe(1);
});

test('repeated and failure buttons (synthetic wording) never celebrate; clone never counts', async ({ page }) => {
  await open(page);
  await click(page, 'repeat');
  await click(page, 'failure');
  await click(page, 'live');
  await page.waitForTimeout(700);
  await click(page, 'live');
  await page.waitForTimeout(300);
  expect(await stat(page, 'celebrations')).toBe(0);
  await expect(page.locator('#log li').first()).toBeVisible();
});

test('two guests -> 2 celebrations; success then remount -> 1; clone persistence does not add', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  await click(page, 'live');
  await click(page, 'two-guests');
  await expect.poll(() => stat(page, 'celebrations'), { timeout: 15_000 }).toBe(2);
  await drained(page);
  await page.waitForTimeout(500);
  expect(await stat(page, 'celebrations')).toBe(2);
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 });
  await click(page, 'remount');
  await expect.poll(() => stat(page, 'celebrations'), { timeout: 15_000 }).toBe(3);
  await page.waitForTimeout(6000);
  await drained(page);
  expect(await stat(page, 'celebrations')).toBe(3);
});

test('pause and hide controls work in the demo; page stays clickable', async ({ page }) => {
  await open(page);
  await page.locator(`${HOST} button[data-action=pause]`).click();
  expect(await page.evaluate((s) => getComputedStyle(document.querySelector(s).shadowRoot.querySelector('.bot')).animationPlayState, HOST)).toBe('paused');
  await page.locator(`${HOST} button[data-action=hide]`).click();
  await click(page, 'success');
  await expect.poll(() => stat(page, 'skipped')).toBe(1);
  expect(await stat(page, 'celebrations')).toBe(0);
});

test('evidence: synthetic preview screenshots (desktop and mobile, mid-celebration)', async ({ browser }) => {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    await open(page, viewport);
    await click(page, 'success');
    await expect.poll(() => stat(page, 'particles')).toBeGreaterThan(30);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ROOT, `docs/evidence/preview-${name}-celebration.png`) });
    await page.close();
  }
});
