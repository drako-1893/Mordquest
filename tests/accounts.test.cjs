const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, readdir, unlink, rmdir } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { promisify } = require('node:util');
const { startApp } = require('./browser-support.cjs');

const execute = promisify(execFile);
const python = process.env.ASSOKU_PYTHON ?? 'python';
const publicMode = { GAME_PUBLIC_ACCOUNTS: 'true', GAME_GUEST_ONLY: 'false' };

function pythonTask(args, env) {
  return execute(python, args, { env: { ...process.env, ...env } });
}

function request(app, path, method = 'GET', data, cookie) {
  return fetch(app.origin + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Game-Request': '1', ...(cookie ? { Cookie: cookie } : {}) },
    body: data && JSON.stringify(data),
  });
}

test('El modo público con cuentas exige configurar la contraseña administrativa', async () => {
  const command = ['-c', 'from app.accounts.store import initialize_database; initialize_database()'];
  for (const password of ['', 'admin']) {
    await assert.rejects(
      pythonTask(command, { ...publicMode, GAME_ADMIN_PASSWORD: password }),
      error => error.code === 1 && error.stderr.includes('GAME_ADMIN_PASSWORD'),
    );
  }
  const guest = await startApp({ env: { ...publicMode, GAME_GUEST_ONLY: 'true', GAME_ADMIN_PASSWORD: '' } });
  try {
    assert.equal((await fetch(`${guest.origin}/api/levels`)).status, 200);
    assert.equal((await fetch(`${guest.origin}/api/session`)).status, 404);
  } finally {
    await guest.close();
  }
});

test('La restauración conserva cuentas y progreso, y el inicio público limita intentos', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'assoku-recovery-test-'));
  const original = join(temp, 'original.sqlite3');
  const backup = join(temp, 'backup.sqlite3');
  const restored = join(temp, 'restored.sqlite3');
  const credentials = { username: 'detective_qa', password: 'temporary-player-passphrase' };
  let first;
  let second;
  try {
    first = await startApp({ guestOnly: false, env: { ...publicMode, GAME_DATABASE: original } });
    const registration = await request(first, '/api/auth/register', 'POST', credentials);
    assert.equal(registration.status, 200);
    const sessionCookie = registration.headers.get('set-cookie');
    assert.match(sessionCookie, /; HttpOnly/i);
    assert.match(sessionCookie, /; Secure/i);
    const cookie = sessionCookie.split(';')[0];
    const [level] = await (await request(first, '/api/levels')).json();
    const { solution } = require(`../levels/clasico/${level.id}.json`);
    const checked = await request(first, `/api/levels/${level.id}/check`, 'POST', { positions: solution }, cookie);
    assert.deepEqual((await checked.json()).progress.completed, [level.id]);

    await pythonTask(['-m', 'app.accounts.backup', 'backup', backup], { GAME_DATABASE: original });
    await first.close();
    first = undefined;
    await pythonTask(['-m', 'app.accounts.backup', 'restore', backup], { GAME_DATABASE: restored });
    await assert.rejects(pythonTask(['-m', 'app.accounts.backup', 'restore', backup], { GAME_DATABASE: restored }));

    second = await startApp({ guestOnly: false, env: {
      ...publicMode, GAME_DATABASE: restored, GAME_LOGIN_LIMIT: '2', GAME_LOGIN_WINDOW: '180',
    } });
    const login = await request(second, '/api/auth/login', 'POST', credentials);
    assert.equal(login.status, 200);
    assert.deepEqual((await login.json()).completed, [level.id]);
    assert.equal((await request(second, '/api/auth/login', 'POST', { ...credentials, password: 'invalid-test-password' })).status, 401);
    const limited = await request(second, '/api/auth/login', 'POST', credentials);
    assert.equal(limited.status, 429);
    assert(Number(limited.headers.get('retry-after')) > 0);
  } finally {
    await first?.close();
    await second?.close();
    for (const name of await readdir(temp)) await unlink(join(temp, name));
    await rmdir(temp);
  }
});
