const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const { start } = require('../fixtures/server.cjs');

const ROOT = path.resolve(__dirname, '../..');
const HOST = '#grok-bot-checkin-host';

async function startServer() {
  return start();
}

async function launch(port, { viewport = { width: 1280, height: 800 }, recordVideoDir } = {}) {
  const ext = path.join(ROOT, 'dist/extension');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport,
    ignoreHTTPSErrors: true,
    ...(recordVideoDir ? { recordVideo: { dir: recordVideoDir, size: viewport } } : {}),
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      '--host-resolver-rules=MAP luma.com 127.0.0.1',
      '--no-proxy-server',
      '--ignore-certificate-errors',
    ],
  });
  const base = `https://luma.com:${port}`;
  return { context, base, scanUrl: (q = '') => `${base}/check-in/evt-SYNTHETIC/scan${q}`, eventUrl: `${base}/event/evt-SYNTHETIC` };
}

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

const hostCount = (page) => page.evaluate((s) => document.querySelectorAll(s).length, HOST);
const stat = (page, name) =>
  page.evaluate(([s, n]) => { const h = document.querySelector(s); return h ? Number(h.getAttribute(`data-${n}`)) : null; }, [HOST, name]);
const fx = (page, fn, ...args) => page.evaluate(([f, a]) => window.__fx[f](...a), [fn, args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { ROOT, HOST, startServer, launch, watchErrors, hostCount, stat, fx, sleep };
