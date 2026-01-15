/**
 * Tests for gh-setup-git-identity core library
 */

import { test, assert } from 'test-anywhere';
import {
  isGhAuthenticated,
  runGhAuthLogin,
  runGhAuthSetupGit,
  getGitHubUsername,
  getGitHubEmail,
  getGitHubUserInfo,
  getGitConfig,
  verifyGitIdentity,
  defaultAuthOptions
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
test('isGhAuthenticated - returns a boolean', async () => {
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
test('getGitHubUsername - returns username when authenticated', async () => {
  const isAuth = await isGhAuthenticated({ logger: silentLogger });
  if (!isAuth) {
    console.log('Skipping test: gh not authenticated');
    return;
  }

  const username = await getGitHubUsername({ logger: silentLogger });
  assert.ok(typeof username === 'string');
  assert.ok(username.length > 0);
});

test('getGitHubEmail - returns email when authenticated', async () => {
  const isAuth = await isGhAuthenticated({ logger: silentLogger });
  if (!isAuth) {
    console.log('Skipping test: gh not authenticated');
    return;
  }

  const email = await getGitHubEmail({ logger: silentLogger });
  assert.ok(typeof email === 'string');
  assert.ok(email.includes('@'));
});

test('getGitHubUserInfo - returns user info when authenticated', async () => {
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

// Test: runGhAuthLogin function exists and is a function
test('runGhAuthLogin - is exported as a function', async () => {
  assert.equal(typeof runGhAuthLogin, 'function');
});

// Test: runGhAuthSetupGit function exists and is a function
test('runGhAuthSetupGit - is exported as a function', async () => {
  assert.equal(typeof runGhAuthSetupGit, 'function');
});

// Test: runGhAuthSetupGit - runs when authenticated
test('runGhAuthSetupGit - returns boolean when authenticated', async () => {
  const isAuth = await isGhAuthenticated({ logger: silentLogger });
  if (!isAuth) {
    console.log('Skipping test: gh not authenticated');
    return;
  }

  const result = await runGhAuthSetupGit({ logger: silentLogger });
  assert.equal(typeof result, 'boolean');
  // When authenticated, setup-git should succeed
  assert.equal(result, true);
});

// Test: defaultAuthOptions is exported and has correct structure
test('defaultAuthOptions - is exported with correct default values', async () => {
  assert.ok(typeof defaultAuthOptions === 'object');
  assert.equal(defaultAuthOptions.hostname, 'github.com');
  assert.equal(defaultAuthOptions.scopes, 'repo,workflow,user,read:org,gist');
  assert.equal(defaultAuthOptions.gitProtocol, 'https');
  assert.equal(defaultAuthOptions.web, true);
  assert.equal(defaultAuthOptions.withToken, false);
  assert.equal(defaultAuthOptions.skipSshKey, false);
  assert.equal(defaultAuthOptions.insecureStorage, false);
  assert.equal(defaultAuthOptions.clipboard, false);
});

// Test: defaultAuthOptions contains all expected keys
test('defaultAuthOptions - contains all expected keys', async () => {
  const expectedKeys = [
    'hostname',
    'scopes',
    'gitProtocol',
    'web',
    'withToken',
    'skipSshKey',
    'insecureStorage',
    'clipboard'
  ];

  for (const key of expectedKeys) {
    assert.ok(key in defaultAuthOptions, `Missing key: ${key}`);
  }
});

// Test: module exports
test('module exports all expected functions', async () => {
  const module = await import('../src/index.js');

  assert.ok(typeof module.defaultAuthOptions === 'object');
  assert.ok(typeof module.isGhAuthenticated === 'function');
  assert.ok(typeof module.runGhAuthLogin === 'function');
  assert.ok(typeof module.runGhAuthSetupGit === 'function');
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
  assert.ok(typeof defaultExport.defaultAuthOptions === 'object');
  assert.ok(typeof defaultExport.isGhAuthenticated === 'function');
  assert.ok(typeof defaultExport.runGhAuthLogin === 'function');
  assert.ok(typeof defaultExport.runGhAuthSetupGit === 'function');
  assert.ok(typeof defaultExport.getGitHubUsername === 'function');
  assert.ok(typeof defaultExport.getGitHubEmail === 'function');
  assert.ok(typeof defaultExport.getGitHubUserInfo === 'function');
  assert.ok(typeof defaultExport.setGitConfig === 'function');
  assert.ok(typeof defaultExport.getGitConfig === 'function');
  assert.ok(typeof defaultExport.setupGitIdentity === 'function');
  assert.ok(typeof defaultExport.verifyGitIdentity === 'function');
});

// Test: CLI --repair and --no-auto-login options are present
// Note: Full CLI integration tests would require mocking the subprocess
test('CLI module has --repair and --no-auto-login options', async () => {
  // This test verifies the CLI module syntax is correct and options exist
  const fs = await import('node:fs');
  const cliContent = fs.readFileSync(new URL('../src/cli.js', import.meta.url), 'utf-8');

  // Verify the new options are defined in the CLI
  assert.ok(cliContent.includes("'repair'"), 'CLI should have --repair option');
  assert.ok(cliContent.includes("'no-auto-login'"), 'CLI should have --no-auto-login option');

  // Verify the repair/no-auto-login logic is implemented
  assert.ok(cliContent.includes('skipAutoLogin'), 'CLI should have skipAutoLogin logic');
  assert.ok(cliContent.includes('config.repair'), 'CLI should check config.repair');
  assert.ok(cliContent.includes('config.noAutoLogin'), 'CLI should check config.noAutoLogin');
});
