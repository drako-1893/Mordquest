const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { chromium, startApp, open, player } = require('./browser-support.cjs');

let app;
let browser;
let catalog;

before(async () => {
  app = await startApp();
  browser = await chromium.launch({ executablePath: process.env.ASSOKU_CHROME });
  catalog = await (await fetch(`${app.origin}/api/levels`)).json();
});

after(async () => {
  await browser?.close();
  await app?.close();
});

test('El catálogo conserva los enlaces numerados y acepta los enlaces permanentes', async () => {
  const reordered = await startApp({ module: 'tests.reordered_app:app' });
  const context = await player(browser);
  try {
    const page = await context.newPage();
    const [first, second] = catalog;
    await open(page, app.origin, '/levels');
    const link = await page.locator('.level-play').first().getAttribute('href');
    assert.equal(link, `/level/${first.order}/`);
    await open(page, reordered.origin, first.url);
    assert.equal(await page.locator('.case').getAttribute('data-level-id'), first.id);
    assert.match(await page.locator('#case-number').textContent(), new RegExp(`Nivel ${second.order}$`));
    await open(page, reordered.origin, link);
    assert.equal(await page.locator('.case').getAttribute('data-level-id'), second.id);
    assert.equal(new URL(page.url()).pathname, link);
    const css = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
    assert.match((await fetch(new URL(css, reordered.origin))).headers.get('cache-control'), /immutable/);
  } finally {
    await context.close();
    await reordered.close();
  }
});

test('El tutorial y los gestos originales permiten anotar, colocar y deshacer', async () => {
  const level = catalog[0];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await open(page, app.origin, level.url);
    await page.getByRole('button', { name: 'Cerrar tutorial' }).click();
    assert.deepEqual(await page.locator('.controls .tool:visible .tool-label').allTextContents(), ['Marca X', 'Borrar', 'Solución', 'Tutorial']);
    const cell = page.locator('#cells .cell:not(.is-obstacle)').first();
    await cell.tap();
    assert.match(await cell.getAttribute('aria-label'), /Anotaciones/);
    await page.locator('#undo').tap();
    assert.doesNotMatch(await cell.getAttribute('aria-label'), /Anotaciones/);
    const box = await cell.boundingBox();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await page.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.match(await cell.getAttribute('aria-label'), /en esta casilla/);
    await open(page, app.origin, level.url);
    assert.match(await cell.getAttribute('aria-label'), /en esta casilla/);
  } finally {
    await context.close();
  }
});

test('En el tablero experto, el arrastre marca varias casillas y se deshace de una vez', async () => {
  const level = catalog.find(item => item.size === 16);
  const context = await player(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await open(page, app.origin, level.url);
    assert.deepEqual(await page.locator('.controls .tool:visible .tool-label').allTextContents(), ['Marca X', 'Borrar', 'Solución', 'Tutorial']);
    const cells = page.locator('#cells .cell');
    assert.equal(await cells.count(), 256);
    const start = await cells.evaluateAll(items => items.findIndex((item, index) =>
      index % 16 <= 13 && items.slice(index, index + 3).every(cell => !cell.classList.contains('is-obstacle'))));
    assert(start >= 0);
    const [from, end] = await Promise.all([cells.nth(start).boundingBox(), cells.nth(start + 2).boundingBox()]);
    const y = from.y + from.height / 2;
    const x = from.x + from.width / 2;
    const destination = end.x + end.width / 2;
    await page.locator('#cross').tap();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x + destination) / 2, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: destination, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#cells .has-cross').count(), 3);
    await page.locator('#undo').tap();
    assert.equal(await page.locator('#cells .has-cross').count(), 0);
  } finally {
    await context.close();
  }
});

test('Volver a jugar conserva la confirmación original y reinicia el caso', async () => {
  const level = catalog[0];
  const context = await player(browser);
  try {
    await context.addInitScript(id => {
      if (sessionStorage.getItem('test-replay-seeded')) return;
      sessionStorage.setItem('test-replay-seeded', '1');
      localStorage.setItem('archivo-nocturno:completed:guest', JSON.stringify([id]));
    }, level.id);
    const page = await context.newPage();
    await open(page, app.origin, level.url);
    await page.locator('#replay-dialog').waitFor({ state: 'visible' });
    await page.locator('#replay-no').click();
    assert.equal(await page.locator('#cells .cell:disabled').count(), 36);
    await page.locator('#replay').click();
    await page.locator('#replay-yes').click();
    await page.locator('#replay-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#count').textContent(), '0 / 6');
    await open(page, app.origin, '/levels');
    assert.equal(await page.locator(`[data-level-id="${level.id}"] .level-play`).textContent(), 'Jugar');
  } finally {
    await context.close();
  }
});

test('Solución abre el recorrido y conserva la anotación al cerrarlo', async () => {
  const context = await player(browser);
  try {
    const page = await context.newPage();
    let requestedSolution = false;
    page.on('request', request => { if (request.url().endsWith('/walkthrough')) requestedSolution = true; });
    await open(page, app.origin, catalog[0].url);
    const cell = page.locator('#cells .cell:not(.is-obstacle)').first();
    await cell.press('Enter');
    const saved = await cell.getAttribute('aria-label');
    assert.equal(requestedSolution, false);
    await page.getByRole('button', { name: 'Ver solución paso a paso' }).click();
    await page.locator('.walkthrough-card').waitFor({ state: 'visible' });
    assert.equal(requestedSolution, true);
    await page.locator('#walkthrough-dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    assert.equal(await cell.getAttribute('aria-label'), saved);
  } finally {
    await context.close();
  }
});

test('El catálogo original de Recursos abre para un administrador', async () => {
  const accounts = await startApp({ guestOnly: false });
  const context = await player(browser);
  try {
    const login = await context.request.post(`${accounts.origin}/api/auth/login`, {
      data: { username: 'admin', password: 'temporary-test-only-passphrase' },
      headers: { 'X-Game-Request': '1' },
    });
    assert.equal(login.status(), 200);
    const page = await context.newPage();
    await open(page, accounts.origin, '/resources');
    await page.locator('#character-combinations svg.character-portrait').nth(511).waitFor();
    assert.equal(await page.locator('#character-combinations svg.character-portrait').count(), 512);
    assert.match(await page.getByRole('link', { name: 'Mesa modular' }).getAttribute('href'), /mesa\.svg$/);
  } finally {
    await context.close();
    await accounts.close();
  }
});
