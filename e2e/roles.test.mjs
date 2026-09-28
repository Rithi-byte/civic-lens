// Role-based access in the UI: which pages each role can open, and which menus/buttons they see.
// Needs the throwaway server on port 5055 (see ui.test.mjs), then:  npm run test:e2e
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL || 'http://localhost:5055';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EMAIL = { citizen: 'citizen@civiclens.in', authority: 'roads@civiclens.in', admin: 'admin@civiclens.in' };

let browser;
const tokens = {};

async function open(path, role) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });
  await page.evaluateOnNewDocument((t) => {
    localStorage.clear();
    if (t) localStorage.setItem('token', t);
  }, role === 'guest' ? null : tokens[role]);
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  return page;
}
const pathOf = (page) => new URL(page.url()).pathname;
const navLinks = (page) => page.$$eval('header nav a', (as) => as.map((a) => a.innerText.trim()).filter(Boolean));

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  for (const [role, email] of Object.entries(EMAIL)) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    tokens[role] = (await r.json()).token;
  }
});
after(() => browser.close());

// Where each role ends up when opening each protected page (redirects included)
const PAGES = {
  '/report': { guest: '/login', citizen: '/report', authority: '/dashboard', admin: '/admin' },
  '/my-issues': { guest: '/login', citizen: '/my-issues', authority: '/dashboard', admin: '/admin' },
  '/dashboard': { guest: '/login', citizen: '/my-issues', authority: '/dashboard', admin: '/admin' },
  '/admin': { guest: '/login', citizen: '/my-issues', authority: '/dashboard', admin: '/admin' },
  '/login': { guest: '/login', citizen: '/my-issues', authority: '/dashboard', admin: '/admin' },
  '/issues': { guest: '/issues', citizen: '/issues', authority: '/issues', admin: '/issues' },
};

describe('UI roles: page access', () => {
  for (const [path, expected] of Object.entries(PAGES)) {
    for (const [role, dest] of Object.entries(expected)) {
      it(`RP ${role} opening ${path} lands on ${dest}`, async () => {
        const page = await open(path, role);
        assert.equal(pathOf(page), dest);
        await page.close();
      });
    }
  }
});

describe('UI roles: menus and buttons', () => {
  it('RM1 each role sees only its own menu items', async () => {
    const expected = {
      guest: ['Browse Issues', 'Report Issue', 'Log in'],
      citizen: ['Browse Issues', 'My Reports', 'Report Issue'],
      authority: ['Browse Issues', 'Department Queue'],
      admin: ['Browse Issues', 'Admin Dashboard'],
    };
    for (const [role, links] of Object.entries(expected)) {
      const page = await open('/issues', role);
      const got = (await navLinks(page)).filter((t) => !/^Civic/.test(t));
      assert.deepEqual(got, links, `${role} menu`);
      await page.close();
    }
  });

  it('RM2 "Take action" panel shows only for the responsible officer and admin', async () => {
    const r = await fetch(`${BASE}/api/issues?category=roads&status=open&limit=1`);
    const roadsIssue = (await r.json()).items[0]._id;
    const seen = {};
    for (const role of ['guest', 'citizen', 'authority', 'admin']) {
      const page = await open(`/issues/${roadsIssue}`, role);
      seen[role] = /Take action/.test(await page.evaluate(() => document.body.innerText));
      await page.close();
    }
    assert.deepEqual(seen, { guest: false, citizen: false, authority: true, admin: true });
  });

  it('RM3 officer from another department sees no action panel', async () => {
    const r = await fetch(`${BASE}/api/issues?category=water&limit=1`);
    const waterIssue = (await r.json()).items[0]._id;
    const page = await open(`/issues/${waterIssue}`, 'authority'); // roads officer
    assert.equal(/Take action/.test(await page.evaluate(() => document.body.innerText)), false);
    await page.close();
  });

  it('RM4 only admins get officer-assignment and priority controls', async () => {
    const r = await fetch(`${BASE}/api/issues?category=roads&status=open&limit=1`);
    const id = (await r.json()).items[0]._id;
    const count = {};
    for (const role of ['authority', 'admin']) {
      const page = await open(`/issues/${id}`, role);
      count[role] = /Assigned officer/.test(await page.evaluate(() => document.body.innerText));
      await page.close();
    }
    assert.deepEqual(count, { authority: false, admin: true });
  });

  it('RM5 delete button: only admins on others’ issues', async () => {
    const r = await fetch(`${BASE}/api/issues?status=reported&limit=1`);
    const id = (await r.json()).items[0]._id;
    const seen = {};
    for (const role of ['guest', 'authority', 'admin']) {
      const page = await open(`/issues/${id}`, role);
      seen[role] = await page.$$eval('button', (bs) => bs.some((b) => b.innerText.trim() === 'Delete'));
      await page.close();
    }
    assert.deepEqual(seen, { guest: false, authority: false, admin: true });
  });
});
