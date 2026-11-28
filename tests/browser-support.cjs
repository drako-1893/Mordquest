const { chromium } = require(process.env.ASSOKU_PLAYWRIGHT ?? 'playwright');
const { spawn } = require('node:child_process');
const { mkdtemp, readdir, unlink, rmdir } = require('node:fs/promises');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

async function freePort() {
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const { port } = socket.address();
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return port;
}

async function startApp({ module = 'backend:app', guestOnly = true, env = {} } = {}) {
  const port = await freePort();
  const directory = await mkdtemp(join(tmpdir(), 'assoku-test-'));
  const database = join(directory, 'game.sqlite3');
  const server = spawn(process.env.ASSOKU_PYTHON ?? 'python', [
    '-m', 'uvicorn', module, '--host', '127.0.0.1', '--port', String(port), '--log-level', 'warning',
  ], {
    env: {
      ...process.env, GAME_GUEST_ONLY: String(guestOnly), GAME_DATABASE: database,
      GAME_ADMIN_PASSWORD: 'temporary-test-only-passphrase', ...env,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const exited = new Promise(resolve => server.once('close', resolve));
  let startupError;
  server.once('error', error => { startupError = error; });
  const origin = `http://127.0.0.1:${port}`;
  async function close() {
    server.kill();
    await exited;
    for (const file of await readdir(directory)) await unlink(join(directory, file));
    await rmdir(directory);
  }
  try {
    for (let retry = 0; retry < 80; retry++) {
      if (startupError) throw startupError;
      if (server.exitCode !== null) throw new Error('El servidor de prueba terminó durante el arranque.');
      const response = await fetch(`${origin}/api/heartbeat`).catch(() => null);
      if (response?.ok) return { origin, close };
      await delay(200);
    }
    throw new Error('El servidor de prueba tardó demasiado en arrancar.');
  } catch (error) {
    await close();
    throw error;
  }
}

async function open(page, origin, path) {
  const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  await page.locator('#page-loading').waitFor({ state: 'detached' });
  await page.locator('[data-load-pending]').waitFor({ state: 'detached' });
  return response;
}

async function player(browser, options = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  await context.addInitScript(() => localStorage.setItem('archivo-nocturno:tutorial:guest', '1'));
  return context;
}

module.exports = { chromium, startApp, open, player };
