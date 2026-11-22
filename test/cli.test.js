/**
 * Regression tests for the CLI
 */

import { test, assert } from 'test-anywhere';
import { execFileSync, spawnSync } from 'node:child_process';
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

const mockCommands = `#!/bin/sh
name=$(basename "$0")
printf '%s %s\\n' "$name" "$*" >> "$MOCK_CALLS"
case "$name:$1:$2" in
  git:config:*) exit 0 ;;
  gh:auth:status)
    if [ "$MOCK_SCENARIO" = legacy-gh ] && [ "$5" = --active ]; then
      echo 'unknown flag: --active' >&2
      exit 1
    fi
    case "$MOCK_SCENARIO" in signed-out|fresh-login) exit 1 ;; esac ;;
  gh:auth:login)
    test "$MOCK_SCENARIO" != cancel || exit 1
    case " $* " in
      *' --with-token '*)
        case " $* " in *' -s '*|*' --web '*) exit 2 ;; esac
        read -r token
        test "$token" = fixture-token || exit 2 ;;
    esac
    touch "$MOCK_LOGIN"
    ;;
  gh:auth:setup-git) exit 0 ;;
  gh:api:user)
    if [ -e "$MOCK_LOGIN" ]; then echo new-account; else echo old-account; fi ;;
  gh:api:user/emails)
    if [ "$MOCK_SCENARIO" = healthy ]; then
      echo old@example.test
    elif [ -e "$MOCK_LOGIN" ] && [ "$MOCK_SCENARIO" != persistent ] && [ "$MOCK_SCENARIO" != signed-out ]; then
      echo new@example.test
    elif [ "$MOCK_SCENARIO" = no-primary ]; then
      exit 0
    elif [ "$MOCK_SCENARIO" = bare-404 ]; then
      echo 'gh: Not Found (HTTP 404)' >&2
      exit 1
    elif [ "$MOCK_SCENARIO" = pat-denied ]; then
      echo 'gh: Resource not accessible by personal access token (HTTP 403)' >&2
      exit 1
    else
      echo 'gh: Not Found (HTTP 404)' >&2
      printf 'gh: This API operation needs the "%s" scope. To request it, run:  gh auth refresh -h github.com -s %s\\n' "$MOCK_SCOPE" "$MOCK_SCOPE" >&2
      exit 1
    fi ;;
  *) echo "Unexpected command: $name $*" >&2; exit 2 ;;
esac
`;

function runCliWithMockAuth(scenario, args = [], { scope = 'user', env = {}, input, entrypoint = [cliPath] } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'gh-setup-git-identity-auth-'));
  const callsFile = join(cwd, 'calls');
  try {
    writeFileSync(join(cwd, 'gh'), mockCommands, { mode: 0o755 });
    writeFileSync(join(cwd, 'git'), mockCommands, { mode: 0o755 });
    writeFileSync(callsFile, '');
    const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(GH_|GITHUB_(?:ENTERPRISE_)?TOKEN$)/.test(key)
    ));
    const result = spawnSync(process.execPath, [...entrypoint, ...args], {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      input,
      env: {
        ...cleanEnv,
        PATH: `${cwd}:${cleanEnv.PATH}`,
        MOCK_CALLS: callsFile,
        MOCK_LOGIN: join(cwd, 'login'),
        MOCK_SCENARIO: scenario,
        MOCK_SCOPE: scope,
        ...env
      }
    });
    if (result.error) throw result.error;
    return { ...result, calls: readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean) };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const loginCalls = (calls) => calls.filter((call) => call.startsWith('gh auth login '));
const configCalls = (calls) => calls.filter((call) => call.startsWith('git config '));

test('CLI signs in again when an authenticated account lacks the user scope', () => {
  const { status, stdout, stderr, calls } = runCliWithMockAuth('missing-scope');
  assert.equal(status, 0, stderr);
  assert.deepEqual(loginCalls(calls), [
    'gh auth login -h github.com -s repo,workflow,user,read:org,gist --git-protocol https --web'
  ]);
  assert.equal(calls.filter((call) => call.startsWith('gh api user --')).length, 2);
  assert.equal(calls.filter((call) => call.startsWith('gh api user/emails ')).length, 2);
  assert.deepEqual(configCalls(calls), [
    'git config --global user.name new-account',
    'git config --global user.email new@example.test'
  ]);
  assert.equal(calls.filter((call) => call === 'gh auth setup-git -h github.com').length, 1);
  assert.ok(calls.indexOf('gh auth setup-git -h github.com') > calls.indexOf(loginCalls(calls)[0]));
  assert.ok(stdout.includes('Git identity setup complete!'));
});

test('CLI recovery uses the selected host, flags, scopes and local Git configuration', () => {
  const { status, stderr, calls } = runCliWithMockAuth('missing-scope', [
    '--hostname', 'enterprise.example.test', '--scopes', 'repo, workflow',
    '--git-protocol', 'ssh', '--skip-ssh-key', '--insecure-storage', '--clipboard', '--local'
  ], { scope: 'user:email' });
  assert.equal(status, 0, stderr);
  assert.deepEqual(loginCalls(calls), [
    'gh auth login -h enterprise.example.test -s repo,workflow,user:email --git-protocol ssh --web --skip-ssh-key --insecure-storage --clipboard'
  ]);
  assert.ok(calls.includes('gh auth status --hostname enterprise.example.test --active'));
  const apiCalls = calls.filter((call) => call.startsWith('gh api '));
  assert.equal(apiCalls.length, 4);
  assert.ok(apiCalls.every((call) => call.includes('--hostname enterprise.example.test')));
  assert.ok(calls.includes('gh auth setup-git -h enterprise.example.test'));
  assert.deepEqual(configCalls(calls), [
    'git config --local user.name new-account',
    'git config --local user.email new@example.test'
  ]);
});

