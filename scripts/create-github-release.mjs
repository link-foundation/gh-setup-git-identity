#!/usr/bin/env bun

/**
 * Create GitHub Release from CHANGELOG.md
 * Usage: node scripts/create-github-release.mjs --release-version <version> --repository <repository>
 *   release-version: Version number (e.g., 1.0.0)
 *   repository: GitHub repository (e.g., owner/repo)
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 * - lino-arguments: Unified configuration from CLI args, env vars, and .lenv files
 */

import { readFileSync } from 'fs';
import { USE_M_URL, COMMAND_STREAM, LINO_ARGUMENTS } from './release-deps.mjs';

// Load use-m dynamically
const { use } = eval(await (await fetch(USE_M_URL)).text());

// Import link-foundation libraries
const { $, shell } = await use(COMMAND_STREAM);
const { makeConfig } = await use(LINO_ARGUMENTS);

// Reject on a non-zero exit code. By default `await $` resolves, so a failed
// command would be reported as a success (issue #32).
shell.errexit(true);

// Parse CLI arguments using lino-arguments
// Note: Using --release-version instead of --version to avoid conflict with yargs' built-in --version flag
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('release-version', {
        type: 'string',
        default: getenv('VERSION', ''),
        describe: 'Version number (e.g., 1.0.0)',
      })
      .option('repository', {
        type: 'string',
        default: getenv('REPOSITORY', ''),
        describe: 'GitHub repository (e.g., owner/repo)',
      }),
});

const { releaseVersion: version, repository } = config;

if (!version || !repository) {
  console.error('Error: Missing required arguments');
  console.error(
    'Usage: node scripts/create-github-release.mjs --release-version <version> --repository <repository>'
  );
  process.exit(1);
}

const tag = `v${version}`;

console.log(`Creating GitHub release for ${tag}...`);

try {
  // Read CHANGELOG.md
  const changelog = readFileSync('./CHANGELOG.md', 'utf8');

  // Extract changelog entry for this version
  // Read from CHANGELOG.md between this version header and the next version header
  const versionHeaderRegex = new RegExp(`## ${version}[\\s\\S]*?(?=## \\d|$)`);
  const match = changelog.match(versionHeaderRegex);

  let releaseNotes = '';
  if (match) {
    // Remove the version header itself and trim
    releaseNotes = match[0].replace(`## ${version}`, '').trim();
  }

  if (!releaseNotes) {
    releaseNotes = `Release ${version}`;
  }

  // Create release using GitHub API with JSON input
  // This avoids shell escaping issues that occur when passing text via command-line arguments
  const payload = JSON.stringify({
    tag_name: tag,
    name: version,
    body: releaseNotes,
  });

  await $`gh api repos/${repository}/releases -X POST --input -`.run({
    stdin: payload,
  });

  console.log(`Created GitHub release: ${tag}`);
} catch (error) {
  console.error('Error creating release:', error.message);
  process.exit(1);
}
