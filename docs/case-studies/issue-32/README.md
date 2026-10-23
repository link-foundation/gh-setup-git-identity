# Case Study: The `--version` fix was never published (Issue #32)

## Summary

PR #31 fixed `gh-setup-git-identity --version` (it printed `0.1.0`) and was
merged on 2026-10-08. The post-merge **Checks and release** run on `main`
failed before it published anything. Nothing ran the release again, so npm
`latest` stayed on 0.8.0, which still prints `0.1.0`.

Investigation found one direct cause and three latent problems. Any of the
latent problems would have blocked or hidden the next release:

| #   | Problem                                                             | Effect                                                                                                                                                                             | Fix in this PR                                                                                                |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Release scripts load `command-stream@latest` through use-m.         | command-stream 2.0.0 made `node-pty` a hard dependency. Its native build failed, so `setup-npm.mjs` crashed.                                                                       | Pin use-m, command-stream and lino-arguments in `scripts/release-deps.mjs`. `setup-npm.mjs` loads no helpers. |
| 2   | `setup-npm.mjs` installs `npm@latest`.                              | npm 12 needs Node.js `^22.22.2 \|\| ^24.15.0 \|\| >=26`, and the job runs Node.js 20.20.2. A plain re-run today gets EBADENGINE.                                                   | Install `npm@11` and fail when npm stays below 11.5.1.                                                        |
| 3   | `await $` from command-stream **resolves** on a non-zero exit code. | The failed npm update exited 0. A failed `changeset publish` printed `Published …` and set `published=true`, which would create a GitHub release for a version that is not on npm. | `shell.errexit(true)` in every release-path script.                                                           |
| 4   | A re-run after a failed publish skipped the publish step.           | The version commit on `main` already consumed the changesets. `version-and-commit.mjs` saw no changes and set neither `version_committed` nor `already_released`.                  | Report `already_released` when the rebase leaves no changesets.                                               |
| 5   | Nothing reported the failed release on `main`.                      | The fix sat unpublished for two weeks, and downstream tools logged update failures ([hive-mind#3469](https://github.com/link-assistant/hive-mind/issues/3469)).                    | New `report-release-failure` job opens or updates a **Release on main failed** issue.                         |

## Timeline

| Time (UTC)          | Event                                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-16 11:31    | gh-setup-git-identity 0.8.0 is published. Its `--version` prints `0.1.0` (issue #30).                                                                                                  |
| 2026-10-06 14:19    | command-stream 1.6.2 is published.                                                                                                                                                     |
| 2026-10-07 08:06    | command-stream 2.0.0 is published with `node-pty@^1.1.0` in `dependencies`.                                                                                                            |
| 2026-10-08 05:43    | PR #31 is merged (3eb61a03). Run [37733836425](https://github.com/link-foundation/gh-setup-git-identity/actions/runs/37733836425) starts.                                              |
| 2026-10-08 05:44:22 | `bun scripts/setup-npm.mjs` fails: `bun add -g command-stream-v-latest@npm:command-stream@latest` → `install script from "node-pty" exited with 1`. Nothing is versioned or published. |
| 2026-10-10 09:40    | [command-stream#218](https://github.com/link-foundation/command-stream/issues/218) is closed.                                                                                          |
| 2026-10-11 00:03    | command-stream 2.0.1 moves `node-pty` to `optionalDependencies`.                                                                                                                       |
| 2026-10-23          | Issue #32 is reported. npm `latest` is still 0.8.0. npm `latest` is now 12.2.1.                                                                                                        |

## Root cause 1: unpinned helpers

Every release script did:

```js
const { use } = eval(
  await (await fetch("https://unpkg.com/use-m/use.js")).text()
);
const { $ } = await use("command-stream");
```

use-m resolves the bare name to `latest` and runs
`bun add -g command-stream-v-latest@npm:command-stream@latest`. On 2026-10-08,
`latest` was 2.0.0, with `node-pty` as a hard dependency. node-pty has no
linux-x64 prebuild, so Bun ran its `node-gyp` install script. That script
failed on the runner
([raw log](raw-logs/ci-run-37733836425-release-failed.txt), lines 195–234).

Local reproduction without a C toolchain (only `bun`, `node`, `sh` on `PATH`):

- `bun add command-stream@2.0.0` exits 1 with
  `error: install script from "node-pty" exited with 1`
  ([log](raw-logs/bun-add-command-stream-2.0.0-no-toolchain.txt)).
- `bun add command-stream@2.4.0` exits 0
  ([log](raw-logs/bun-add-command-stream-2.4.0-no-toolchain.txt)).

`setup-npm.mjs` only needed command-stream to run a single `npm install`
command. So it failed on a dependency it did not need.

## Root cause 2: `npm@latest` moved to a major that needs Node.js 22

The issue suggested re-running the failed workflow as a workaround. That
would not work today. npm 12.2.1 is now `latest`, and it requires Node.js
`^22.22.2 || ^24.15.0 || >=26.0.0`. The release job uses
`actions/setup-node` with `20.x` (v20.20.2, npm 10.8.2 in run 37733836425).
Reproduced locally with the official Node.js v20.20.2 build:

```text
$ npm install -g npm@latest
npm error code EBADENGINE
npm error notsup Not compatible with your version of node/npm: npm@12.2.1
npm error notsup Required: {"node":"^22.22.2 || ^24.15.0 || >=26.0.0"}
npm error notsup Actual:   {"npm":"10.8.2","node":"v20.20.2"}
```

The script from `main` then exited **0** and printed `Updated npm version: 10.8.2`
([log](raw-logs/setup-npm-main-node20.txt)). The job would continue without
OIDC support (npm < 11.5.1) and fail later, at publish time. `npm install -g npm@11`
installs 11.21.1 on the same Node.js ([log](raw-logs/setup-npm-fixed-node20.txt)).

## Root cause 3: command failures were reported as successes

`experiments/issue-32-command-stream-exit-codes.mjs`
([output](raw-logs/command-stream-exit-codes.txt)):

```text
shell.errexit available: function
default: resolved, code=3
errexit(true): rejected, code=3, Command failed with exit code 3
errexit(true) + .run({ capture: true }): rejected code=4
```

The release scripts expect a failed command to throw, as in
`try { await $\`npm run changeset:publish\`; … } catch { retry }`. Without
errexit, the `catch`never runs.`experiments/issue-32-release-dry-run.sh`runs`version-and-commit.mjs`and`publish-to-npm.mjs`against a local bare
remote with`changeset:publish`replaced by`exit 1`:

- On `main` ([log](raw-logs/dry-run-main-publish-fails.txt)):
  `Published gh-setup-git-identity@0.8.1 to npm`, exit 0,
  `published=true`. The workflow would then create a GitHub release for an
  unpublished version.
- With this PR ([log](raw-logs/dry-run-fixed-publish-fails.txt)): three
  attempts, `Failed to publish after 3 attempts`, exit 1, no `published`.

## Root cause 4: a re-run after a failed publish did not publish

The same script, run with `rerun` mode, re-runs the triggering commit after the
failed publish, as `gh run rerun --failed` would. The version commit `0.8.1` is
already on `main`, so `version-and-commit.mjs` rebases onto it, finds no
changesets, prints `No changes to commit`, and sets `version_committed=false`
with no `already_released`. The publish step is skipped
([before](raw-logs/dry-run-rerun-before-fix.txt)). With this PR it prints
`Remote main already consumed the changesets (version 0.8.1).` and sets
`already_released=true`. The publish step runs and publishes
([after](raw-logs/dry-run-rerun-after-fix.txt)).

## Root cause 5: nobody was notified

A failed run on `main` only shows a red check on a merged commit. The new
`report-release-failure` job runs on `main` when `release` or `instant-release`
fails or is cancelled. On `push`, it also runs when `lint` or `test` fails or
is cancelled, because those failures skip the release. It runs
`scripts/report-release-failure.mjs`, which uses only `gh` and Node.js
built-ins. The report must still work when loading helpers is what broke. The
script opens a **Release on main failed** issue, or comments on the open one.
The report lists the run URL, the commit, the job results, and the
`gh run rerun <id> --failed` command.

## Releasing the pending fix (0.8.1)

`.changeset/fix-cli-version.md` (patch) is still pending on `main`. Merging
this PR triggers **Checks and release** on `main` again. With the fixes above,
that run versions the package to 0.8.1, publishes it to npm, and creates the
GitHub release. `--version` then prints `0.8.1`.

This PR adds no second changeset. `scripts/validate-changeset.mjs` requires
exactly one changeset file in `.changeset/`, and the pending one already
produces the 0.8.1 patch release.

## Verification

- `bun test`: `test/release-scripts.test.js` checks the pins, the
  `setup-npm.mjs` logic (with a fake `npm`), errexit, the failure report (with
  a fake `gh`), the workflow job, and the re-run path. All checks work
  offline. Against the scripts on `main`, the pin and errexit checks fail.
- `experiments/issue-32-pinned-helpers.mjs` loads the pinned use-m,
  command-stream and lino-arguments with Bun and exercises `$` and
  `makeConfig`.
- `experiments/issue-32-release-dry-run.sh` gives the before/after dry runs
  above.
- `actionlint` reports no new findings for `.github/workflows/release.yml`.
  Its single finding (`github.head_ref` in an inline script) is already on `main`.

## References

- Failed run: https://github.com/link-foundation/gh-setup-git-identity/actions/runs/37733836425
- command-stream node-pty regression: https://github.com/link-foundation/command-stream/issues/218
- npm trusted publishing (needs npm >= 11.5.1): https://docs.npmjs.com/trusted-publishers
- Downstream impact: https://github.com/link-assistant/hive-mind/issues/3469
