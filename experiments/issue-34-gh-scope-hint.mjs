// Replays the upstream scope hint with a real gh binary, an isolated config, and a loopback API.
// Run with Node.js and OpenSSL. The unprivileged process must be able to bind 127.0.0.1:443.
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const gh = process.argv[2] || 'gh';
const host = '127.0.0.1';
const token = 'fixture-token';
const configDir = mkdtempSync(join(tmpdir(), 'gh-scope-hint-'));
const key = join(configDir, 'key.pem');
const cert = join(configDir, 'cert.pem');
let server;

try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', `/CN=${host}`, '-addext', `subjectAltName=IP:${host}`, '-keyout', key, '-out', cert], { stdio: 'pipe' });

  server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    if (request.url !== '/api/v3/user/emails' || request.headers.authorization !== `token ${token}`) {
      response.writeHead(500).end();
      return;
    }
    response.writeHead(404, {
      'Content-Type': 'application/json',
      'X-Accepted-OAuth-Scopes': 'user, user:email',
      'X-OAuth-Scopes': 'repo',
    }).end(JSON.stringify({ message: 'Not Found' }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(443, host, resolve);
  });

  const env = {
    PATH: process.env.PATH,
    GH_CONFIG_DIR: configDir,
    GH_ENTERPRISE_TOKEN: token,
    GH_HOST: host,
    NO_PROXY: host,
    SSL_CERT_FILE: cert,
  };
  const run = (args) => new Promise((resolve, reject) => {
    execFile(gh, args, { env, timeout: 10000 }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') {
        reject(error);
        return;
      }
      const status = error?.code ?? 0;
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
      console.log(`$ gh ${args.join(' ')}\n${output}\nExit status ${status}`);
      resolve({ status, stderr });
    });
  });

  await run(['--version']);
  const api = await run(['api', '--hostname', host, 'user/emails']);
  const refresh = await run(['auth', 'refresh', '-h', host, '-s', 'user']);
  if (api.status !== 1 || !api.stderr.includes(`gh auth refresh -h ${host} -s user`) ||
      refresh.status !== 1 || !refresh.stderr.includes('GH_ENTERPRISE_TOKEN environment variable')) {
    throw new Error('The scope hint or refresh result differed from the reported behavior.');
  }
} finally {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  rmSync(configDir, { recursive: true, force: true });
}
