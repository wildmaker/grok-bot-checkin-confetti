const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '../..');
execFileSync('node', ['scripts/build.mjs'], { cwd: root });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('manifest is minimal and consistent', () => {
  const m = JSON.parse(read('dist/prod/manifest.json'));
  assert.equal(m.manifest_version, 3);
  assert.deepEqual(m.permissions, ['storage']);
  assert.equal(m.host_permissions, undefined);
  assert.equal(m.background, undefined);
  assert.deepEqual(m.content_scripts.length, 1);
  assert.deepEqual(m.content_scripts[0].matches, ['https://luma.com/*']);
  for (const f of m.content_scripts[0].js) assert.ok(fs.existsSync(path.join(root, 'dist/prod', f)), f);
  for (const f of Object.values(m.icons)) assert.ok(fs.existsSync(path.join(root, 'dist/prod', f)), f);
});

test('storage permission is actually used', () => {
  assert.match(read('dist/prod/content.js'), /chrome\.storage\.local/);
});

test('production build never contains the synthetic profile or fixture markers', () => {
  for (const f of fs.readdirSync(path.join(root, 'dist/prod'))) {
    const full = path.join(root, 'dist/prod', f);
    if (fs.statSync(full).isFile() && f.endsWith('.js')) {
      assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /synthetic/i, f);
    }
  }
  assert.match(read('dist/prod/profile.js'), /verified: false/);
});

test('test build swaps only the profile', () => {
  assert.match(read('dist/test/profile.js'), /synthetic-fixture-v1/);
  for (const f of ['route.js', 'detector.js', 'queue.js', 'overlay.js', 'content.js']) {
    assert.equal(read(`dist/test/${f}`), read(`dist/prod/${f}`), f);
  }
});

test('source has no network, cookie, or interception hooks', () => {
  for (const f of ['route.js', 'detector.js', 'queue.js', 'overlay.js', 'content.js']) {
    const src = read(`src/${f}`).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|getUserMedia|document\.cookie|localStorage|eval|innerHTML)\b/, f);
    assert.doesNotMatch(src, /\b(document|window|win|doc)\.addEventListener\(\s*['"](click|pointer\w*|mouse\w*|touch\w*|key\w*)['"]/, f);
  }
  const overlay = read('src/overlay.js');
  assert.equal((overlay.match(/addEventListener\('click'/g) || []).length, 2, 'only the two own control buttons listen for click');
});
