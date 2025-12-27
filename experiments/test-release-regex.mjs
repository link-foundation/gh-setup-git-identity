#!/usr/bin/env node

/**
 * Test script to verify the release notes regex pattern
 * works correctly for Major, Minor, and Patch changes
 */

// Test cases representing different release note formats
const testCases = [
  {
    name: 'Minor Changes with commit hash',
    body: `### Minor Changes

- 8c146cc: Automatically run \`gh auth login\` when GitHub CLI is not authenticated, enabling single-command setup instead of requiring manual login first`,
    expectedType: 'Minor',
    expectedHash: '8c146cc',
    expectedDesc: 'Automatically run `gh auth login` when GitHub CLI is not authenticated, enabling single-command setup instead of requiring manual login first',
  },
  {
    name: 'Patch Changes with commit hash',
    body: `### Patch Changes

- abc1234: Fix a bug in the login flow`,
    expectedType: 'Patch',
    expectedHash: 'abc1234',
    expectedDesc: 'Fix a bug in the login flow',
  },
  {
    name: 'Major Changes with commit hash',
    body: `### Major Changes

- deadbeef: Breaking change - new API`,
    expectedType: 'Major',
    expectedHash: 'deadbeef',
    expectedDesc: 'Breaking change - new API',
  },
  {
    name: 'Minor Changes without commit hash',
    body: `### Minor Changes

- Add new feature`,
    expectedType: 'Minor',
    expectedHash: null,
    expectedDesc: 'Add new feature',
  },
];

// The regex pattern from the updated format-release-notes.mjs
const changesPattern =
  /### (Major|Minor|Patch) Changes\s*\n\s*-\s+(?:([a-f0-9]+):\s+)?(.+?)$/s;

console.log('Testing release notes regex pattern\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\nTest: ${testCase.name}`);
  console.log('-'.repeat(40));

  const match = testCase.body.match(changesPattern);

  if (!match) {
    console.log('❌ FAILED: No match found');
    failed++;
    continue;
  }

  const [, changeType, commitHash, rawDescription] = match;

  let allPassed = true;

  if (changeType !== testCase.expectedType) {
    console.log(`❌ changeType: expected '${testCase.expectedType}', got '${changeType}'`);
    allPassed = false;
  } else {
    console.log(`✅ changeType: ${changeType}`);
  }

  const expectedHash = testCase.expectedHash || null;
  const actualHash = commitHash || null;
  if (actualHash !== expectedHash) {
    console.log(`❌ commitHash: expected '${expectedHash}', got '${actualHash}'`);
    allPassed = false;
  } else {
    console.log(`✅ commitHash: ${actualHash}`);
  }

  if (rawDescription !== testCase.expectedDesc) {
    console.log(`❌ description: expected '${testCase.expectedDesc}', got '${rawDescription}'`);
    allPassed = false;
  } else {
    console.log(`✅ description: ${rawDescription.substring(0, 50)}...`);
  }

  if (allPassed) {
    passed++;
    console.log('✅ TEST PASSED');
  } else {
    failed++;
    console.log('❌ TEST FAILED');
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
