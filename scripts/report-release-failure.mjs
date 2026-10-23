#!/usr/bin/env bun

/**
 * Report a failed release on main by opening a GitHub issue, or by commenting
 * on the open one, so that a merged fix does not sit unpublished unnoticed.
 *
 * In issue #32 the release for a merged fix failed on 2026-10-08. Nobody
 * noticed, and npm `latest` stayed on the broken version for two weeks.
 *
 * This script deliberately loads no helpers (no use-m, no command-stream):
 * it must keep working when loading those helpers is what broke the release.
 *
 * Environment:
 *   GH_TOKEN          token with `issues: write`
 *   GITHUB_REPOSITORY owner/repo
 *   GITHUB_SERVER_URL, GITHUB_RUN_ID, GITHUB_SHA, GITHUB_EVENT_NAME
 *   JOB_RESULTS       JSON object of job name -> result, e.g. {"release":"failure"}
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ISSUE_TITLE = 'Release on main failed';

export function failedJobs(jobResults) {
  return Object.entries(jobResults)
    .filter(([, result]) => result === 'failure' || result === 'cancelled')
    .map(([job]) => job);
}

export function buildReport({
  repository,
  serverUrl = 'https://github.com',
  runId,
  sha,
  eventName,
  jobResults,
}) {
  const runUrl = `${serverUrl}/${repository}/actions/runs/${runId}`;
  const failed = failedJobs(jobResults);
  const rows = Object.entries(jobResults)
    .map(([job, result]) => `| \`${job}\` | ${result} |`)
    .join('\n');

  return [
    `The release workflow on \`main\` did not finish: ${runUrl}`,
    '',
    `- Commit: ${sha}`,
    `- Event: \`${eventName}\``,
    `- Failed jobs: ${failed.map((job) => `\`${job}\``).join(', ') || 'none'}`,
    '',
    '| Job | Result |',
    '| --- | --- |',
    rows,
    '',
    'Changes merged since the last release may not be published to npm.',
    'Fix the cause, then re-run the failed jobs:',
    '',
    '```sh',
    `gh run rerun ${runId} --failed --repo ${repository}`,
    '```',
    '',
    'Close this issue once the release is published.',
  ].join('\n');
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

export function reportReleaseFailure({ env = process.env, run = gh } = {}) {
  const repository = env.GITHUB_REPOSITORY;
  const body = buildReport({
    repository,
    serverUrl: env.GITHUB_SERVER_URL,
    runId: env.GITHUB_RUN_ID,
    sha: env.GITHUB_SHA,
    eventName: env.GITHUB_EVENT_NAME,
    jobResults: JSON.parse(env.JOB_RESULTS || '{}'),
  });

  const existing = run([
    'issue',
    'list',
    '--repo',
    repository,
    '--state',
    'open',
    '--search',
    `"${ISSUE_TITLE}" in:title`,
    '--json',
    'number,title',
    '--jq',
    `map(select(.title == "${ISSUE_TITLE}")) | .[0].number // empty`,
  ]);

  const url = existing
    ? run([
        'issue',
        'comment',
        existing,
        '--repo',
        repository,
        '--body',
        body,
      ])
    : run([
        'issue',
        'create',
        '--repo',
        repository,
        '--title',
        ISSUE_TITLE,
        '--body',
        body,
      ]);

  return { url, body, existing: Boolean(existing) };
}

function isMainModule() {
  return process.argv[1]
    ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;
}

if (isMainModule()) {
  try {
    const { url, body } = reportReleaseFailure();
    console.log(`::error::Release on main failed, reported at ${url}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Release failed\n\n${body}\n\nReported at ${url}\n`
      );
    }
  } catch (error) {
    console.error('Error reporting release failure:', error.message);
    process.exit(1);
  }
}
