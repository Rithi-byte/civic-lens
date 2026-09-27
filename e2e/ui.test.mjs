// CivicLens end-to-end UI tests (real Chrome, real clicks).
// 1) Start a server:  set MONGO_URI= && set PORT=5055 && npm start   (in-memory DB, seeded)
// 2) Run:            npm run test:e2e
// Env: BASE_URL (default http://localhost:5055), CHROME_PATH (default: Chrome's standard Windows path)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:5055';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const AXE = require.resolve('axe-core/axe.min.js');

let browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(path, { width = 1366, height = 850, token } = {}) {
  const page = await browser.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|401/.test(m.text()) && page.errors.push(m.text()));
  await page.setViewport({ width, height });
  if (token !== undefined) {
    await page.evaluateOnNewDocument((t) => {
      localStorage.clear();
      if (t) localStorage.setItem('token', t);
    }, token);
  }
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  return page;
}

async function tokenFor(email) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  });
  return (await r.json()).token;
}

const text = (page) => page.evaluate(() => document.body.innerText);
const clickText = async (page, selector, label) => {
  const els = await page.$$(selector);
  for (const el of els) {
    if ((await el.evaluate((n) => n.innerText.trim())).includes(label)) return el.click();
  }
  throw new Error(`No ${selector} with text "${label}"`);
};

async function axeViolations(page) {
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
  return res.violations
    .filter((v) => ['serious', 'critical'].includes(v.impact))
    .map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`);
}

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
});
after(() => browser.close());

describe('UI: public pages', () => {
  it('UI01 home page loads with live stats and no JS errors', async () => {
    const page = await open('/', { token: null });
    await page.waitForFunction(() => /Issues reported/.test(document.body.innerText) && !/^–$/m.test(document.body.innerText));
    const t = await text(page);
    assert.match(t, /See a problem\?/);
    assert.match(t, /\d+\s*\n?\s*Issues reported/);
    assert.deepEqual(page.errors, []);
    await page.close();
  });
  it('UI02 search updates results and the URL', async () => {
    const page = await open('/issues', { token: null });
    await page.type('input[placeholder^="Search"]', 'water');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.search.includes('q=water'));
    await page.waitForNetworkIdle();
    const titles = await page.$$eval('a[href^="/issues/"] h3', (h) => h.map((x) => x.innerText));
    assert.ok(titles.length > 0);
    await page.close();
  });
  it('UI03 category filter shows only that category', async () => {
    const page = await open('/issues?category=roads', { token: null });
    const cats = await page.$$eval('a[href^="/issues/"]', (cards) => cards.map((c) => c.innerText));
    assert.ok(cats.length > 0 && cats.every((t) => t.includes('Roads & Potholes')));
    await page.close();
  });
  it('UI04 map view loads map tiles (not blocked)', async () => {
    const page = await open('/issues?view=map', { token: null });
    await sleep(2500);
    const tiles = await page.$$eval('img.leaflet-tile', (imgs) => imgs.map((i) => i.complete && i.naturalWidth > 0));
    assert.ok(tiles.length > 0 && tiles.every(Boolean), 'all visible tiles should load');
    const markers = await page.$$('path.leaflet-interactive');
    assert.ok(markers.length >= 20);
    await page.close();
  });
  it('UI05 unknown page shows a 404 screen', async () => {
    const page = await open('/nope', { token: null });
    assert.match(await text(page), /404/);
    await page.close();
  });
});

describe('UI: login & access control', () => {
  it('UI06 empty login form shows validation messages', async () => {
    const page = await open('/login', { token: null });
    await clickText(page, 'button', 'Log in');
    const t = await text(page);
    assert.match(t, /Enter a valid email/);
    assert.match(t, /Password is required/);
    await page.close();
  });
  it('UI07 wrong password shows an error and stays on login', async () => {
    const page = await open('/login', { token: null });
    await page.type('#email', 'citizen@civiclens.in');
    await page.type('#password', 'wrongpass');
    await clickText(page, 'button', 'Log in');
    await page.waitForFunction(() => /Incorrect email or password/.test(document.body.innerText));
    assert.ok(page.url().endsWith('/login'));
    await page.close();
  });
  it('UI08 one-click demo login takes a citizen to My Reports', async () => {
    const page = await open('/login', { token: null });
    await clickText(page, 'button', 'Citizen');
    await page.waitForFunction(() => location.pathname === '/my-issues');
    await page.close();
  });
  it('UI09 citizen cannot open the admin dashboard', async () => {
    const page = await open('/admin', { token: await tokenFor('citizen@civiclens.in') });
    assert.equal(new URL(page.url()).pathname, '/my-issues');
    await page.close();
  });
  it('UI10 logged-out users are sent to login when reporting', async () => {
    const page = await open('/report', { token: null });
    assert.equal(new URL(page.url()).pathname, '/login');
    await page.close();
  });
});

describe('UI: full issue lifecycle', () => {
  let issueUrl;
  it('UI11 report form blocks submission when fields are missing', async () => {
    const page = await open('/report', { token: await tokenFor('citizen@civiclens.in') });
    await clickText(page, 'button', 'Submit report');
    const t = await text(page);
    assert.match(t, /Choose a category/);
    assert.match(t, /Title must be at least 5 characters/);
    assert.match(t, /Tap on the map or use your current location/);
    await page.close();
  });
  it('UI12 citizen reports an issue with a photo and map pin', async () => {
    const page = await open('/report', { token: await tokenFor('citizen@civiclens.in') });
    await clickText(page, 'button', 'Roads & Potholes');
    await page.type('#title', 'E2E test pothole near park');
    await page.type('#desc', 'Created by the automated UI test to check the full workflow.');
    await page.type('#address', 'Park Street');
    const file = await page.$('input[type=file]');
    await file.uploadFile(path.join(HERE, 'test-photo.jpg'));
    await page.waitForSelector('img[alt="Preview"]');
    const map = await page.$('.leaflet-container');
    const box = await map.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => /Pinned at/.test(document.body.innerText));
    await clickText(page, 'button', 'Submit report');
    await page.waitForFunction(() => /^\/issues\/[a-f0-9]{24}$/.test(location.pathname));
    issueUrl = new URL(page.url()).pathname;
    await page.waitForFunction(() => /E2E test pothole near park/.test(document.body.innerText));
    const img = await page.$eval('img[alt="E2E test pothole near park"]', (i) => i.complete && i.naturalWidth > 0);
    assert.ok(img, 'photo is shown on the issue page');
    await page.close();
  });
  it('UI13 the new issue card shows its photo in the public list', async () => {
    const page = await open('/issues', { token: null });
    const ok = await page.$eval(`a[href="${issueUrl}"] img`, (i) => i.complete && i.naturalWidth > 0 && i.src.endsWith('/image'));
    assert.ok(ok);
    await page.close();
  });
  it('UI14 roads officer sees it in the queue and acknowledges it', async () => {
    const page = await open('/dashboard', { token: await tokenFor('roads@civiclens.in') });
    const row = await page.waitForSelector(`xpath/.//tr[.//a[@href="${issueUrl}"]]`);
    const btn = await row.$('button');
    await btn.click();
    await page.waitForFunction(() => /Moved to Acknowledged/.test(document.body.innerText));
    await page.close();
  });
  it('UI15 citizen sees the status timeline and a notification', async () => {
    const page = await open(issueUrl, { token: await tokenFor('citizen@civiclens.in') });
    const t = await text(page);
    assert.match(t, /Acknowledged/);
    const badge = await page.$eval('button[aria-label="Notifications"]', (b) => b.innerText.trim());
    assert.ok(Number(badge) >= 1, 'unread badge is shown');
    await page.close();
  });
});

