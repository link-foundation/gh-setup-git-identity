/**
 * Pinned versions of the helpers that the release scripts load through use-m.
 *
 * The release scripts used to load `use-m`, `command-stream` and
 * `lino-arguments` at `latest`. On 2026-10-08, command-stream 2.0.0 made
 * `node-pty` a hard dependency. Its native build failed on the runner, so the
 * release on main stopped before it published anything (issue #32). Pinning
 * the versions here means that a new upstream release cannot break publishing.
 * A version bump becomes a reviewed change that goes through PR CI.
 *
 * Bump these versions deliberately, in a pull request.
 */

/** use-m loader, fetched from the CDN by every release script. */
export const USE_M_URL = 'https://unpkg.com/use-m@8.16.4/use.js';

/** command-stream 2.0.1+ declares node-pty as optional (command-stream#218). */
export const COMMAND_STREAM = 'command-stream@2.4.0';

/** The lino-arguments line used by the last successful release (0.8.0). */
export const LINO_ARGUMENTS = 'lino-arguments@0.2.5';
