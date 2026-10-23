/**
 * Regression tests for the release scripts (issue #32)
 *
 * The release on main failed because scripts/setup-npm.mjs installed
 * command-stream@latest through use-m. command-stream 2.0.0 made node-pty a
 * hard dependency, and its native build failed on the runner. These tests
 * work offline: they check the pins and the npm setup logic, and do not load
 * any helper.
 */

import { test, assert } from 'test-anywhere';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  USE_M_URL,
  COMMAND_STREAM,
  LINO_ARGUMENTS,
} from '../scripts/release-deps.mjs';
import {
  NPM_INSTALL_SPEC,
  NPM_MIN_VERSION,
  isSupportedNpmVersion,
  setupNpm,
} from '../scripts/setup-npm.mjs';
import {
  ISSUE_TITLE,
  buildReport,
  failedJobs,
  reportReleaseFailure,
} from '../scripts/report-release-failure.mjs';

const scriptsDir = fileURLToPath(new URL('../scripts/', import.meta.url));
const workflowPath = fileURLToPath(
  new URL('../.github/workflows/release.yml', import.meta.url)
);
const scripts = readdirSync(scriptsDir)
  .filter((file) => file.endsWith('.mjs'))
  .map((file) => ({
    file,
    source: readFileSync(`${scriptsDir}${file}`, 'utf8'),
  }));
const exactVersion = /@\d+\.\d+\.\d+$/;

test('release helpers are pinned to exact versions', () => {
  assert.match(USE_M_URL, /^https:\/\/unpkg\.com\/use-m@\d+\.\d+\.\d+\/use\.js$/);
  assert.match(COMMAND_STREAM, /^command-stream@/);
  assert.match(COMMAND_STREAM, exactVersion);
  assert.match(LINO_ARGUMENTS, /^lino-arguments@/);
  assert.match(LINO_ARGUMENTS, exactVersion);
});

test('command-stream is pinned to 2.0.1+, where node-pty is optional', () => {
  const [major, minor, patch] = COMMAND_STREAM.split('@')[1]
    .split('.')
    .map(Number);
  assert.ok(
    major > 2 || (major === 2 && (minor > 0 || patch >= 1)),
    `${COMMAND_STREAM} must not be 2.0.0, which requires node-pty`
  );
});

