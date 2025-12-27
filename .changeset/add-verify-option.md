---
"gh-setup-git-identity": minor
---

feat: add --verify option to verify git identity configuration

- Added `--verify` CLI option to run all 3 verification commands at once
- Users can now use `gh-setup-git-identity --verify` instead of running individual commands
- Works with `--local` flag for local repository configuration
- Updated README with verification documentation and code blocks
