#!/usr/bin/env node
// scripts/dev-start.mjs — Kill stale dev servers, start fresh, health-check.
// Pure Node.js — no bash/PowerShell dependency. Works in any shell & sandbox.

import { execSync, spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.join(__dirname, '..'));

// --- Windows 콘솔 UTF-8 강제 (cp949 mojibake 차단) ---
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {}
  process.env.PYTHONIOENCODING = 'utf-8';
  // child process가 상속받도록
  if (!process.env.LANG) process.env.LANG = 'ko_KR.UTF-8';
}

const VITE_PORT = 5173;
const API_PORT = 3001;

// --- Get PIDs listening on a port (Windows netstat) ---
function getListeningPids(port) {
  try {
    const out = execSync(`netstat -ano`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (line.includes(`:${port} `) && /LISTENING/i.test(line)) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
    }
    return [...pids];
  } catch { return []; }
}

// --- Check if PID is a node/tsx process ---
function isNodeProcess(pid) {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return /node|tsx/i.test(out);
  } catch { return false; }
}

// --- Kill only our own node processes on a port ---
function safeKillPort(port) {
  const pids = getListeningPids(port);
  for (const pid of pids) {
    if (isNodeProcess(pid)) {
      console.log(`[dev-start] Killing old node process (PID ${pid}) on port ${port}...`);
      try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch {}
    } else {
      console.log(`[dev-start] Port ${port} occupied by non-node process (PID ${pid}) — skipping`);
    }
  }
}

function isPortFree(port) {
  return getListeningPids(port).length === 0;
}

function findFreePort(base) {
  for (let p = base; p <= base + 10; p++) {
    if (isPortFree(p)) return p;
  }
  throw new Error(`No free port in range ${base}-${base + 10}`);
}

// --- Wait for HTTP server on port ---
function waitForPort(port, name, maxSeconds = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://localhost:${port}`, () => {
        console.log(`[dev-start] ${name} is ready on port ${port}.`);
        resolve();
      });
      req.on('error', () => {
        attempts++;
        if (attempts >= maxSeconds) {
          reject(new Error(`${name} on port ${port} did not start within ${maxSeconds}s`));
        } else {
          setTimeout(check, 1000);
        }
      });
      req.setTimeout(1000, () => { req.destroy(); });
    };
    check();
  });
}

// --- Main ---
console.log(`[dev-start] Checking ports ${VITE_PORT} and ${API_PORT}...`);
safeKillPort(VITE_PORT);
safeKillPort(API_PORT);

await new Promise(r => setTimeout(r, 1000));

const actualVitePort = isPortFree(VITE_PORT) ? VITE_PORT : findFreePort(VITE_PORT + 1);
const actualApiPort = isPortFree(API_PORT) ? API_PORT : findFreePort(API_PORT + 1);

if (actualVitePort !== VITE_PORT) console.log(`[dev-start] Vite port ${VITE_PORT} still occupied, using ${actualVitePort}`);
if (actualApiPort !== API_PORT) console.log(`[dev-start] API port ${API_PORT} still occupied, using ${actualApiPort}`);

// Determine npm command (npm.cmd on Windows)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function spawnNpmScript(scriptName) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `${npmCmd} run ${scriptName}`], {
      env: { ...process.env, VITE_PORT_OVERRIDE: String(actualVitePort), PORT: String(actualApiPort) },
      stdio: 'inherit',
      detached: false,
      shell: false,
    });
  }

  return spawn(npmCmd, ['run', scriptName], {
    env: { ...process.env, VITE_PORT_OVERRIDE: String(actualVitePort), PORT: String(actualApiPort) },
    stdio: 'inherit',
    detached: false,
    shell: false,
  });
}

console.log('[dev-start] Starting npm run dev:server...');
const serverChild = spawnNpmScript('dev:server');

serverChild.on('error', (err) => {
  console.error(`[dev-start] Failed to start API server: ${err.message}`);
  process.exit(1);
});

console.log('[dev-start] Starting npm run dev:client...');
const clientChild = spawnNpmScript('dev:client');

clientChild.on('error', (err) => {
  console.error(`[dev-start] Failed to start client server: ${err.message}`);
  process.exit(1);
});

try {
  await Promise.all([
    waitForPort(actualApiPort, 'Hono API server'),
    waitForPort(actualVitePort, 'Vite dev server'),
  ]);
} catch (err) {
  console.error(`[dev-start] ERROR: ${err.message}`);
  process.exit(1);
}

console.log('');
console.log('=== Dev servers running ===');
console.log(`Frontend: http://localhost:${actualVitePort}`);
console.log(`API:      http://localhost:${actualApiPort}`);
console.log(`Open http://localhost:${actualVitePort} in your browser (Ctrl+Shift+R to hard refresh).`);
console.log(`Server PID: ${serverChild.pid}`);
console.log(`Client PID: ${clientChild.pid}`);
