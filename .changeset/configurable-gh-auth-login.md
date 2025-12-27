---
"gh-setup-git-identity": minor
---

feat: fully configurable support of `gh auth login`

Added configurable options for GitHub authentication that mirror all `gh auth login` flags:
- `--hostname`: GitHub hostname (default: `github.com`) - enables GitHub Enterprise support
- `--scopes` / `-s`: Authentication scopes (default: `repo,workflow,user,read:org,gist`)
- `--git-protocol` / `-p`: Git protocol - `ssh` or `https` (default: `https`)
- `--web` / `-w`: Open browser to authenticate (default: `true`)
- `--with-token`: Read token from stdin for non-interactive authentication
- `--skip-ssh-key`: Skip SSH key generation/upload prompt
- `--insecure-storage`: Store credentials in plain text instead of credential store
- `--clipboard`: Copy OAuth code to clipboard

These options can be configured via:
- CLI flags
- Environment variables (`GH_AUTH_HOSTNAME`, `GH_AUTH_SCOPES`, etc.)
- `.lenv` configuration file

The library also exports `defaultAuthOptions` object with all default values.
