// Renders assets/grok-bot-mark.svg to the 16/48/128 px extension icons using Chromium.
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'assets/grok-bot-mark.svg'), 'utf8').replace(/<\?xml[^>]*>/, '');
mkdirSync(path.join(root, 'assets/icons'), { recursive: true });
const browser = await chromium.launch();
for (const size of [16, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(path.join(root, `assets/icons/icon-${size}.png`), png);
  await page.close();
}
await browser.close();
