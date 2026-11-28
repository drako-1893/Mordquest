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

test('El plano experto conserva casillas táctiles y permite ajustar la vista', async () => {
  const expert = catalog.find(level => level.size === 16);
  for (const [width, height] of [[320, 568], [390, 844], [640, 360]]) {
    const context = await player(browser, { viewport: { width, height }, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      await open(page, app.origin, expert.url);
      const cell = page.locator('#cells .cell').first();
      const box = await cell.boundingBox();
      assert(box.width >= 24 && box.height >= 24, `${width} × ${height}`);
      const viewport = page.locator('.board-viewport');
      assert(await viewport.evaluate(element => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight));
      await page.locator('[data-board-fit]').tap();
      assert(await viewport.evaluate(element => element.querySelector('.board').getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1));
      await page.locator('[data-board-zoom-in]').tap();
      assert((await cell.boundingBox()).height >= 24);
    } finally {
      await context.close();
    }
  }
});

test('Cada pestaña puede recuperar su borrador tras una edición concurrente', async () => {
  const context = await player(browser);
  try {
    const first = await context.newPage();
    const second = await context.newPage();
    const caseUrl = catalog[0].url;
    await Promise.all([open(first, app.origin, caseUrl), open(second, app.origin, caseUrl)]);
    const playable = page => page.locator('#cells .cell:not(.is-obstacle)');
    await Promise.all([playable(first).nth(0).press('Enter'), playable(second).nth(1).press('Enter')]);
    await first.locator('#draft-recovery-open').waitFor({ state: 'visible' });
    await open(first, app.origin, caseUrl);
    const original = await playable(first).nth(0).getAttribute('aria-label');
    await first.locator('#draft-recovery-open').click();
    const versions = first.locator('#draft-versions');
    await versions.getByRole('button', { name: /^Otra versión/ }).click();
    await versions.waitFor({ state: 'hidden' });
    assert.notEqual(await playable(first).nth(0).getAttribute('aria-label'), original);
    await first.locator('#draft-recovery-open').click();
    assert.equal(await versions.getByRole('button', { name: /^Otra versión/ }).count(), 1);
  } finally {
    await context.close();
  }
});

test('Un enlace abierto desde el catálogo permanece estable al reordenar los niveles', async () => {
  const reordered = await startApp({ module: 'tests.reordered_app:app' });
  const context = await player(browser);
  try {
    const page = await context.newPage();
    const [first, second] = catalog;
    await open(page, app.origin, '/levels');
    const savedLink = await page.locator('.level-play').first().getAttribute('href');
    assert.equal(savedLink, first.url);
    await open(page, reordered.origin, savedLink);
    assert.equal(await page.locator('.case').getAttribute('data-level-id'), first.id);
    assert.match(await page.locator('#case-number').textContent(), new RegExp(`Nivel ${second.order}$`));
    await open(page, reordered.origin, `/level/${first.order}/`);
    assert.equal(new URL(page.url()).pathname, second.url);
  } finally {
    await context.close();
    await reordered.close();
  }
});

test('Un perfil nuevo practica colocar, anotar y deshacer con un toque', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await open(page, app.origin, catalog[0].url);
    const practice = page.locator('#practice-instruction');
    await practice.waitFor({ state: 'visible' });
    const check = page.locator('#check');
    const checkX = (await check.boundingBox()).x;
    assert.equal(await check.isDisabled(), true);
    assert.match(await page.locator('#check-remaining').innerText(), /Faltan 6/);
    const freeCell = () => page.locator('#cells .cell:not(.is-obstacle):not(.has-cross):not(.is-occupied)').first();
    const firstCell = await freeCell().elementHandle();
    await firstCell.tap();
    assert.match(await firstCell.getAttribute('aria-label'), /en esta casilla/);
    assert.match(await practice.innerText(), /anota su inicial/);
    const noteCell = await freeCell().elementHandle();
    await noteCell.tap();
    assert.match(await noteCell.getAttribute('aria-label'), /Anotaciones/);
    await page.locator('#undo').tap();
    assert.doesNotMatch(await noteCell.getAttribute('aria-label'), /Anotaciones/);
    assert.match(await page.locator('#feedback').innerText(), /Práctica completada/);
    assert.equal((await check.boundingBox()).x, checkX);
    await page.locator('#board-help').tap();
    await page.locator('#help-practice').tap();
    await page.locator('#practice-skip').tap();
    assert.equal(await practice.isVisible(), false);
  } finally {
    await context.close();
  }
});

