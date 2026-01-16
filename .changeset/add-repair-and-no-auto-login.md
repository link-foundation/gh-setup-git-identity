---
"gh-setup-git-identity": minor
---

Add `--repair` and `--no-auto-login` CLI options

## New Features

### `--repair` option
Repair git identity configuration without triggering the login flow. This is useful when:
- Git operations fail with "empty ident name not allowed" error
- The `user.name` or `user.email` was accidentally cleared or corrupted
- You want to reconfigure git identity without going through login again

The `--repair` option requires existing GitHub CLI authentication.

### `--no-auto-login` option
Disable automatic login if not authenticated. Instead of starting the interactive login process, the tool will exit with an error and show manual authentication instructions.

This is useful in scripts or automated environments where you want to fail fast rather than wait for an interactive login prompt.
