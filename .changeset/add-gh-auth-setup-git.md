---
'gh-setup-git-identity': minor
---

Add support for `gh auth setup-git` command

- Added new `runGhAuthSetupGit()` function to configure git to use GitHub CLI as credential helper
- CLI now automatically runs `gh auth setup-git -h <hostname>` after successful `gh auth login`
- CLI also runs `gh auth setup-git` when already authenticated to ensure proper configuration
- Updated documentation with `gh auth setup-git` information and API reference

This fixes the "could not read Username for 'https://github.com': No such device or address" error that occurs when git operations are attempted without the credential helper being configured.

Fixes #24
