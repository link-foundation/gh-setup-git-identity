#!/usr/bin/env bun

/**
 * Update npm for OIDC trusted publishing
 * npm trusted publishing requires npm >= 11.5.1
 * Node.js 20.x ships with npm 10.x, so we need to update
 *
 * This script deliberately loads no helpers (no use-m, no command-stream).
 * Before, it installed command-stream@latest only to run `npm install`. When
 * command-stream 2.0.0 made node-pty a hard dependency, that install failed
 * and the release on main stopped before publishing (issue #32).
 *
 * npm is pinned to major 11, not `latest`. npm 12 requires Node.js
 * ^22.22.2 || ^24.15.0 || >=26, so `npm install -g npm@latest` fails with
 * EBADENGINE on the Node.js 20.x that the release jobs use.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NPM_MIN_VERSION = '11.5.1';
export const NPM_INSTALL_SPEC = 'npm@11';

export function parseVersion(version) {
  const match = String(version)
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return match.slice(1, 4).map(Number);
}

export function isVersionAtLeast(version, minimumVersion) {
  const left = parseVersion(version);
  const right = parseVersion(minimumVersion);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) {
      return left[i] > right[i];
    }
  }
  return true;
}

export function isSupportedNpmVersion(version) {
  return isVersionAtLeast(version, NPM_MIN_VERSION);
}

function npm(args, options = {}) {
  return execFileSync('npm', args, { encoding: 'utf8', ...options });
}

export function setupNpm({ run = npm, log = console.log } = {}) {
  const currentVersion = run(['--version']).trim();
  log(`Current npm version: ${currentVersion}`);

  if (isSupportedNpmVersion(currentVersion)) {
    log('npm already supports OIDC trusted publishing, skipping update');
    return currentVersion;
  }

  log(`Installing ${NPM_INSTALL_SPEC}...`);
  run(['install', '-g', NPM_INSTALL_SPEC], { stdio: 'inherit' });

  const updatedVersion = run(['--version']).trim();
  log(`Updated npm version: ${updatedVersion}`);

  if (!isSupportedNpmVersion(updatedVersion)) {
    throw new Error(
      `npm ${updatedVersion} does not support OIDC trusted publishing (need >= ${NPM_MIN_VERSION})`
    );
  }
  return updatedVersion;
}

function isMainModule() {
  return process.argv[1]
    ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;
}

if (isMainModule()) {
  try {
    setupNpm();
  } catch (error) {
    console.error('Error updating npm:', error.message);
    process.exit(1);
  }
}
