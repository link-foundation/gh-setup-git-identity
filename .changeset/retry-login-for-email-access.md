---
"gh-setup-git-identity": patch
---

Retry GitHub login once when the active account cannot read its primary email, then configure Git from the account selected during login. Honor `--repair`, `--no-auto-login`, and `--dry-run` during authentication recovery.