test('CLI keeps the original authentication failure when recovery is disabled', () => {
  for (const option of ['--repair', '--no-auto-login', '--dry-run']) {
    const { status, stderr, calls } = runCliWithMockAuth('missing-scope', [option]);
    assert.equal(status, 1, option);
    assert.ok(stderr.includes('This API operation needs the "user" scope.'));
    assert.deepEqual(loginCalls(calls), []);
    assert.deepEqual(configCalls(calls), []);
  }
});

test('CLI attempts recovery once when login is canceled or permissions remain missing', () => {
  for (const scenario of ['cancel', 'persistent', 'signed-out']) {
    const { status, stderr, calls } = runCliWithMockAuth(scenario);
    assert.equal(status, 1, scenario);
    assert.ok(stderr.includes('This API operation needs the "user" scope.'));
    assert.equal(loginCalls(calls).length, 1);
    assert.deepEqual(configCalls(calls), []);
  }
});

test('CLI leaves unrelated failures and a usable account on the existing path', () => {
  for (const scenario of ['bare-404', 'no-primary', 'healthy']) {
    const { status, calls } = runCliWithMockAuth(scenario);
    assert.equal(status, scenario === 'healthy' ? 0 : 1, scenario);
    assert.deepEqual(loginCalls(calls), []);
    assert.equal(configCalls(calls).length, scenario === 'healthy' ? 2 : 0);
  }
});

test('CLI keeps dry-run read-only and retains first-time login', () => {
  const preview = runCliWithMockAuth('healthy', ['--dry-run']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.ok(preview.stdout.includes('[DRY MODE] Would configure'));
  assert.deepEqual(loginCalls(preview.calls), []);
  assert.deepEqual(configCalls(preview.calls), []);
  assert.ok(!preview.calls.some((call) => call.startsWith('gh auth setup-git ')));

  for (const option of ['--repair', '--no-auto-login', '--dry-run']) {
    const signedOut = runCliWithMockAuth('fresh-login', [option]);
    assert.equal(signedOut.status, 1, option);
    assert.ok(signedOut.stderr.includes('GitHub CLI is not authenticated.'));
    assert.deepEqual(loginCalls(signedOut.calls), []);
  }

  const firstRun = runCliWithMockAuth('fresh-login');
  assert.equal(firstRun.status, 0, firstRun.stderr);
  assert.equal(loginCalls(firstRun.calls).length, 1);
  assert.equal(configCalls(firstRun.calls).length, 2);
});

test('CLI still recovers with gh versions without the active-account status flag', () => {
  const { status, stderr, calls } = runCliWithMockAuth('legacy-gh');
  assert.equal(status, 0, stderr);
  assert.deepEqual(calls.slice(0, 2), [
    'gh auth status --hostname github.com --active',
    'gh auth status --hostname github.com'
  ]);
  assert.equal(loginCalls(calls).length, 1);
});

test('CLI explains how to replace an environment token lacking email permission', () => {
  const { status, stderr, calls } = runCliWithMockAuth('pat-denied', [], {
    env: { GH_TOKEN: 'fixture-environment-token' }
  });
  assert.equal(status, 1);
  assert.ok(stderr.includes('Remove or replace GH_TOKEN'));
  assert.ok(stderr.includes('Email addresses: Read'));
  assert.ok(!stderr.includes('fixture-environment-token'));
  assert.deepEqual(loginCalls(calls), []);
  assert.deepEqual(configCalls(calls), []);
});

test('CLI can read a replacement token from stdin during recovery', () => {
  const { status, stderr, calls } = runCliWithMockAuth('missing-scope', ['--with-token'], {
    input: 'fixture-token\n'
  });
  assert.equal(status, 0, stderr);
  assert.deepEqual(loginCalls(calls), [
    'gh auth login -h github.com --git-protocol https --with-token'
  ]);
});

test('Library callers opt in to interactive recovery through setupGitIdentity', () => {
  const moduleUrl = new URL('../src/index.js', import.meta.url).href;
  const runLibrary = (options) => runCliWithMockAuth('missing-scope', [], {
    entrypoint: ['--eval', `import { setupGitIdentity } from ${JSON.stringify(moduleUrl)};
      await setupGitIdentity(${JSON.stringify(options)});`]
  });

  const noninteractive = runLibrary({});
  assert.equal(noninteractive.status, 1);
  assert.ok(noninteractive.stderr.includes('This API operation needs the "user" scope.'));
  assert.deepEqual(loginCalls(noninteractive.calls), []);
  assert.deepEqual(configCalls(noninteractive.calls), []);

  const interactive = runLibrary({ authOptions: { hostname: 'enterprise.example.test' } });
  assert.equal(interactive.status, 0, interactive.stderr);
  assert.equal(loginCalls(interactive.calls).length, 1);
  assert.ok(loginCalls(interactive.calls)[0].startsWith('gh auth login -h enterprise.example.test '));
  assert.equal(configCalls(interactive.calls).length, 2);
});
