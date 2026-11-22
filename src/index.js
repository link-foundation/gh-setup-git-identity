#!/usr/bin/env bun

/**
 * gh-setup-git-identity - Core library for setting up git identity
 *
 * This library provides functionality to:
 * - Check if GitHub CLI is authenticated
 * - Get GitHub user information (username and email)
 * - Configure git user.name and user.email
 */

import { spawn } from 'node:child_process';
import makeLog from 'log-lazy';

/**
 * Create a logger instance
 * This can be customized by users when using the library
 */
function createDefaultLogger(options = {}) {
  const { verbose = false, logger = console } = options;

  const log = makeLog({
    level: verbose ? 'development' : 'info',
    log: {
      fatal: logger.error || logger.log,
      error: logger.error || logger.log,
      warn: logger.warn || logger.log,
      info: logger.log,
      debug: logger.debug || logger.log,
      verbose: logger.log,
      trace: logger.log,
      silly: logger.log
    }
  });

  return log;
}

/**
 * Execute a command and return the result
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - The command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function execCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'pipe', shell: false, ...options });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: exitCode || 0
      });
    });

    child.on('error', (error) => {
      resolve({
        stdout: stdout.trim(),
        stderr: error.message,
        exitCode: 1
      });
    });
  });
}

/**
 * Execute an interactive command (inheriting stdio)
 *
 * @param {string} command - The command to execute
 * @param {string[]} args - The command arguments
 * @param {Object} options - Options
 * @param {string} options.input - Optional input to pipe to stdin
 * @returns {Promise<{exitCode: number}>}
 */
function execInteractiveCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const { input } = options;
    const child = spawn(command, args, {
      stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
      shell: false
    });

    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1
      });
    });

    child.on('error', (error) => {
      console.error(`Failed to execute command: ${error.message}`);
      resolve({
        exitCode: 1
      });
    });
  });
}

/**
 * Default options for gh auth login
 */
export const defaultAuthOptions = {
  hostname: 'github.com',
  scopes: 'repo,workflow,user,read:org,gist',
  gitProtocol: 'https',
  web: true,
  withToken: false,
  skipSshKey: false,
  insecureStorage: false,
  clipboard: false
};

/**
 * Run gh auth login interactively
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitHub hostname (default: 'github.com')
 * @param {string} options.scopes - OAuth scopes, comma-separated (default: 'repo,workflow,user,read:org,gist')
 * @param {string} options.gitProtocol - Git protocol: 'ssh' or 'https' (default: 'https')
 * @param {boolean} options.web - Open browser to authenticate (default: true)
 * @param {boolean} options.withToken - Read token from stdin (default: false)
 * @param {boolean} options.skipSshKey - Skip SSH key generation/upload prompt (default: false)
 * @param {boolean} options.insecureStorage - Store credentials in plain text (default: false)
 * @param {boolean} options.clipboard - Copy OAuth code to clipboard (default: false)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if login was successful
 */
export async function runGhAuthLogin(options = {}) {
  const {
    hostname = defaultAuthOptions.hostname,
    scopes = defaultAuthOptions.scopes,
    gitProtocol = defaultAuthOptions.gitProtocol,
    web = defaultAuthOptions.web,
    withToken = defaultAuthOptions.withToken,
    skipSshKey = defaultAuthOptions.skipSshKey,
    insecureStorage = defaultAuthOptions.insecureStorage,
    clipboard = defaultAuthOptions.clipboard,
    verbose = false,
    logger = console
  } = options;

  const log = createDefaultLogger({ verbose, logger });

  // Build the arguments for gh auth login
  const args = ['auth', 'login'];

  // Add hostname
  if (hostname) {
    args.push('-h', hostname);
  }

  // Add scopes
  if (scopes && !withToken) {
    args.push('-s', scopes);
  }

  // Add git protocol
  if (gitProtocol) {
    args.push('--git-protocol', gitProtocol);
  }

  // Add boolean flags
  if (web && !withToken) {
    args.push('--web');
  }

  if (withToken) {
    args.push('--with-token');
  }

  if (skipSshKey) {
    args.push('--skip-ssh-key');
  }

  if (insecureStorage) {
    args.push('--insecure-storage');
  }

  if (clipboard && web && !withToken) {
    args.push('--clipboard');
  }

  log.debug(() => `Running: gh ${args.join(' ')}`);

  // Run gh auth login
  // Use 'y' as input to confirm default account selection (only needed for interactive mode)
  const inputValue = withToken ? undefined : 'y\n';
  const result = await execInteractiveCommand('gh', args, { input: inputValue });

  if (result.exitCode !== 0) {
    log.error(() => 'GitHub CLI authentication failed');
    return false;
  }

  log(() => '\nGitHub CLI authentication successful!');
  return true;
}

/**
 * Run gh auth setup-git to configure git to use GitHub CLI as credential helper
 *
 * This command configures git to use GitHub CLI as a credential helper for HTTPS operations.
 * Without this, git push/pull may fail with "could not read Username" error when using HTTPS protocol.
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitHub hostname (default: 'github.com')
 * @param {boolean} options.force - Force setup even if the host is not known (default: false)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if setup was successful
 */
