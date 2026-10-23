#!/usr/bin/env bun
// Loads the release-script helpers at the versions pinned in
// scripts/release-deps.mjs and exercises the APIs the release scripts use.
// Usage: bun experiments/issue-32-pinned-helpers.mjs
import {
  USE_M_URL,
  COMMAND_STREAM,
  LINO_ARGUMENTS,
} from '../scripts/release-deps.mjs';

console.log({ USE_M_URL, COMMAND_STREAM, LINO_ARGUMENTS });
const { use } = eval(await (await fetch(USE_M_URL)).text());

const { $ } = await use(COMMAND_STREAM);
const echo = await $`echo hello`.run({ capture: true });
console.log('command-stream $ ->', JSON.stringify(echo.stdout.trim()));

const { makeConfig } = await use(LINO_ARGUMENTS);
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('release-version', {
      type: 'string',
      default: getenv('VERSION', ''),
    }),
  argv: ['node', 'x', '--release-version', '1.2.3'],
});
console.log('lino-arguments makeConfig ->', config.releaseVersion);
