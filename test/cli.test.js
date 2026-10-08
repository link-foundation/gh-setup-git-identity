/**
 * Regression tests for the CLI version output
 */

import { test, assert } from 'test-anywhere';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const packageDir = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function cliVersion(cwd) {
  return execFileSync(process.execPath, [cliPath, '--version'], {
    cwd,
    encoding: 'utf8',
    timeout: 10000,
    stdio: 'pipe'
  });
}

test('CLI --version matches the package version', () => {
  assert.equal(cliVersion(packageDir), `${version}\n`);
});

test('CLI --version uses its own package from an unrelated directory', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'gh-setup-git-identity-version-'));
  try {
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '99.99.99' }));
    assert.equal(cliVersion(cwd), `${version}\n`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
