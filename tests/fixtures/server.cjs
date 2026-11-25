/* Local HTTPS server for synthetic fixtures. Never talks to the network beyond localhost. */
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:";
const SHELL = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic fixture</title>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head>' +
  '<body><div id="app"></div><script src="/fixture.js"></script></body></html>';

function makeCert() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-cert-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1',
    '-subj', '/CN=luma.com', '-addext', 'subjectAltName=DNS:luma.com'], { stdio: 'ignore' });
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

function start() {
  const server = https.createServer(makeCert(), (req, res) => {
    const url = new URL(req.url, 'https://luma.com');
    const asset = { '/fixture.css': 'text/css', '/fixture.js': 'text/javascript' }[url.pathname];
    if (asset) {
      res.writeHead(200, { 'content-type': asset, 'content-security-policy': CSP });
      res.end(fs.readFileSync(path.join(__dirname, url.pathname.slice(1))));
    } else if (url.pathname === '/favicon.ico') {
      res.writeHead(204).end();
    } else {
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': CSP });
      res.end(SHELL);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, close: () => server.close() }));
  });
}

module.exports = { start };
