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
