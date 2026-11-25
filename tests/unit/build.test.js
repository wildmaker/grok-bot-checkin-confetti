const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '../..');
const build = () => execFileSync('node', ['scripts/build.mjs'], { cwd: root, stdio: 'ignore' });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
build();
const manifest = JSON.parse(read('dist/extension/manifest.json'));
const zip = path.join(root, `release/grok-bot-checkin-confetti-v${manifest.version}-load-unpacked.zip`);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

test('manifest is minimal and consistent', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, JSON.parse(read('package.json')).version);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.background, undefined);
  assert.deepEqual(manifest.content_scripts.map((c) => c.matches), [['https://luma.com/*']]);
  for (const f of [...manifest.content_scripts[0].js, ...Object.values(manifest.icons)]) {
    assert.ok(fs.existsSync(path.join(root, 'dist/extension', f)), f);
  }
  assert.match(read('dist/extension/content.js'), /chrome\.storage\.local/);
});

test('detection is narrow: only the exact localized role=status toast is referenced', () => {
  const src = read('src/profile.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(src.match(/签到/g), ['签到'], 'exactly one occurrence of the success text');
  assert.deepEqual([...src.matchAll(/querySelectorAll\(([^)]*)\)/g)].map((m) => m[1]), ['\'[role="status"]\'']);
  assert.doesNotMatch(src, /innerText|document\.body|counter|button|class/i);
});

test('source has no network, cookie, or interception hooks', () => {
  for (const f of ['route.js', 'detector.js', 'queue.js', 'profile.js', 'overlay.js', 'content.js']) {
    const src = read(`src/${f}`).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(src, /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|getUserMedia|document\.cookie|localStorage|eval|innerHTML)\b/, f);
    assert.doesNotMatch(src, /\b(document|window|win|doc)\.addEventListener\(\s*['"](click|pointer\w*|mouse\w*|touch\w*|key\w*)['"]/, f);
  }
  assert.equal((read('src/overlay.js').match(/addEventListener\('click'/g) || []).length, 2, 'only the two own control buttons');
});

test('ZIP is byte-reproducible and extracts to the loadable extension without test material', () => {
  const first = sha(zip);
  build();
  assert.equal(sha(zip), first);
  const listing = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(listing.includes('manifest.json'));
  assert.deepEqual(listing.filter((n) => /test|fixture|spec|node_modules|\.git|synthetic/i.test(n)), []);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zipcheck-'));
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  assert.equal(fs.readFileSync(path.join(dir, 'profile.js'), 'utf8'), read('src/profile.js'));
});
