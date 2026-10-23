#!/usr/bin/env bun
// Shows whether `await $\`cmd\`` from the pinned command-stream rejects when
// the command exits non-zero, with and without shell.errexit(true).
// Usage: bun experiments/issue-32-command-stream-exit-codes.mjs
import { USE_M_URL, COMMAND_STREAM } from '../scripts/release-deps.mjs';

const { use } = eval(await (await fetch(USE_M_URL)).text());
const commandStream = await use(COMMAND_STREAM);
const { $, shell } = commandStream;

async function probe(label) {
  try {
    const result = await $`sh -c "exit 3"`;
    console.log(`${label}: resolved, code=${result.code}`);
  } catch (error) {
    console.log(`${label}: rejected, code=${error.code}, ${error.message}`);
  }
}

console.log('shell.errexit available:', typeof shell?.errexit);
await probe('default');
shell.errexit(true);
await probe('errexit(true)');
const captured = await $`sh -c "exit 4"`
  .run({ capture: true })
  .then((r) => `resolved code=${r.code}`, (e) => `rejected code=${e.code}`);
console.log('errexit(true) + .run({ capture: true }):', captured);
