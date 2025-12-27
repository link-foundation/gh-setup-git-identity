# gh-setup-git-identity

## 0.4.1

### Patch Changes

- 43e1c63: Reduce excessive blank lines in console output

  - Removed unnecessary blank lines in CLI output to make it more concise
  - Improved readability by minimizing spacing while maintaining logical separation
  - Fixed issue where authentication and configuration messages had too much whitespace

## 0.4.0

### Minor Changes

- bda1ef5: Make project bun-first and bun-only

  - Updated all shebangs from `#!/usr/bin/env node` to `#!/usr/bin/env bun`
  - Replaced npm commands with bun in package.json scripts
  - Updated README.md to recommend bun installation and usage
  - Modified GitHub Actions workflows to use bun instead of node
  - Changed package.json engines from node to bun
  - Simplified test matrix to only use bun (removed node and deno)

## 0.3.1

### Patch Changes

- 51dceeb: Fix release notes formatting to support Major and Minor changes

  Previously, the format-release-notes.mjs script only looked for "### Patch Changes" sections in release notes. This caused releases with Minor or Major changes (like v0.3.0) to not be properly formatted with PR links and npm badges.

  Updated the regex pattern to handle all three change types (Major, Minor, and Patch), matching the release template from test-anywhere repository.

## 0.3.0

### Minor Changes

- 8c146cc: Automatically run `gh auth login` when GitHub CLI is not authenticated, enabling single-command setup instead of requiring manual login first

## 0.2.3

### Patch Changes

- Test patch release

## 0.2.2

### Patch Changes

- cead870: Add NPM version badge to README.md to display current package version from npm registry

## 0.2.1

### Patch Changes

- 6158223: Update gh auth login command in docs and CLI to use `--git-protocol https --web` flags for improved browser-based authentication flow

## 0.2.0

### Minor Changes

- b8ecb63: Update CI/CD pipeline and testing framework to match test-anywhere patterns

  - Consolidate GitHub Actions workflow into single release.yml file
  - Add unified test matrix for Node.js, Bun, and Deno across Ubuntu, macOS, and Windows
  - Add Node.js scripts for release automation (validate-changeset, version-and-commit, publish-to-npm, etc.)
  - Add support for manual releases via workflow_dispatch (instant and changeset-pr modes)
  - Add npm OIDC trusted publishing support
  - Add GitHub release formatting with shields.io badges and PR links
  - Update changeset configuration to use @changesets/cli/changelog
  - Add changeset:status script for checking changeset status
