#!/usr/bin/env bun

/**
 * gh-setup-git-identity CLI
 *
 * Command-line interface for setting up git identity based on GitHub user
 */

import { makeConfig } from 'lino-arguments';
import { setupGitIdentity, isGhAuthenticated, runGhAuthLogin, verifyGitIdentity } from './index.js';

// Parse command-line arguments with environment variable and .lenv support
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .usage('Usage: $0 [options]')
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
      .check((argv) => {
        // --global and --local are mutually exclusive
        if (argv.global && argv.local) {
          throw new Error('Arguments global and local are mutually exclusive');
        }
        return true;
      })
      .example('$0', 'Setup git identity globally using GitHub user')
      .example('$0 --local', 'Setup git identity for current repository only')
      .example('$0 --dry-run', 'Show what would be configured without making changes')
      .example('$0 --verify', 'Verify current git identity configuration')
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

    if (!authenticated) {
      console.log('GitHub CLI is not authenticated. Starting authentication...');

      // Automatically run gh auth login
      const loginSuccess = await runGhAuthLogin({ verbose: config.verbose });

      if (!loginSuccess) {
        console.log('');
        console.log('Authentication failed. Please try running manually:');
        console.log('  printf "y" | gh auth login -h github.com -s repo,workflow,user,read:org,gist --git-protocol https --web');
        process.exit(1);
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
