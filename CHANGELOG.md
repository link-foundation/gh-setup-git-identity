# gh-setup-git-identity

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
