---
'gh-setup-git-identity': patch
---

Fix release notes formatting to support Major and Minor changes

Previously, the format-release-notes.mjs script only looked for "### Patch Changes" sections in release notes. This caused releases with Minor or Major changes (like v0.3.0) to not be properly formatted with PR links and npm badges.

Updated the regex pattern to handle all three change types (Major, Minor, and Patch), matching the release template from test-anywhere repository.