test('Una repetición se puede retomar y conserva el logro del caso', async () => {
  const level = catalog[0];
  const context = await player(browser);
  await context.addInitScript(id => {
    if (localStorage.getItem('test-replay-seeded')) return;
    localStorage.setItem('test-replay-seeded', '1');
    localStorage.setItem('archivo-nocturno:completed:guest', JSON.stringify([id]));
    localStorage.setItem(`archivo-nocturno:draft:guest:${id}:elapsed:6`, '180000');
  }, level.id);
  try {
    const page = await context.newPage();
    await open(page, app.origin, '/levels');
    const card = page.locator(`[data-level-id="${level.id}"]`);
    await card.getByRole('link', { name: /^Ver resuelto/ }).click();
    await page.locator('#page-loading').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#replay-dialog').isVisible(), false);
    await page.locator('#feedback[data-state="solved"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#puzzle-time').textContent(), '03:00');
    await page.locator('#replay').click();
    await page.locator('#replay-yes').click();
    await page.locator('#replay-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#count').textContent(), '0 / 6');
    assert.equal(await page.locator('#puzzle-time').textContent(), '00:00');
    await page.locator('#cells .cell:not(.is-obstacle)').first().press('Enter');
    await open(page, app.origin, '/levels');
    assert.match(await card.locator('.completed').textContent(), /Resuelto/);
    await card.getByRole('link', { name: /^Continuar repetición/ }).click();
    await page.locator('#page-loading').waitFor({ state: 'detached' });
    assert.match(await page.locator('#cells .cell:not(.is-obstacle)').first().getAttribute('aria-label'), /Anotaciones/);
  } finally {
    await context.close();
  }
});

test('El plano resuelto se recorre por teclado y la solución anuncia coordenadas', async () => {
  const level = catalog[0];
  const context = await player(browser);
  await context.addInitScript(id => localStorage.setItem('archivo-nocturno:completed:guest', JSON.stringify([id])), level.id);
  try {
    const page = await context.newPage();
    await open(page, app.origin, level.url);
    const help = page.locator('#board-help');
    await help.focus();
    await page.keyboard.press('Tab');
    const active = page.locator('#cells .cell:focus');
    assert.match(await active.getAttribute('aria-label'), /Fila 1, columna A/);
    await page.keyboard.press('ArrowRight');
    const label = await active.getAttribute('aria-label');
    assert.match(label, /Fila 1, columna B/);
    assert.equal(await active.getAttribute('aria-disabled'), 'true');
    await page.keyboard.press('Shift+Enter');
    assert.equal(await active.getAttribute('aria-label'), label);

    await help.click();
    await page.getByRole('button', { name: 'Cerrar tutorial' }).click();
    assert.equal(await page.locator(':focus').getAttribute('id'), 'board-help');
    await page.locator('#show-walkthrough').click();
    await page.locator('#hint-reveal').click();
    await page.locator('.walkthrough-card').waitFor({ state: 'visible' });
    const changed = page.locator('#walkthrough-positions');
    while (!await changed.isVisible() && !await page.locator('#walkthrough-next').isDisabled()) {
      await page.locator('#walkthrough-next').click();
    }
    assert.match(await changed.locator('li').first().innerText(), / en [A-Z]\d+$/);
    await page.locator('#walkthrough-dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    assert.equal(await page.locator(':focus').getAttribute('id'), 'show-walkthrough');
  } finally {
    await context.close();
  }
});

test('La ayuda revela primero una pista y conserva el tablero hasta cerrar', async () => {
  const context = await player(browser);
  const level = catalog[0];
  try {
    for (const item of catalog) {
      const response = await fetch(`${app.origin}/api/levels/${item.id}/hint`);
      assert.equal(response.status, 200, item.id);
      const hint = await response.json();
      assert.match(hint.person, /^[A-Z]$/);
      assert(hint.deduction.length > 5);
      assert.deepEqual(Object.keys(hint).sort(), ['deduction', 'person']);
    }
    const page = await context.newPage();
    let requestedSolution = false;
    page.on('request', request => { if (request.url().endsWith('/walkthrough')) requestedSolution = true; });
    await open(page, app.origin, level.url);
    const cell = page.locator('#cells .cell:not(.is-obstacle)').first();
    await cell.press('Enter');
    const previous = await cell.getAttribute('aria-label');
    await page.getByRole('button', { name: 'Pista', exact: true }).click();
    await page.locator('#hint-explain').waitFor({ state: 'visible' });
    assert.match(await page.locator('#hint-status').innerText(), /Empieza por/);
    assert.equal(await page.locator('#hint-deduction').isVisible(), false);
    await page.locator('#hint-explain').click();
    assert.equal(await page.locator('#hint-deduction').isVisible(), true);
    assert.equal(requestedSolution, false);
    await page.locator('#hint-dialog').getByRole('button', { name: 'Volver al tablero' }).click();
    assert.equal(await cell.getAttribute('aria-label'), previous);
    await page.getByRole('button', { name: 'Pista', exact: true }).click();
    await page.locator('#hint-reveal').click();
    await page.locator('.walkthrough-card').waitFor({ state: 'visible' });
    assert.equal(requestedSolution, true);
  } finally {
    await context.close();
  }
});

test('El catálogo y el caso se recuperan con Reintentar y el tablero tolera un SVG caído', async () => {
  const context = await player(browser);
  const level = catalog[0];
  const page = await context.newPage();
  try {
    await page.route('**/api/levels', route => route.abort(), { times: 1 });
    await page.route('**/resources/mesa.svg', route => route.abort());
    await open(page, app.origin, '/levels');
    await page.locator('#retry-catalog').click();
    const firstCard = page.locator('.level-card').first();
    await firstCard.getByRole('link', { name: /^Jugar/ }).waitFor({ state: 'visible' });
    assert.equal(await firstCard.locator('img').getAttribute('loading'), 'lazy');

    await page.route(`**/api/levels/${level.id}`, route => route.abort(), { times: 1 });
    await open(page, app.origin, level.url);
    assert.equal(await page.locator('.game-levels-link').isVisible(), true);
    await page.locator('#retry-level').click();
    await page.locator('#cells .cell').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('#retry-level').isVisible(), false);
    await page.locator('#cells .scenery-fallback').filter({ hasText: 'Mesa' }).first().waitFor({ state: 'visible' });
    const css = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
    const response = await fetch(new URL(css, app.origin));
    assert.match(response.headers.get('cache-control'), /immutable/);
  } finally {
    await context.close();
  }
});

