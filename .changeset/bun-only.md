---
"gh-setup-git-identity": minor
---

Make project bun-first and bun-only

- Updated all shebangs from `#!/usr/bin/env node` to `#!/usr/bin/env bun`
- Replaced npm commands with bun in package.json scripts
- Updated README.md to recommend bun installation and usage
- Modified GitHub Actions workflows to use bun instead of node
- Changed package.json engines from node to bun
- Simplified test matrix to only use bun (removed node and deno)
