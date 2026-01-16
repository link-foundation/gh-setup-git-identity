#!/usr/bin/env bun

/**
 * gh-setup-git-identity CLI
 *
 * Command-line interface for setting up git identity based on GitHub user
 */

import { makeConfig } from 'lino-arguments';
import { setupGitIdentity, isGhAuthenticated, runGhAuthLogin, runGhAuthSetupGit, verifyGitIdentity, defaultAuthOptions } from './index.js';

// Parse command-line arguments with environment variable and .lenv support
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .usage('Usage: $0 [options]')
      // Git identity options
      .option('global', {
        alias: 'g',
        type: 'boolean',
        description: 'Set git config globally (default)',
        default: false
      })
      .option('local', {
        alias: 'l',
        type: 'boolean',
        description: 'Set git config locally (in current repository)',
        default: getenv('GH_SETUP_GIT_IDENTITY_LOCAL', false)
      })
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Enable verbose output',
        default: getenv('GH_SETUP_GIT_IDENTITY_VERBOSE', false)
      })
      .option('dry-run', {
        alias: 'dry',
        type: 'boolean',
        description: 'Dry run mode - show what would be done without making changes',
        default: getenv('GH_SETUP_GIT_IDENTITY_DRY_RUN', false)
      })
      .option('verify', {
        type: 'boolean',
        description: 'Verify current git identity configuration',
        default: false
      })
      .option('repair', {
        type: 'boolean',
        description: 'Repair git identity configuration without triggering login (requires existing authentication)',
        default: false
      })
      .option('no-auto-login', {
        type: 'boolean',
        description: 'Disable automatic login if not authenticated (exit with error instead)',
        default: false
      })
      // gh auth login options
      .option('hostname', {
        type: 'string',
        description: 'GitHub hostname to authenticate with',
        default: getenv('GH_AUTH_HOSTNAME', defaultAuthOptions.hostname)
      })
      .option('scopes', {
        alias: 's',
        type: 'string',
        description: 'Additional authentication scopes to request (comma-separated)',
        default: getenv('GH_AUTH_SCOPES', defaultAuthOptions.scopes)
      })
      .option('git-protocol', {
        alias: 'p',
        type: 'string',
        description: 'Protocol for git operations: ssh or https',
        choices: ['ssh', 'https'],
        default: getenv('GH_AUTH_GIT_PROTOCOL', defaultAuthOptions.gitProtocol)
      })
      .option('web', {
        alias: 'w',
        type: 'boolean',
        description: 'Open a browser to authenticate',
        default: getenv('GH_AUTH_WEB', defaultAuthOptions.web)
      })
      .option('with-token', {
        type: 'boolean',
        description: 'Read token from standard input',
        default: false
      })
      .option('skip-ssh-key', {
        type: 'boolean',
        description: 'Skip generate/upload SSH key prompt',
        default: getenv('GH_AUTH_SKIP_SSH_KEY', defaultAuthOptions.skipSshKey)
      })
      .option('insecure-storage', {
        type: 'boolean',
        description: 'Save authentication credentials in plain text instead of credential store',
        default: getenv('GH_AUTH_INSECURE_STORAGE', defaultAuthOptions.insecureStorage)
      })
      .option('clipboard', {
        type: 'boolean',
        description: 'Copy one-time OAuth device code to clipboard',
        default: getenv('GH_AUTH_CLIPBOARD', defaultAuthOptions.clipboard)
      })
      .check((argv) => {
        // --global and --local are mutually exclusive
        if (argv.global && argv.local) {
          throw new Error('Arguments global and local are mutually exclusive');
        }
        // --web and --with-token are mutually exclusive
        if (argv.web && argv.withToken) {
          throw new Error('Arguments web and with-token are mutually exclusive');
        }
        return true;
      })
      .example('$0', 'Setup git identity globally using GitHub user')
      .example('$0 --local', 'Setup git identity for current repository only')
      .example('$0 --dry-run', 'Show what would be configured without making changes')
      .example('$0 --verify', 'Verify current git identity configuration')
      .example('$0 --hostname enterprise.github.com', 'Authenticate with GitHub Enterprise')
      .example('$0 --scopes repo,user,gist', 'Authenticate with custom scopes')
      .example('$0 --git-protocol ssh', 'Use SSH protocol for git operations')
      .example('$0 --with-token < token.txt', 'Authenticate using a token file')
      .example('$0 --repair', 'Repair git identity without triggering login')
      .example('$0 --no-auto-login', 'Fail if not authenticated instead of auto-login')
      .help('h')
      .alias('h', 'help')
      .version('0.1.0')
      .strict(),
});

/**
 * Run verification commands and display results
 * @param {string} scope - 'global' or 'local'
 * @param {boolean} verbose - Enable verbose logging
 */
async function runVerify(scope, verbose) {
  const scopeFlag = scope === 'local' ? '--local' : '--global';

  console.log('Verifying git identity configuration...');
  console.log('');

  // 1. Run gh auth status
  console.log('1. GitHub CLI authentication status:');
  console.log('   $ gh auth status');
  console.log('');

  const { spawn } = await import('node:child_process');

  // Run gh auth status interactively to show full output
  await new Promise((resolve) => {
    const child = spawn('gh', ['auth', 'status'], { stdio: 'inherit' });
    child.on('close', resolve);
    child.on('error', resolve);
  });

  console.log('');

  // 2. Get git config user.name
  console.log(`2. Git user.name (${scope}):`);
  console.log(`   $ git config ${scopeFlag} user.name`);

  const identity = await verifyGitIdentity({ scope, verbose });

  if (identity.username) {
    console.log(`   ${identity.username}`);
  } else {
    console.log('   (not set)');
  }

  console.log('');

  // 3. Get git config user.email
  console.log(`3. Git user.email (${scope}):`);
  console.log(`   $ git config ${scopeFlag} user.email`);

  if (identity.email) {
    console.log(`   ${identity.email}`);
  } else {
    console.log('   (not set)');
  }

  console.log('');
  console.log('Verification complete!');
}

