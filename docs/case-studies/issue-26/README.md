# Case Study: GitHub OAuth Token Invalidation and Prevention Strategies (Issue #26)

## Executive Summary

This case study investigates the GitHub OAuth token invalidation issue experienced when using `gh-setup-git-identity` across multiple environments. The investigation reveals that this behavior is a documented GitHub security feature, not a bug. When more than 10 OAuth tokens exist for the same user/application/scope combination, GitHub automatically revokes the oldest tokens.

This document explores the root causes, reconstructs the timeline of events, and proposes solutions including potential modifications to `gh-setup-git-identity` to mitigate token accumulation.

## Issue Description

**Issue URL:** https://github.com/link-foundation/gh-setup-git-identity/issues/26

**Related Analysis:** https://github.com/link-assistant/hive-mind/pull/1022 (Issue #1021)

**Reported Behavior:**
> At the same time I was executing `gh-setup-git-identity` command on the remote server. And for some reason executing `gh-setup-git-identity` remotely did destroy GitHub Auth session locally in docker. That is strange.

When running `gh-setup-git-identity` on multiple machines, authentication sessions on other machines become invalid. This creates a "musical chairs" effect where the most recent authentication causes the oldest one to fail.

## Root Cause Analysis

### Primary Root Cause: GitHub's OAuth Token Limits

From the [official GitHub documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation):

> "There is a limit of ten tokens that are issued per user/application/scope combination, and a rate limit of ten tokens created per hour. If an application creates more than ten tokens for the same user and the same scopes, the oldest tokens with the same user/application/scope combination are revoked."

### Secondary Cause: gh auth login Token Accumulation

When `gh auth login` is executed (which `gh-setup-git-identity` uses internally), it:

1. Creates a new OAuth token through GitHub's device code flow
2. Stores the new token in the local credentials store
3. **Does NOT revoke the previous token** on GitHub's side

