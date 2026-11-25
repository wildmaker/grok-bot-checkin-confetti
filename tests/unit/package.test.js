const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '../..');
const zip = path.join(root, 'release/grok-bot-checkin-confetti-v0.1.0-load-unpacked.zip');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

test('ZIP is reproducible, extracts to a loadable production extension, and excludes test material', () => {
  execFileSync('node', ['scripts/package.mjs'], { cwd: root, stdio: 'ignore' });
  const first = sha(zip);
  execFileSync('node', ['scripts/package.mjs'], { cwd: root, stdio: 'ignore' });
  assert.equal(sha(zip), first, 'byte-identical across builds');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zipcheck-'));
  execFileSync('unzip', ['-q', zip, '-d', dir]);
  const listing = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(listing.includes('manifest.json'), 'manifest at ZIP root');
  assert.deepEqual(listing.filter((n) => /test|fixture|spec|node_modules|\.git|synthetic/i.test(n)), []);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name.includes('SYNTHETIC'), false);
  assert.match(fs.readFileSync(path.join(dir, 'profile.js'), 'utf8'), /verified: false/);
  for (const f of listing.filter((n) => n.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /synthetic/i, f);
  }
});
