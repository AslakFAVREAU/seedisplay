/**
 * Test d'intégration auto-update
 * 
 * Vérifie que electron-updater détecte correctement une mise à jour
 * en simulant un serveur HTTP local servant latest-linux.yml
 * 
 * Usage: npx mocha test/autoUpdate.integration.test.js --exit --timeout 15000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

describe('Auto-Update Integration', function () {
  this.timeout(15000);

  let server;
  let serverPort;

  // Créer un serveur HTTP local qui sert les fichiers de mise à jour
  before(function (done) {
    server = http.createServer((req, res) => {
      console.log(`  [test-server] ${req.method} ${req.url}`);

      if (req.url === '/latest-linux.yml') {
        // Simuler un latest-linux.yml avec version 1.11.7
        const yml = [
          'version: 1.11.7',
          'files:',
          '  - url: SEE-Display-x86_64.AppImage',
          '    sha512: FAKEHASH==',
          '    size: 127651073',
          'path: SEE-Display-x86_64.AppImage',
          'sha512: FAKEHASH==',
          "releaseDate: '2026-02-28T09:17:31.670Z'"
        ].join('\n');
        res.writeHead(200, { 'Content-Type': 'text/yaml' });
        res.end(yml);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      console.log(`  [test-server] Running on port ${serverPort}`);
      done();
    });
  });

  after(function (done) {
    if (server) server.close(done);
    else done();
  });

  it('should parse latest-linux.yml correctly', async function () {
    const response = await fetch(`http://127.0.0.1:${serverPort}/latest-linux.yml`);
    const text = await response.text();

    assert.ok(text.includes('version: 1.11.7'), 'Should contain version 1.11.7');
    assert.ok(text.includes('SEE-Display-x86_64.AppImage'), 'Should reference AppImage file');
    assert.ok(text.includes('sha512:'), 'Should contain sha512 hash');
    assert.ok(text.includes('releaseDate:'), 'Should contain release date');
  });

  it('should detect that 1.11.7 > 1.11.6 (update needed)', function () {
    const semver = require('semver');
    const currentVersion = '1.11.6';
    const serverVersion = '1.11.7';

    assert.ok(semver.gt(serverVersion, currentVersion),
      `Server version ${serverVersion} should be greater than current ${currentVersion}`);
    assert.ok(semver.valid(currentVersion), 'Current version should be valid semver');
    assert.ok(semver.valid(serverVersion), 'Server version should be valid semver');
  });

  it('should NOT trigger update when versions are equal', function () {
    const semver = require('semver');
    assert.ok(!semver.gt('1.11.7', '1.11.7'),
      'Same version should not trigger update');
  });

  it('should NOT trigger update when local is newer', function () {
    const semver = require('semver');
    assert.ok(!semver.gt('1.11.6', '1.11.7'),
      'Older server version should not trigger update');
  });

  it('should verify latest-linux.yml exists in dist/v1.11.7', function () {
    const ymlPath = path.join(__dirname, '..', 'dist', 'v1.11.7', 'latest-linux.yml');
    if (!fs.existsSync(ymlPath)) {
      this.skip('v1.11.7 not built yet — run electron-builder first');
      return;
    }
    const content = fs.readFileSync(ymlPath, 'utf8');
    assert.ok(content.includes('version: 1.11.7'), 'Should have correct version');
    assert.ok(content.includes('SEE-Display-x86_64.AppImage'), 'Should reference correct filename');
    assert.ok(content.includes('sha512:'), 'Should have sha512 hash');
    // Verify sha512 is not empty/fake
    const sha512Match = content.match(/sha512:\s*(\S+)/);
    assert.ok(sha512Match && sha512Match[1].length > 20, 'sha512 hash should be substantial');
  });

  it('should verify latest-linux.yml exists in dist/v1.11.6', function () {
    const ymlPath = path.join(__dirname, '..', 'dist', 'v1.11.6', 'latest-linux.yml');
    if (!fs.existsSync(ymlPath)) {
      this.skip('v1.11.6 not built yet — run electron-builder first');
      return;
    }
    const content = fs.readFileSync(ymlPath, 'utf8');
    assert.ok(content.includes('version: 1.11.6'), 'Should have correct version');
  });

  it('should simulate update check flow (fetch + compare)', async function () {
    // Simule ce que fait electron-updater:
    // 1. Fetch latest-linux.yml
    // 2. Parse la version
    // 3. Compare avec la version actuelle
    const currentVersion = '1.11.6';

    const response = await fetch(`http://127.0.0.1:${serverPort}/latest-linux.yml`);
    assert.strictEqual(response.status, 200, 'Server should return 200');

    const text = await response.text();
    const versionMatch = text.match(/^version:\s*(.+)$/m);
    assert.ok(versionMatch, 'Should find version line in YAML');

    const remoteVersion = versionMatch[1].trim();
    assert.strictEqual(remoteVersion, '1.11.7', 'Remote version should be 1.11.7');

    const semver = require('semver');
    const updateAvailable = semver.gt(remoteVersion, currentVersion);
    assert.ok(updateAvailable, `Update should be available: ${remoteVersion} > ${currentVersion}`);

    // Verify download URL is parseable
    const urlMatch = text.match(/url:\s*(.+)$/m);
    assert.ok(urlMatch, 'Should have download URL');
    const fileName = urlMatch[1].trim();
    assert.strictEqual(fileName, 'SEE-Display-x86_64.AppImage',
      'Download filename should be SEE-Display-x86_64.AppImage');

    console.log(`  ✓ Update available: ${currentVersion} → ${remoteVersion}`);
    console.log(`  ✓ Download: ${fileName}`);
  });

  it('should verify AppImage files exist in both build dirs', function () {
    const v6 = path.join(__dirname, '..', 'dist', 'v1.11.6', 'SEE-Display-x86_64.AppImage');
    const v7 = path.join(__dirname, '..', 'dist', 'v1.11.7', 'SEE-Display-x86_64.AppImage');

    if (!fs.existsSync(v6)) {
      this.skip('v1.11.6 AppImage not found');
      return;
    }
    if (!fs.existsSync(v7)) {
      this.skip('v1.11.7 AppImage not found');
      return;
    }

    const stat6 = fs.statSync(v6);
    const stat7 = fs.statSync(v7);

    assert.ok(stat6.size > 50 * 1024 * 1024, 'v1.11.6 AppImage should be > 50MB');
    assert.ok(stat7.size > 50 * 1024 * 1024, 'v1.11.7 AppImage should be > 50MB');
    console.log(`  v1.11.6: ${(stat6.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`  v1.11.7: ${(stat7.size / 1024 / 1024).toFixed(1)} MB`);
  });
});
