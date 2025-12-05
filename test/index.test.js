/**
 * Tests for gh-setup-git-identity core library
 */

import { test, assert } from 'test-anywhere';
import {
  isGhAuthenticated,
  getGitHubUsername,
  getGitHubEmail,
  getGitHubUserInfo,
  getGitConfig,
  verifyGitIdentity
} from '../src/index.js';

// Note: These tests require gh to be authenticated
// In CI, we may skip integration tests that require auth

// Helper to create a silent logger for tests
const silentLogger = {
  log: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Test: isGhAuthenticated function exists and returns boolean
// Use higher timeout for Windows where gh auth status can be slow
test('isGhAuthenticated - returns a boolean', { timeout: 30000 }, async () => {
  const result = await isGhAuthenticated({ logger: silentLogger });
  assert.equal(typeof result, 'boolean');
});

// Test: getGitConfig function exists
test('getGitConfig - returns string or null', async () => {
  const result = await getGitConfig('user.name', { logger: silentLogger });
  assert.ok(result === null || typeof result === 'string');
});

// Test: verifyGitIdentity function exists and returns object
test('verifyGitIdentity - returns object with username and email', async () => {
  const result = await verifyGitIdentity({ logger: silentLogger });
  assert.ok(typeof result === 'object');
  assert.ok('username' in result);
  assert.ok('email' in result);
});

// Integration tests - only run if authenticated
// Use higher timeout for Windows where commands can be slow
test('getGitHubUsername - returns username when authenticated', { timeout: 30000 }, async () => {
  const isAuth = await isGhAuthenticated({ logger: silentLogger });
  if (!isAuth) {
    console.log('Skipping test: gh not authenticated');
    return;
  }

  const username = await getGitHubUsername({ logger: silentLogger });
  assert.ok(typeof username === 'string');
  assert.ok(username.length > 0);
});

test('getGitHubEmail - returns email when authenticated', { timeout: 30000 }, async () => {
  const isAuth = await isGhAuthenticated({ logger: silentLogger });
  if (!isAuth) {
    console.log('Skipping test: gh not authenticated');
    return;
  }

  const email = await getGitHubEmail({ logger: silentLogger });
  assert.ok(typeof email === 'string');
  assert.ok(email.includes('@'));
});

test('getGitHubUserInfo - returns user info when authenticated', { timeout: 30000 }, async () => {
  const isAuth = await isGhAuthenticated({ logger: silentLogger });
  if (!isAuth) {
    console.log('Skipping test: gh not authenticated');
    return;
  }

  const info = await getGitHubUserInfo({ logger: silentLogger });
  assert.ok(typeof info === 'object');
  assert.ok(typeof info.username === 'string');
  assert.ok(typeof info.email === 'string');
  assert.ok(info.username.length > 0);
  assert.ok(info.email.includes('@'));
});

// Test: module exports
test('module exports all expected functions', async () => {
  const module = await import('../src/index.js');

  assert.ok(typeof module.isGhAuthenticated === 'function');
  assert.ok(typeof module.getGitHubUsername === 'function');
  assert.ok(typeof module.getGitHubEmail === 'function');
  assert.ok(typeof module.getGitHubUserInfo === 'function');
  assert.ok(typeof module.setGitConfig === 'function');
  assert.ok(typeof module.getGitConfig === 'function');
  assert.ok(typeof module.setupGitIdentity === 'function');
  assert.ok(typeof module.verifyGitIdentity === 'function');
});

// Test: default export
test('default export contains all functions', async () => {
  const module = await import('../src/index.js');
  const defaultExport = module.default;

  assert.ok(typeof defaultExport === 'object');
  assert.ok(typeof defaultExport.isGhAuthenticated === 'function');
  assert.ok(typeof defaultExport.getGitHubUsername === 'function');
  assert.ok(typeof defaultExport.getGitHubEmail === 'function');
  assert.ok(typeof defaultExport.getGitHubUserInfo === 'function');
  assert.ok(typeof defaultExport.setGitConfig === 'function');
  assert.ok(typeof defaultExport.getGitConfig === 'function');
  assert.ok(typeof defaultExport.setupGitIdentity === 'function');
  assert.ok(typeof defaultExport.verifyGitIdentity === 'function');
});
