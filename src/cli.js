#!/usr/bin/env bun

/**
 * gh-setup-git-identity CLI
 *
 * Command-line interface for setting up git identity based on GitHub user
 */

import { makeConfig } from 'lino-arguments';
import { setupGitIdentity, isGhAuthenticated, runGhAuthLogin } from './index.js';

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
      .help('h')
      .alias('h', 'help')
      .version('0.1.0')
      .strict(),
});

/**
 * Main CLI function
 */
async function main() {
  try {
    // Determine scope
    const scope = config.local ? 'local' : 'global';

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
    console.log(`${options.dryRun ? '[DRY MODE] Would configure' : 'Git configured'}:`);
    console.log(`  user.name:  ${result.username}`);
    console.log(`  user.email: ${result.email}`);
    console.log(`Scope: ${scope === 'global' ? 'global (--global)' : 'local (--local)'}`);
    console.log('');

    if (!options.dryRun) {
      console.log('Git identity setup complete!');
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