test('Un arrastre con ratón o toque se deshace como un solo gesto', async () => {
  for (const touch of [false, true]) {
    const context = await player(browser, touch ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : {});
    try {
      const page = await context.newPage();
      await open(page, app.origin, catalog[0].url);
      const cells = page.locator('#cells .cell');
      const start = await cells.evaluateAll(items => items.findIndex((item, index) =>
        index % 6 <= 3 && items.slice(index, index + 3).every(cell => !cell.classList.contains('is-obstacle'))));
      assert(start >= 0);
      const [from, to] = await Promise.all([cells.nth(start).boundingBox(), cells.nth(start + 2).boundingBox()]);
      const y = from.y + from.height / 2;
      const x1 = from.x + from.width / 2;
      const x2 = to.x + to.width / 2;
      await page.locator('#cross').click();
      async function stroke() {
        if (touch) {
          const cdp = await context.newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x1 + x2) / 2, y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x2, y }] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await cdp.detach();
        } else {
          await page.mouse.move(x1, y);
          await page.mouse.down();
          await page.mouse.move(x2, y, { steps: 3 });
          await page.mouse.up();
        }
      }
      await stroke();
      assert.equal(await page.locator('#cells .has-cross').count(), 3);
      await page.locator('#undo').click();
      assert.equal(await page.locator('#cells .has-cross').count(), 0);
      assert.equal(await page.locator('#undo').isDisabled(), true);
      await stroke();
      await open(page, app.origin, catalog[0].url);
      assert.equal(await page.locator('#cells .has-cross').count(), 3);
    } finally {
      await context.close();
    }
  }
});

test('Recursos filtra objetos, muestra huellas y carga los retratos por grupos', async () => {
  const accounts = await startApp({ guestOnly: false });
  const context = await player(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const login = await context.request.post(`${accounts.origin}/api/auth/login`, {
      data: { username: 'admin', password: 'temporary-test-only-passphrase' },
      headers: { 'X-Game-Request': '1' },
    });
    assert.equal(login.status(), 200);
    const page = await context.newPage();
    await open(page, accounts.origin, '/resources');
    const portraits = page.locator('#character-combinations svg.character-portrait');
    assert.equal(await portraits.count(), 0);
    const busts = page.locator('#character-combinations summary').filter({ hasText: /^Busto [1-4]$/ });
    assert.equal(await busts.count(), 8);
    for (const bust of await busts.all()) await bust.click();
    await portraits.nth(511).waitFor({ state: 'visible' });
    assert.equal(await portraits.count(), 512);

    await page.locator('#asset-name').fill('mesa modular');
    await page.locator('#asset-role').selectOption('obstacle');
    await page.locator('#asset-size').selectOption('3 × 2');
    const cards = page.locator('.catalog-room .asset-card:visible');
    assert.equal(await cards.count(), 1);
    const card = cards.first();
    const link = card.getByRole('link', { name: 'Mesa modular' });
    assert.match(await link.getAttribute('href'), /mesa\.svg$/);
    await link.hover();
    assert(await page.locator('.example-cell.is-highlighted').count() > 0);
    await page.mouse.move(0, 0);
    await link.focus();
    assert(await page.locator('.example-cell.is-highlighted').count() > 0);
    const preview = card.getByRole('button', { name: 'Ver huella' });
    await preview.tap();
    const footprint = card.getByRole('img', { name: /6 casillas ocupadas en 3 × 2/ });
    assert.equal(await footprint.isVisible(), true);
    await preview.press('Enter');
    assert.equal(await footprint.isVisible(), false);
  } finally {
    await context.close();
    await accounts.close();
  }
});