test('release scripts load helpers only through the pinned versions', () => {
  for (const { file, source } of scripts) {
    assert.ok(
      !source.includes('unpkg.com/use-m/use.js'),
      `${file} loads an unpinned use-m`
    );
    for (const [, specifier] of source.matchAll(/\buse\(\s*['"`]([^'"`]+)/g)) {
      assert.match(
        specifier,
        exactVersion,
        `${file} loads ${specifier} without an exact version`
      );
    }
  }
});

test('setup-npm.mjs loads no helpers and does not install npm@latest', () => {
  const { source } = scripts.find(({ file }) => file === 'setup-npm.mjs');
  assert.ok(!source.includes('fetch('), 'setup-npm.mjs must not fetch use-m');
  assert.ok(!source.includes('use('), 'setup-npm.mjs must not call use()');
  assert.ok(!source.includes('$`'), 'setup-npm.mjs must not use command-stream');
  assert.equal(NPM_INSTALL_SPEC, 'npm@11');
});

test('release-path scripts reject on a non-zero exit code', () => {
  const releasePath = [
    'changeset-version.mjs',
    'create-github-release.mjs',
    'instant-version-bump.mjs',
    'publish-to-npm.mjs',
    'version-and-commit.mjs',
  ];
  for (const name of releasePath) {
    const { source } = scripts.find(({ file }) => file === name);
    assert.ok(
      source.includes('shell.errexit(true)'),
      `${name} must enable errexit`
    );
  }
});

function fakeNpm(versions) {
  const calls = [];
  const run = (args) => {
    calls.push(args.join(' '));
    if (args[0] === '--version') {
      return `${versions.shift()}\n`;
    }
    return '';
  };
  return { run, calls };
}

test('isSupportedNpmVersion requires npm >= 11.5.1', () => {
  assert.equal(NPM_MIN_VERSION, '11.5.1');
  assert.equal(isSupportedNpmVersion('10.8.2'), false);
  assert.equal(isSupportedNpmVersion('11.5.0'), false);
  assert.equal(isSupportedNpmVersion('11.5.1'), true);
  assert.equal(isSupportedNpmVersion('11.21.1'), true);
  assert.equal(isSupportedNpmVersion('12.2.1'), true);
});

test('setupNpm installs npm@11 over the npm 10 bundled with Node.js 20', () => {
  const { run, calls } = fakeNpm(['10.8.2', '11.21.1']);
  assert.equal(setupNpm({ run, log: () => {} }), '11.21.1');
  assert.deepEqual(calls, ['--version', 'install -g npm@11', '--version']);
});

test('setupNpm skips the install when npm already supports OIDC', () => {
  const { run, calls } = fakeNpm(['11.6.2']);
  assert.equal(setupNpm({ run, log: () => {} }), '11.6.2');
  assert.deepEqual(calls, ['--version']);
});

test('setupNpm fails when npm is still too old after the install', () => {
  // A plain re-run did this on main: `npm install -g npm@latest` failed with
  // EBADENGINE, npm stayed on 10.8.2, and the step still exited 0.
  const { run } = fakeNpm(['10.8.2', '10.8.2']);
  assert.throws(() => setupNpm({ run, log: () => {} }));
});

test('setupNpm fails when the npm install command fails', () => {
  const run = (args) => {
    if (args[0] === '--version') {
      return '10.8.2\n';
    }
    throw new Error('npm error code EBADENGINE');
  };
  assert.throws(() => setupNpm({ run, log: () => {} }));
});

const jobResults = {
  lint: 'success',
  test: 'success',
  release: 'failure',
  'instant-release': 'skipped',
};
const env = {
  GITHUB_REPOSITORY: 'link-foundation/gh-setup-git-identity',
  GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_RUN_ID: '37733836425',
  GITHUB_SHA: '3eb61a03876aa15750512cf9e96e9dc847ce231f',
  GITHUB_EVENT_NAME: 'push',
  JOB_RESULTS: JSON.stringify(jobResults),
};

test('release failure report names the run and the failed jobs', () => {
  assert.deepEqual(failedJobs(jobResults), ['release']);
  const body = buildReport({
    repository: env.GITHUB_REPOSITORY,
    runId: env.GITHUB_RUN_ID,
    sha: env.GITHUB_SHA,
    eventName: 'push',
    jobResults,
  });
  assert.includes(
    body,
    'https://github.com/link-foundation/gh-setup-git-identity/actions/runs/37733836425'
  );
  assert.includes(body, 'Failed jobs: `release`');
  assert.includes(body, 'gh run rerun 37733836425 --failed');
});

test('release failure opens an issue when none is open', () => {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    return args[1] === 'create' ? 'https://github.com/x/y/issues/1' : '';
  };
  const result = reportReleaseFailure({ env, run });
  assert.equal(result.existing, false);
  assert.equal(result.url, 'https://github.com/x/y/issues/1');
  assert.deepEqual(calls.map((args) => args.slice(0, 2)), [
    ['issue', 'list'],
    ['issue', 'create'],
  ]);
  assert.ok(calls[1].includes(ISSUE_TITLE));
});

test('release failure comments on the open issue instead of a duplicate', () => {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    return args[1] === 'list' ? '7' : 'https://github.com/x/y/issues/7#c';
  };
  const result = reportReleaseFailure({ env, run });
  assert.equal(result.existing, true);
  assert.deepEqual(calls[1].slice(0, 3), ['issue', 'comment', '7']);
});

test('release workflow reports failed releases on main', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.includes(workflow, 'report-release-failure:');
  assert.includes(workflow, 'issues: write');
  assert.includes(workflow, "needs.release.result == 'failure'");
  assert.includes(workflow, "needs.instant-release.result == 'failure'");
  assert.includes(workflow, 'bun scripts/report-release-failure.mjs');
});

test('a re-run after a failed publish still reaches the publish step', () => {
  // The version commit on main already consumed the changesets, so the
  // rebase leaves none. Without already_released, the publish step was
  // skipped. See experiments/issue-32-release-dry-run.sh.
  const { source } = scripts.find(({ file }) => file === 'version-and-commit.mjs');
  const afterRebase = source.slice(source.indexOf('await $`git rebase origin/main`'));
  assert.match(
    afterRebase,
    /countChangesets\(\) === 0\) \{[\s\S]*?setOutput\('already_released', 'true'\)/
  );
});