From [GitHub CLI Issue #9233](https://github.com/cli/cli/issues/9233):
> "Whenever an already logged-in user runs a gh auth login or gh auth refresh, a new OAuth app token is generated and replaces the previous token in the credentials store. The problem is that the old token is not revoked during this process."

This is currently a known limitation and marked as "blocked" because the GitHub platform doesn't provide an API for the CLI to revoke its own tokens.

### How These Combine to Cause the Issue

```
Timeline of Token Accumulation:

Machine A (Docker)     Machine B (Server)      Machine C (Local)
       |                      |                       |
       v                      v                       v
   Token #1              Token #2                Token #3
       |                      |                       |
       v                      v                       v
   Token #4              Token #5                Token #6
       |                      |                       |
       v                      v                       v
   Token #7              Token #8                Token #9
       |                      |                       |
       |                      v                       |
       |                 Token #10                    |
       |                      |                       |
       |                      v                       |
       |            gh-setup-git-identity             |
       |                 (creates Token #11)          |
       |                      |                       |
       v                      v                       v
   Token #1              Token #11               Token #3
   REVOKED!           (newest - valid)           (still valid)
       |                      |                       |
       X                      |                       |
  Machine A                   |                       |
  auth FAILS!                 |                       |
```

## Timeline of Events

Based on the log file from https://gist.github.com/konard/a430347f7f9aff41b7e0c64a7289712a:

| Timestamp (UTC) | Event | Token State |
|-----------------|-------|-------------|
| 09:05:36 | `solve` command started in Docker | Token valid |
| 09:05:42 | GitHub auth check skipped (`--no-tool-check`) | Token valid |
| 09:05:55 | Git push successful to fork | Token valid |
| 09:06:02 | PR created successfully | Token valid |
| ~09:06-09:12 | (Unknown) Remote server runs `gh-setup-git-identity` | **New token created** |
| 09:12:59 | Git push fails: "Invalid username or token" | **Token revoked** |
| 09:13:06 | `gh auth status` confirms token invalid | Token invalid |

The token was valid at 09:05:55 (successful push) but became invalid by 09:12:59 (approximately 7 minutes later), indicating an external event caused the revocation.

## Evidence from Logs

### Successful Authentication (09:05:55)
```
[2025-12-28T09:05:55.246Z] [INFO]    Push exit code: 0
[2025-12-28T09:05:55.246Z] [INFO]    Push output: remote:
remote: Create a pull request for 'issue-133-434c3df37b90' on GitHub by visiting:
```

### Authentication Failure (09:12:59)
```
Exit code 128
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/konard/andchir-install_scripts.git/'
```

### gh auth status Confirmation (09:13:06)
```
github.com
  X Failed to log in to github.com account konard (/home/hive/.config/gh/hosts.yml)
  - Active account: true
  - The token in /home/hive/.config/gh/hosts.yml is invalid.
  - To re-authenticate, run: gh auth login -h github.com
```

## Proposed Solutions

### Question from Issue #26

> Can we maybe use our `gh-setup-git-identity` tool to actually revoke all 10 tokens?

**Answer: Not directly through code modification.**

The GitHub CLI itself cannot revoke OAuth tokens programmatically because GitHub's platform doesn't expose an API endpoint for OAuth apps to revoke their own tokens. This is documented in [GitHub CLI Issue #9233](https://github.com/cli/cli/issues/9233).

However, there are several alternative approaches:

### Solution 1: Use Personal Access Tokens (PATs) Instead of OAuth Flow

**Recommended for multi-environment setups**

PATs don't count toward the 10-token OAuth limit and can be shared across environments.

```bash
# Create a PAT at GitHub Settings > Developer settings > Personal access tokens
# Then authenticate:
echo "ghp_your_token_here" | gh-setup-git-identity --with-token
```

**Pros:**
- No token accumulation
- Same token works across all environments
- Explicit control over token lifecycle

**Cons:**
- Requires manual token creation
- Token management responsibility shifts to user

### Solution 2: Revoke Tokens Manually via GitHub Settings

Users can manually clean up old tokens:

1. Go to **GitHub Settings** > **Applications** > **Authorized OAuth Apps**
2. Find "GitHub CLI" entry
3. Click "Revoke" to remove old authorizations
4. Re-authenticate with `gh-setup-git-identity`

### Solution 3: Use GH_TOKEN/GITHUB_TOKEN Environment Variable

For automated/CI environments:

```bash
export GH_TOKEN="ghp_your_personal_access_token"
# or
export GITHUB_TOKEN="ghp_your_personal_access_token"

# gh-setup-git-identity will use this token
gh-setup-git-identity
```

### Solution 4: Add Warning Documentation to gh-setup-git-identity

Add documentation warning users about the 10-token limit when using multiple environments.

### Solution 5: Implement Token Reuse Check (Code Change)

Modify `gh-setup-git-identity` to:
1. Check if current token is valid before triggering new authentication
2. Skip `gh auth login` if already authenticated (currently implemented but can be enhanced)
3. Warn users when they attempt to re-authenticate unnecessarily

### Solution 6: Add Token Revocation Guidance in CLI Output

When authentication is triggered, output a message like:

```
Note: GitHub limits OAuth tokens to 10 per user/application/scope.
If you use multiple environments, consider using Personal Access Tokens instead.
To revoke old tokens: https://github.com/settings/applications
```

## Recommendations

### For Individual Users

1. **For multi-environment setups**: Use Personal Access Tokens (PATs) instead of OAuth device flow
2. **Regularly audit tokens**: Visit GitHub Settings > Applications > Authorized OAuth Apps
3. **Share tokens across environments**: Use `GH_TOKEN` environment variable with a single PAT

### For gh-setup-git-identity Development

1. **Add documentation** about GitHub's 10-token limit in README.md
2. **Add CLI warning** when triggering authentication about token limits
3. **Enhance `--with-token` mode** documentation for multi-environment usage
4. **Consider adding `--revoke-first` flag** that prompts users to revoke via GitHub settings before re-authenticating

## Conclusion

The token invalidation issue is expected behavior due to GitHub's OAuth token management:

1. **GitHub limits OAuth tokens to 10 per user/application/scope combination**
2. **When the limit is exceeded, the oldest tokens are automatically revoked**
3. **`gh auth login` creates new tokens without revoking old ones**
4. **This is a platform limitation, not a bug in `gh-setup-git-identity`**

The recommended mitigation is to use Personal Access Tokens (PATs) for multi-environment setups, which provides better control over token lifecycle and avoids the 10-token OAuth limit.

## References

- [GitHub Token Expiration and Revocation Documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation)
- [GitHub CLI gh auth login Manual](https://cli.github.com/manual/gh_auth_login)
- [GitHub CLI Issue #9233: Invalidate previous OAuth token](https://github.com/cli/cli/issues/9233)
- [GitHub CLI Issue #5924: Support for short-lived OAuth tokens](https://github.com/cli/cli/issues/5924)
- [Original Issue Analysis (hive-mind #1021)](https://github.com/link-assistant/hive-mind/pull/1022)
- [Original Issue Gist Log](https://gist.github.com/konard/a430347f7f9aff41b7e0c64a7289712a)

## Appendix: Related Files

- `timeline.md` - Detailed event timeline reconstruction
- `solutions.md` - Comprehensive solution comparison matrix
- `raw-logs/` - Redacted log excerpts for reference