describe('UI: admin', () => {
  it('UI16 analytics dashboard renders all four charts', async () => {
    const page = await open('/admin', { token: await tokenFor('admin@civiclens.in') });
    await page.waitForSelector('svg.recharts-surface');
    await sleep(800);
    const charts = await page.$$('.recharts-responsive-container');
    assert.equal(charts.length, 4);
    assert.deepEqual(page.errors, []);
    await page.close();
  });
});

describe('UI: responsive layout (390 px phone)', () => {
  for (const [name, path, who] of [
    ['home', '/', null], ['issues', '/issues', null], ['login', '/login', null],
    ['report', '/report', 'citizen@civiclens.in'], ['admin', '/admin', 'admin@civiclens.in'],
  ]) {
    it(`UI17 no sideways scrolling on ${name}`, async () => {
      const page = await open(path, { width: 390, height: 844, token: who ? await tokenFor(who) : null });
      await sleep(500);
      const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      assert.ok(sw <= iw, `page is ${sw}px wide on a ${iw}px screen`);
      await page.close();
    });
  }
});

describe('UI: accessibility (axe-core, serious + critical)', () => {
  for (const [name, path, who] of [
    ['home', '/', null], ['issues', '/issues', null], ['login', '/login', null], ['report', '/report', 'citizen@civiclens.in'],
  ]) {
    it(`UI18 no serious accessibility violations on ${name}`, async () => {
      const page = await open(path, { token: who ? await tokenFor(who) : null });
      await sleep(500);
      const v = await axeViolations(page);
      assert.deepEqual(v, [], v.join('\n'));
      await page.close();
    });
  }
});
