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