export async function runGhAuthSetupGit(options = {}) {
  const {
    hostname = defaultAuthOptions.hostname,
    force = false,
    verbose = false,
    logger = console
  } = options;

  const log = createDefaultLogger({ verbose, logger });

  // Build the arguments for gh auth setup-git
  const args = ['auth', 'setup-git'];

  // Add hostname
  if (hostname) {
    args.push('-h', hostname);
  }

  // Add force flag if specified
  if (force) {
    args.push('--force');
  }

  log.debug(() => `Running: gh ${args.join(' ')}`);

  const result = await execCommand('gh', args);

  if (result.exitCode !== 0) {
    log.error(() => `Failed to setup git credential helper: ${result.stderr}`);
    return false;
  }

  log(() => 'Git credential helper configured for GitHub CLI');
  return true;
}

/**
 * Check if GitHub CLI is authenticated
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - Check the active account for this host
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<boolean>} True if authenticated
 */
export async function isGhAuthenticated(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });
  const args = ['auth', 'status'];
  if (hostname) {
    args.push('--hostname', hostname, '--active');
  }

  log.debug(() => `Running: gh ${args.join(' ')}`);

  let result = await execCommand('gh', args);
  if (hostname && result.exitCode !== 0 && /^unknown flag: --active\r?$/m.test(result.stderr)) {
    // Older GitHub CLI releases can scope status to a host but cannot filter by active account.
    args.pop();
    log.debug(() => `Running: gh ${args.join(' ')}`);
    result = await execCommand('gh', args);
  }

  if (result.exitCode !== 0) {
    log.debug(() => `GitHub CLI is not authenticated: ${result.stderr}`);
    return false;
  }

  log.debug(() => 'GitHub CLI is authenticated');
  return true;
}

/**
 * Get GitHub username from authenticated user
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitHub hostname (defaults to gh's API host)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string>} GitHub username
 */
export async function getGitHubUsername(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug(() => 'Getting GitHub username...');

  const result = await queryGitHub('user', '.login', hostname);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get GitHub username: ${result.stderr}`);
  }

  const username = result.stdout;
  log.debug(() => `GitHub username: ${username}`);

  return username;
}

function queryGitHub(endpoint, filter, hostname) {
  const args = ['api', endpoint, '--jq', filter];
  if (hostname) {
    args.push('--hostname', hostname);
  }
  return execCommand('gh', args);
}

function environmentTokenVariable(hostname) {
  const host = (hostname || process.env.GH_HOST || defaultAuthOptions.hostname).toLowerCase();
  const useCloudToken = /(?:^|\.)(?:github\.com|github\.localhost)$|\.ghe\.com$/.test(host);
  const names = useCloudToken
    ? ['GH_TOKEN', 'GITHUB_TOKEN']
    : ['GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN'];
  return names.find((name) => process.env[name]);
}

class GitHubEmailPermissionError extends Error {
  constructor(stderr, requiredScope, tokenVariable) {
    const guidance = tokenVariable
      ? `\nRemove or replace ${tokenVariable}. Use a classic token with user:email (or user), or a fine-grained token with Email addresses: Read.`
      : '';
    super(`Failed to get GitHub email: ${stderr}${guidance}`);
    this.requiredScope = requiredScope;
    this.tokenVariable = tokenVariable;
  }
}

/**
 * Get primary email from GitHub user
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitHub hostname (defaults to gh's API host)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string>} Primary email address
 */
export async function getGitHubEmail(options = {}) {
  const { hostname, verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  log.debug(() => 'Getting GitHub primary email...');

  const result = await queryGitHub('user/emails', '.[] | select(.primary==true) | .email', hostname);

  if (result.exitCode !== 0) {
    const scope = result.stderr.match(/^gh: This API operation needs the "(user(?::email)?)" scope\./m)?.[1];
    const tokenDenied = /^gh: Resource not accessible by (?:personal access token|integration) \(HTTP 403\)$/m.test(result.stderr);
    if (scope || tokenDenied) {
      const tokenVariable = environmentTokenVariable(hostname);
      throw new GitHubEmailPermissionError(result.stderr, scope || 'user:email', tokenVariable);
    }
    throw new Error(`Failed to get GitHub email: ${result.stderr}`);
  }

  const email = result.stdout;

  if (!email) {
    throw new Error('No primary email found on GitHub account. Please set a primary email in your GitHub settings.');
  }

  log.debug(() => `GitHub primary email: ${email}`);

  return email;
}

/**
 * Get GitHub user information (username and primary email)
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitHub hostname (defaults to gh's API host)
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<{username: string, email: string}>} User information
 */
export async function getGitHubUserInfo(options = {}) {
  const [username, email] = await Promise.allSettled([
    getGitHubUsername(options),
    getGitHubEmail(options)
  ]);

  if (username.status === 'rejected') throw username.reason;
  if (email.status === 'rejected') throw email.reason;
  return { username: username.value, email: email.value };
}

/**
 * Set git config value
 *
 * @param {string} key - Config key (e.g., 'user.name')
 * @param {string} value - Config value
 * @param {Object} options - Options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<void>}
 */
export async function setGitConfig(key, value, options = {}) {
  const { scope = 'global', verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  const scopeFlag = scope === 'local' ? '--local' : '--global';

  log.debug(() => `Setting git config ${key} = ${value} (${scope})`);

  const result = await execCommand('git', ['config', scopeFlag, key, value]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to set git config ${key}: ${result.stderr}`);
  }

  log.debug(() => `Successfully set git config ${key}`);
}