/**
 * Main CLI function
 */
async function main() {
  try {
    // Determine scope
    const scope = config.local ? 'local' : 'global';

    // Handle --verify mode
    if (config.verify) {
      await runVerify(scope, config.verbose);
      process.exit(0);
    }

    // Check if gh is authenticated
    const authenticated = await isGhAuthenticated({ verbose: config.verbose });

    // Determine if auto-login should be disabled
    // --repair implies no auto-login (it's meant to fix config without triggering login)
    // --no-auto-login explicitly disables auto-login
    const skipAutoLogin = config.repair || config.noAutoLogin;

    if (!authenticated) {
      if (skipAutoLogin) {
        // In repair mode or with --no-auto-login, don't attempt to login
        console.error('GitHub CLI is not authenticated.');
        if (config.repair) {
          console.error('');
          console.error('The --repair option requires existing authentication.');
          console.error('Please authenticate first using one of these methods:');
        } else {
          console.error('');
          console.error('Automatic login is disabled (--no-auto-login).');
          console.error('Please authenticate manually using one of these methods:');
        }
        console.error('');
        console.error('  # Option 1: Interactive web-based login');
        console.error(`  gh auth login -h ${config.hostname} -s ${config.scopes} --git-protocol ${config.gitProtocol} --web`);
        console.error('');
        console.error('  # Option 2: Token-based login');
        console.error('  echo "ghp_your_token" | gh auth login --with-token');
        console.error('');
        console.error('  # Option 3: Use GH_TOKEN environment variable');
        console.error('  export GH_TOKEN="ghp_your_token"');
        process.exit(1);
      }

      console.log('GitHub CLI is not authenticated. Starting authentication...');
      console.log('');

      // Show token limit warning for OAuth device flow (not when using --with-token)
      if (!config.withToken) {
        console.log('Note: GitHub limits OAuth tokens to 10 per user/application.');
        console.log('      For multi-environment setups, consider using Personal Access Tokens.');
        console.log('      See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation');
        console.log('');
      }

      // Prepare auth options from CLI arguments
      const authOptions = {
        hostname: config.hostname,
        scopes: config.scopes,
        gitProtocol: config.gitProtocol,
        web: config.web,
        withToken: config.withToken,
        skipSshKey: config.skipSshKey,
        insecureStorage: config.insecureStorage,
        clipboard: config.clipboard,
        verbose: config.verbose
      };

      // Automatically run gh auth login with configured options
      const loginSuccess = await runGhAuthLogin(authOptions);

      if (!loginSuccess) {
        console.log('');
        console.log('Authentication failed. Please try running manually:');
        console.log(`  printf "y" | gh auth login -h ${config.hostname} -s ${config.scopes} --git-protocol ${config.gitProtocol} --web`);
        process.exit(1);
      }

      // After successful login, setup git credential helper
      // This is required for HTTPS git operations to work properly
      const setupGitSuccess = await runGhAuthSetupGit({
        hostname: config.hostname,
        verbose: config.verbose
      });

      if (!setupGitSuccess) {
        console.log('');
        console.log('Warning: Failed to setup git credential helper. You may need to run manually:');
        console.log(`  gh auth setup-git -h ${config.hostname}`);
        // Continue anyway, as identity setup might still work
      }
    } else {
      // Even if already authenticated, ensure git credential helper is configured
      // This helps fix cases where gh auth login was run but gh auth setup-git wasn't
      const setupGitSuccess = await runGhAuthSetupGit({
        hostname: config.hostname,
        verbose: config.verbose
      });

      if (!setupGitSuccess && config.verbose) {
        console.log('Note: Git credential helper may not be configured. Consider running:');
        console.log(`  gh auth setup-git -h ${config.hostname}`);
      }
    }

    // Prepare options
    const options = {
      scope,
      dryRun: config.dryRun,
      verbose: config.verbose
    };

    if (options.verbose) {
      console.log('Options:', options);
    }

    if (options.dryRun) {
      console.log('');
      console.log('DRY MODE - No actual changes will be made');
    }

    // Setup git identity
    const result = await setupGitIdentity(options);

    // Display results
    console.log('');
    console.log(`  ${options.dryRun ? '[DRY MODE] Would configure' : 'Git configured'}:`);
    console.log(`    user.name:  ${result.username}`);
    console.log(`    user.email: ${result.email}`);
    console.log(`  Scope: ${scope === 'global' ? 'global (--global)' : 'local (--local)'}`);

    if (!options.dryRun) {
      console.log('');
      console.log('Git identity setup complete!');
      console.log('');
      console.log('You can verify your configuration with:');
      console.log('  gh auth status');
      console.log(`  git config ${scope === 'global' ? '--global' : '--local'} user.name`);
      console.log(`  git config ${scope === 'global' ? '--global' : '--local'} user.email`);
    }

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('Error:', error.message);

    if (config.verbose) {
      console.error('Stack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the CLI
main();
