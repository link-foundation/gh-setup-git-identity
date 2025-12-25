# gh-setup-git-identity

A tool to setup git identity based on current GitHub user.

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

## Overview

`gh-setup-git-identity` is a CLI tool that simplifies setting up your git identity using your GitHub account. It automatically fetches your GitHub username and primary email address, then configures git with these values.

Instead of manually running:

```bash
printf "\n" | gh auth login -s repo,workflow,user,read:org,gist --git-protocol https --web

USERNAME=$(gh api user --jq '.login')
EMAIL=$(gh api user/emails --jq '.[] | select(.primary==true) | .email')

git config --global user.name "$USERNAME"
git config --global user.email "$EMAIL"
```

You can simply run:

```bash
gh-setup-git-identity
```

## Features

- **Automatic identity setup**: Fetches username and email from GitHub
- **Global and local configuration**: Configure git globally or per-repository
- **Authentication check**: Prompts you to login if not authenticated
- **Dry-run mode**: Preview changes without making them
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Verbose mode**: Built-in verbose mode for debugging

## Prerequisites

- Node.js >= 20.0.0
- Git (installed and configured)
- GitHub CLI (`gh`) installed

To install GitHub CLI, see: https://cli.github.com/

## Installation

### Global Installation (CLI)

```bash
npm install -g gh-setup-git-identity
```

### Local Installation (Library)

```bash
npm install gh-setup-git-identity
```

## CLI Usage

### Basic Usage

```bash
# Setup git identity globally (default)
gh-setup-git-identity

# Setup git identity for current repository only
gh-setup-git-identity --local

# Preview what would be configured (dry run)
gh-setup-git-identity --dry-run

# Enable verbose output
gh-setup-git-identity --verbose
```

### CLI Options

```
Usage: gh-setup-git-identity [options]

Options:
  --global, -g     Set git config globally (default: true)
  --local, -l      Set git config locally (in current repository)
  --dry-run, --dry Dry run - show what would be done without making changes
  --verbose, -v    Enable verbose output
  --help, -h       Show help
  --version        Show version number
```

### First Run (Not Authenticated)

If you haven't authenticated with GitHub CLI yet, the tool will prompt you:

```
GitHub CLI is not authenticated.

Please run the following command to login:

  printf "\n" | gh auth login -s repo,workflow,user,read:org,gist --git-protocol https --web

After logging in, run gh-setup-git-identity again.
```

### Successful Run

```
Fetching GitHub user information...
GitHub user: your-username
GitHub email: your-email@example.com

Configuring git (global)...
Git identity configured successfully!

Git configured:

  user.name:  your-username
  user.email: your-email@example.com

Scope: global (--global)

Git identity setup complete!
```

## Library Usage

### Basic Example

```javascript
import { setupGitIdentity, isGhAuthenticated } from 'gh-setup-git-identity';

// Check if authenticated first
const authenticated = await isGhAuthenticated();
if (!authenticated) {
  console.log('Please run: gh auth login');
  process.exit(1);
}

// Setup git identity
const result = await setupGitIdentity();
console.log('Configured:', result.username, result.email);

// Setup with options
const result2 = await setupGitIdentity({
  scope: 'local',      // 'global' or 'local'
  dryRun: true,        // Preview only
  verbose: true        // Enable verbose logging
});
```

### API Reference

#### `isGhAuthenticated(options?)`

Check if GitHub CLI is authenticated.

**Returns:** `Promise<boolean>`

#### `getGitHubUserInfo(options?)`

Get GitHub user information (username and primary email).

**Returns:** `Promise<{username: string, email: string}>`

#### `setupGitIdentity(options?)`

Setup git identity based on GitHub user.

**Parameters:**
- `options.scope` - `'global'` or `'local'` (default: `'global'`)
- `options.dryRun` - Preview only, don't make changes (default: `false`)
- `options.verbose` - Enable verbose logging (default: `false`)
- `options.logger` - Custom logger (default: `console`)

**Returns:** `Promise<{username: string, email: string}>`

#### `verifyGitIdentity(options?)`

Get current git identity configuration.

**Returns:** `Promise<{username: string|null, email: string|null}>`

## Configuration

### Environment Variables

- `GH_SETUP_GIT_IDENTITY_GLOBAL` - Set global config (default: `true`)
- `GH_SETUP_GIT_IDENTITY_LOCAL` - Set local config (default: `false`)
- `GH_SETUP_GIT_IDENTITY_DRY_RUN` - Enable dry run mode (default: `false`)
- `GH_SETUP_GIT_IDENTITY_VERBOSE` - Enable verbose output (default: `false`)

## Testing

Run tests using your preferred runtime:

```bash
# Node.js
npm test

# Bun
bun test

# Deno
deno test --allow-all
```

## Development

### Project Structure

```
gh-setup-git-identity/
├── src/
│   ├── index.js          # Core library
│   └── cli.js            # CLI interface
├── test/
│   └── index.test.js     # Tests
├── .changeset/           # Changesets for versioning
├── .github/
│   └── workflows/        # CI/CD workflows
├── package.json
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This is free and unencumbered software released into the public domain. See [LICENSE](LICENSE) for details.

## Links

- GitHub Repository: https://github.com/link-foundation/gh-setup-git-identity
- Issue Tracker: https://github.com/link-foundation/gh-setup-git-identity/issues
- Link Foundation: https://github.com/link-foundation

## Related Projects

- [gh-upload-log](https://github.com/link-foundation/gh-upload-log) - Upload log files to GitHub
- [lino-arguments](https://github.com/link-foundation/lino-arguments) - CLI argument parsing
- [log-lazy](https://github.com/link-foundation/log-lazy) - Efficient lazy evaluation logging
- [command-stream](https://github.com/link-foundation/command-stream) - Streamable commands