/**
 * Get git config value
 *
 * @param {string} key - Config key (e.g., 'user.name')
 * @param {Object} options - Options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<string|null>} Config value or null if not set
 */
export async function getGitConfig(key, options = {}) {
  const { scope = 'global', verbose = false, logger = console } = options;
  const log = createDefaultLogger({ verbose, logger });

  const scopeFlag = scope === 'local' ? '--local' : '--global';

  log.debug(() => `Getting git config ${key} (${scope})`);

  const result = await execCommand('git', ['config', scopeFlag, key]);

  if (result.exitCode !== 0) {
    log.debug(() => `Git config ${key} not set`);
    return null;
  }

  const value = result.stdout;
  log.debug(() => `Git config ${key} = ${value}`);

  return value;
}

/**
 * Setup git identity based on GitHub user
 *
 * @param {Object} options - Options
 * @param {string} options.hostname - GitHub hostname (defaults to gh's API host without authOptions)
 * @param {Object} options.authOptions - Opt in to one login on an email permission error, with runGhAuthLogin options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.dryRun - Dry run mode (default: false)
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @param {Object} options.logger - Custom logger (default: console)
 * @returns {Promise<{username: string, email: string}>} Configured identity
 */
export async function setupGitIdentity(options = {}) {
  const {
    scope = 'global',
    dryRun = false,
    authOptions,
    verbose = false,
    logger = console
  } = options;

  const hostname = options.hostname ?? authOptions?.hostname ?? (authOptions ? defaultAuthOptions.hostname : undefined);
  const log = createDefaultLogger({ verbose, logger });
  const userInfoOptions = { hostname, verbose, logger };

  log(() => '\nFetching GitHub user information...');

  let identity;
  try {
    identity = await getGitHubUserInfo(userInfoOptions);
  } catch (error) {
    if (!(error instanceof GitHubEmailPermissionError) || !authOptions || dryRun || error.tokenVariable) {
      throw error;
    }

    log.debug(() => `GitHub email lookup failed on ${hostname}: ${error.message}`);
    log(() => 'The current GitHub credential cannot read your email addresses. Starting authentication...');
    const scopes = (authOptions.scopes ?? defaultAuthOptions.scopes).split(',').map((value) => value.trim()).filter(Boolean);
    if (!scopes.includes('user') && !scopes.includes('user:email')) {
      scopes.push(error.requiredScope);
    }
    const loginSuccess = await runGhAuthLogin({ ...authOptions, hostname, scopes: scopes.join(','), verbose, logger });
    if (!loginSuccess) throw error;

    log.debug(() => `Retrying GitHub username and primary email lookup on ${hostname}`);
    // Login can change the active account, so refetch both identity fields.
    identity = await getGitHubUserInfo(userInfoOptions);
  }
  const { username, email } = identity;

  log(() => `  GitHub user: ${username}`);
  log(() => `  GitHub email: ${email}`);

  if (dryRun) {
    log(() => 'DRY MODE: Would configure the following:');
    log(() => `  git config --${scope} user.name "${username}"`);
    log(() => `  git config --${scope} user.email "${email}"`);
    return { username, email };
  }

  // Set git config
  log(() => `\nConfiguring git (${scope})...`);

  await setGitConfig('user.name', username, { scope, verbose, logger });
  await setGitConfig('user.email', email, { scope, verbose, logger });

  log(() => '  Git identity configured successfully!');

  return { username, email };
}

/**
 * Verify git identity is configured correctly
 *
 * @param {Object} options - Options
 * @param {string} options.scope - 'global' or 'local' (default: 'global')
 * @param {boolean} options.verbose - Enable verbose logging
 * @param {Object} options.logger - Custom logger
 * @returns {Promise<{username: string|null, email: string|null}>} Current git identity
 */
export async function verifyGitIdentity(options = {}) {
  const { scope = 'global', verbose = false, logger = console } = options;

  const username = await getGitConfig('user.name', { scope, verbose, logger });
  const email = await getGitConfig('user.email', { scope, verbose, logger });

  return { username, email };
}

export default {
  defaultAuthOptions,
  isGhAuthenticated,
  runGhAuthLogin,
  runGhAuthSetupGit,
  getGitHubUsername,
  getGitHubEmail,
  getGitHubUserInfo,
  setGitConfig,
  getGitConfig,
  setupGitIdentity,
  verifyGitIdentity
};
