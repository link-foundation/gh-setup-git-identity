# gh-setup-git-identity

A tool to setup git identity based on current GitHub user.

[![npm version](https://img.shields.io/npm/v/gh-setup-git-identity)](https://www.npmjs.com/package/gh-setup-git-identity)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)
[![Bun Version](https://img.shields.io/badge/bun-%3E%3D1.0.0-brightgreen.svg)](https://bun.sh/)

## Overview

`gh-setup-git-identity` is a CLI tool that simplifies setting up your git identity using your GitHub account. It automatically fetches your GitHub username and primary email address, then configures git with these values.

Instead of manually running:

```bash
printf "y" | gh auth login -h github.com -s repo,workflow,user,read:org,gist --git-protocol https --web
gh auth setup-git -h github.com

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
- **Git credential helper setup**: Automatically runs `gh auth setup-git` to configure git to use GitHub CLI for HTTPS authentication
- **Dry-run mode**: Preview changes without making them
- **Cross-platform**: Works on macOS, Linux, and Windows
- **Verbose mode**: Built-in verbose mode for debugging

## Prerequisites

- Bun >= 1.0.0
- Git (installed and configured)
- GitHub CLI (`gh`) installed

To install Bun, see: https://bun.sh/
To install GitHub CLI, see: https://cli.github.com/

## Installation

### Global Installation (CLI)

```bash
bun install -g gh-setup-git-identity
```

### Local Installation (Library)

```bash
bun install gh-setup-git-identity
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

# Verify current git identity configuration
gh-setup-git-identity --verify

# Enable verbose output
gh-setup-git-identity --verbose
```

### CLI Options

```
Usage: gh-setup-git-identity [options]

Git Identity Options:
  --global, -g         Set git config globally (default: true)
  --local, -l          Set git config locally (in current repository)
  --dry-run, --dry     Dry run - show what would be done without making changes
  --verify             Verify current git identity configuration
  --verbose, -v        Enable verbose output

GitHub Authentication Options:
  --hostname           GitHub hostname to authenticate with (default: github.com)
  --scopes, -s         Authentication scopes, comma-separated (default: repo,workflow,user,read:org,gist)
  --git-protocol, -p   Protocol for git operations: ssh or https (default: https)
  --web, -w            Open a browser to authenticate (default: true)
  --with-token         Read token from standard input
  --skip-ssh-key       Skip generate/upload SSH key prompt
  --insecure-storage   Save credentials in plain text instead of credential store
  --clipboard          Copy one-time OAuth device code to clipboard

General Options:
  --help, -h           Show help
  --version            Show version number
```

### Advanced Authentication Examples

```bash
# Authenticate with GitHub Enterprise
gh-setup-git-identity --hostname enterprise.github.com

# Use SSH protocol instead of HTTPS
gh-setup-git-identity --git-protocol ssh

# Authenticate with custom scopes
gh-setup-git-identity --scopes repo,user,gist

# Use token-based authentication (reads from stdin)
echo "ghp_xxxxx" | gh-setup-git-identity --with-token

# Copy OAuth code to clipboard automatically
gh-setup-git-identity --clipboard

# Skip SSH key generation prompt
gh-setup-git-identity --git-protocol ssh --skip-ssh-key

# Store credentials in plain text (not recommended for production)
gh-setup-git-identity --insecure-storage
```

### First Run (Not Authenticated)

If you haven't authenticated with GitHub CLI yet, the tool will automatically start the authentication process:

```
GitHub CLI is not authenticated. Starting authentication...

Starting GitHub CLI authentication...

! First copy your one-time code: XXXX-XXXX
Press Enter to open github.com in your browser...
```

The tool runs `gh auth login` automatically with the required scopes (`repo,workflow,user,read:org,gist`), followed by `gh auth setup-git` to configure git to use GitHub CLI as the credential helper. Follow the browser-based authentication flow to complete login.

If automatic authentication fails, you can run the commands manually:

```bash
printf "y" | gh auth login -h github.com -s repo,workflow,user,read:org,gist --git-protocol https --web
gh auth setup-git -h github.com
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

You can verify your configuration with:
  gh auth status
  git config --global user.name
  git config --global user.email
```

### Verifying Configuration

You can verify your git identity configuration at any time using:

```bash
gh-setup-git-identity --verify
```

Or by running the three verification commands directly:

```bash
gh auth status
git config --global user.name
git config --global user.email
```

For local repository configuration, use `--local`:

```bash
gh-setup-git-identity --verify --local
```

Or:

```bash
gh auth status
git config --local user.name
git config --local user.email
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

#### `runGhAuthLogin(options?)`

Run `gh auth login` with configurable options.

**Parameters:**
- `options.hostname` - GitHub hostname (default: `'github.com'`)
- `options.scopes` - OAuth scopes, comma-separated (default: `'repo,workflow,user,read:org,gist'`)
- `options.gitProtocol` - Git protocol: `'ssh'` or `'https'` (default: `'https'`)
- `options.web` - Open browser to authenticate (default: `true`)
- `options.withToken` - Read token from stdin (default: `false`)
- `options.skipSshKey` - Skip SSH key prompt (default: `false`)
- `options.insecureStorage` - Store credentials in plain text (default: `false`)
- `options.clipboard` - Copy OAuth code to clipboard (default: `false`)
- `options.verbose` - Enable verbose logging (default: `false`)
- `options.logger` - Custom logger (default: `console`)

**Returns:** `Promise<boolean>` - `true` if login was successful

#### `runGhAuthSetupGit(options?)`

Run `gh auth setup-git` to configure git to use GitHub CLI as the credential helper.

This is automatically called after `gh auth login` and also when running `gh-setup-git-identity` to ensure git is properly configured for HTTPS operations. Without this, git push/pull may fail with "could not read Username" error.

**Parameters:**
- `options.hostname` - GitHub hostname (default: `'github.com'`)
- `options.force` - Force setup even if the host is not known (default: `false`)
- `options.verbose` - Enable verbose logging (default: `false`)
- `options.logger` - Custom logger (default: `console`)

**Returns:** `Promise<boolean>` - `true` if setup was successful

#### `defaultAuthOptions`

Default authentication options object that can be imported and used as a reference:

```javascript
{
  hostname: 'github.com',
  scopes: 'repo,workflow,user,read:org,gist',
  gitProtocol: 'https',
  web: true,
  withToken: false,
  skipSshKey: false,
  insecureStorage: false,
  clipboard: false
}
```

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

#### Git Identity Options

- `GH_SETUP_GIT_IDENTITY_GLOBAL` - Set global config (default: `true`)
- `GH_SETUP_GIT_IDENTITY_LOCAL` - Set local config (default: `false`)
- `GH_SETUP_GIT_IDENTITY_DRY_RUN` - Enable dry run mode (default: `false`)
- `GH_SETUP_GIT_IDENTITY_VERBOSE` - Enable verbose output (default: `false`)

#### GitHub Authentication Options

- `GH_AUTH_HOSTNAME` - GitHub hostname (default: `github.com`)
- `GH_AUTH_SCOPES` - Authentication scopes (default: `repo,workflow,user,read:org,gist`)
- `GH_AUTH_GIT_PROTOCOL` - Git protocol: `ssh` or `https` (default: `https`)
- `GH_AUTH_WEB` - Open browser for authentication (default: `true`)
- `GH_AUTH_SKIP_SSH_KEY` - Skip SSH key prompt (default: `false`)
- `GH_AUTH_INSECURE_STORAGE` - Store credentials in plain text (default: `false`)
- `GH_AUTH_CLIPBOARD` - Copy OAuth code to clipboard (default: `false`)

## Testing

Run tests using bun:

```bash
bun test
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
