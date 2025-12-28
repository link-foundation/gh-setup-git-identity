# Solutions for GitHub OAuth Token Accumulation

## Overview

This document provides a comprehensive analysis of potential solutions to prevent GitHub OAuth token invalidation when using `gh-setup-git-identity` across multiple environments.

## Solution Comparison Matrix

| Solution | Implementation Effort | User Effort | Effectiveness | Breaking Change |
|----------|----------------------|-------------|---------------|-----------------|
| Use PATs | None (existing feature) | Medium | High | No |
| Manual token revocation | None | High | Medium | No |
| GH_TOKEN env variable | None (existing feature) | Low | High | No |
| Add documentation | Low | Low | Medium | No |
| Add CLI warning | Low | None | Medium | No |
| Token reuse check | Medium | None | Medium | No |

## Detailed Solutions

### Solution 1: Personal Access Tokens (PATs)

**Priority: Recommended for multi-environment users**

Personal Access Tokens don't count toward the 10-token OAuth limit and provide consistent authentication across all environments.

#### Implementation

No code changes required. Users should:

1. Create a PAT at https://github.com/settings/tokens
2. Select appropriate scopes: `repo`, `workflow`, `user`, `read:org`, `gist`
3. Use the token with `gh-setup-git-identity`:

```bash
# Option 1: Via stdin
echo "ghp_your_token_here" | gh-setup-git-identity --with-token

# Option 2: Via environment variable
export GH_TOKEN="ghp_your_token_here"
gh-setup-git-identity
```

#### Pros
- Complete solution to the problem
- Same token works everywhere
- No code changes needed
- User controls token lifecycle

#### Cons
- Requires manual token creation
- Users must securely store the token
- Token rotation is manual

---

### Solution 2: Manual Token Revocation

**Priority: Maintenance task for existing users**

Users can manually clean up accumulated OAuth tokens.

#### Steps

1. Go to **GitHub Settings** > **Applications** > **Authorized OAuth Apps**
2. Find "GitHub CLI" in the list
3. Click to view details
4. Click **Revoke** to remove the authorization
5. Re-authenticate with `gh-setup-git-identity`

#### Pros
- Clears all existing OAuth tokens at once
- Fresh start for token management

#### Cons
- Requires re-authentication on all machines
- Manual process
- Doesn't prevent future accumulation

---

### Solution 3: GH_TOKEN Environment Variable

**Priority: Recommended for CI/CD and automated environments**

Setting a consistent token via environment variable ensures the same credentials are used everywhere.

#### Implementation

```bash
# Add to ~/.bashrc, ~/.zshrc, or CI secrets
export GH_TOKEN="ghp_your_personal_access_token"

# Or
export GITHUB_TOKEN="ghp_your_personal_access_token"
```

The GitHub CLI automatically uses these environment variables for authentication.

#### Pros
- Works with existing `gh-setup-git-identity`
- No code changes needed
- Ideal for automation

#### Cons
- Requires secure secret management
- Must be set on each machine/environment

---

### Solution 4: Add Documentation Warning

**Priority: Should implement**

Add clear documentation about the 10-token limit in the README.

#### Proposed README Addition

```markdown
## Multi-Environment Usage Warning

GitHub limits OAuth tokens to **10 per user/application/scope combination**.
If you use `gh-setup-git-identity` on more than 10 machines/environments,
the oldest tokens will be automatically revoked by GitHub.

**For multi-environment setups**, we recommend using Personal Access Tokens (PATs):

1. Create a PAT at https://github.com/settings/tokens with these scopes:
   - `repo`, `workflow`, `user`, `read:org`, `gist`
2. Authenticate using the token:
   ```bash
   echo "ghp_your_token" | gh-setup-git-identity --with-token
   ```

Or set it via environment variable:
```bash
export GH_TOKEN="ghp_your_token"
gh-setup-git-identity
```

See the [GitHub documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation) for more details.
```

---

### Solution 5: Add CLI Warning

**Priority: Should implement**

Display a warning when OAuth device flow authentication is triggered.

#### Proposed Implementation

In `src/cli.js`, after triggering `runGhAuthLogin()`:

```javascript
// After successful login
console.log('');
console.log('Note: GitHub limits OAuth tokens to 10 per user/application.');
console.log('For multi-environment setups, consider using Personal Access Tokens.');
console.log('Learn more: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation');
```

#### Pros
- Low implementation effort
- Immediate user awareness
- Non-breaking change

#### Cons
- Users might ignore the warning
- Adds verbosity to output

---

### Solution 6: Enhanced Token Reuse Check

**Priority: Optional enhancement**

Add more robust checking before triggering new authentication.

#### Current Behavior

`gh-setup-git-identity` already checks if authenticated via `isGhAuthenticated()`:

```javascript
// src/cli.js
const authenticated = await isGhAuthenticated({ verbose: config.verbose });

if (!authenticated) {
  // ... triggers gh auth login
}
```

#### Proposed Enhancement

Add additional check for token validity:

```javascript
const authenticated = await isGhAuthenticated({ verbose: config.verbose });

if (authenticated) {
  // Verify token is actually valid by making a simple API call
  const tokenValid = await verifyTokenValidity();
  if (!tokenValid) {
    console.log('Warning: Your token appears to be invalid or revoked.');
    console.log('This may happen if you have authenticated on multiple machines.');
    console.log('');
    console.log('Options:');
    console.log('1. Continue to re-authenticate (may revoke tokens on other machines)');
    console.log('2. Use a Personal Access Token instead (recommended for multi-environment)');
    // Prompt user for choice or proceed with re-auth
  }
}
```

---

## Question: Can gh-setup-git-identity Revoke All 10 Tokens?

From Issue #26:
> Can we may be use our `gh-setup-git-identity` tool to actually revoke all 10 tokens?

### Answer: No, not programmatically

**Technical Reason**: GitHub's OAuth platform doesn't provide an API endpoint for OAuth applications to revoke their own tokens. This is documented in [GitHub CLI Issue #9233](https://github.com/cli/cli/issues/9233).

The only ways to revoke tokens are:
1. **User action**: Through GitHub Settings > Applications > Authorized OAuth Apps
2. **Organization admin action**: Through organization settings
3. **Token exposure**: GitHub automatically revokes tokens detected in public repositories

### Alternative: Guidance for Manual Revocation

We can add a command or output that guides users to revoke tokens:

```javascript
// Proposed addition to CLI
if (config.revokeTokens) {
  console.log('');
  console.log('To revoke existing GitHub CLI tokens:');
  console.log('');
  console.log('1. Open: https://github.com/settings/applications');
  console.log('2. Find "GitHub CLI" in the list');
  console.log('3. Click "Revoke" to remove all OAuth tokens');
  console.log('4. Run gh-setup-git-identity again to create a fresh token');
  console.log('');
  process.exit(0);
}
```

This could be triggered with a `--revoke-help` flag.

---

## Implementation Priority

1. **Immediate**: Add documentation warning in README.md
2. **Short-term**: Add CLI warning when OAuth flow is triggered
3. **Medium-term**: Add `--revoke-help` command to guide users
4. **Optional**: Implement enhanced token validity checking

## Conclusion

The most effective solution for users is to switch to Personal Access Tokens for multi-environment usage. This completely avoids the OAuth token limit issue and provides better control over authentication.

For the `gh-setup-git-identity` tool itself, adding documentation and CLI warnings will help users understand and avoid the issue proactively.
