// CivicLens API integration tests.
// Runs against a throwaway in-memory MongoDB seeded with the demo data.
// Run with:  npm test   (from the server folder)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { default: app } = await import('../src/app.js');
const { seed } = await import('../src/seed.js');
const { default: User } = await import('../src/models/User.js');
const { default: Issue } = await import('../src/models/Issue.js');
const { default: Notification } = await import('../src/models/Notification.js');

const api = request(app);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const tok = {};
let mem;

const login = async (email, password = 'password123') => (await api.post('/api/auth/login').send({ email, password })).body.token;
const auth = (who) => ({ Authorization: `Bearer ${tok[who]}` });
const newIssue = (over = {}) => ({
  title: 'Broken streetlight near school',
  description: 'The streetlight outside the school gate has been off for a week.',
  category: 'electricity',
  location: { address: 'School Road', area: 'Tambaram', lat: 12.92, lng: 80.12 },
  ...over,
});

before(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('civiclens-test'));
  await Issue.syncIndexes();
  await seed();
  for (const [k, email] of Object.entries({
    citizen: 'citizen@civiclens.in', rahul: 'rahul@civiclens.in', roads: 'roads@civiclens.in',
    water: 'water@civiclens.in', electricity: 'electricity@civiclens.in', admin: 'admin@civiclens.in',
  })) tok[k] = await login(email);
});

after(async () => {
  await mongoose.disconnect();
  await mem.stop();
});

describe('1. Health, routing & security headers', () => {
  it('TC01 GET /api/health returns ok', async () => {
    const r = await api.get('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });
  it('TC02 unknown API route returns a JSON 404', async () => {
    const r = await api.get('/api/does-not-exist');
    assert.equal(r.status, 404);
    assert.match(r.body.message, /Route not found/);
  });
  it('TC03 security headers are set', async () => {
    const r = await api.get('/api/health');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.equal(r.headers['x-powered-by'], undefined);
  });
});

describe('2. Authentication', () => {
  it('TC04 citizen can register; password is never returned', async () => {
    const r = await api.post('/api/auth/register').send({ name: 'Test User', email: 'test1@x.com', password: 'secret12' });
    assert.equal(r.status, 201);
    assert.ok(r.body.token);
    assert.equal(r.body.user.role, 'citizen');
    assert.equal(r.body.user.password, undefined);
  });
  it('TC05 registering cannot self-assign the admin role', async () => {
    const r = await api.post('/api/auth/register').send({ name: 'Sneaky', email: 'sneaky@x.com', password: 'secret12', role: 'admin' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'citizen');
  });
  it('TC06 duplicate email is rejected with 409', async () => {
    const r = await api.post('/api/auth/register').send({ name: 'Again', email: 'test1@x.com', password: 'secret12' });
    assert.equal(r.status, 409);
  });
  it('TC07 invalid email / short password return 400 with a clear message', async () => {
    const r1 = await api.post('/api/auth/register').send({ name: 'A B', email: 'not-an-email', password: 'secret12' });
    assert.equal(r1.status, 400);
    assert.match(r1.body.message, /valid email/);
    const r2 = await api.post('/api/auth/register').send({ name: 'A B', email: 'ok@x.com', password: '123' });
    assert.equal(r2.status, 400);
    assert.match(r2.body.message, /at least 6/);
  });
  it('TC08 wrong password returns 401', async () => {
    const r = await api.post('/api/auth/login').send({ email: 'citizen@civiclens.in', password: 'wrong-pass' });
    assert.equal(r.status, 401);
  });
  it('TC09 unknown email gives the same message (no account enumeration)', async () => {
    const a = await api.post('/api/auth/login').send({ email: 'citizen@civiclens.in', password: 'wrong-pass' });
    const b = await api.post('/api/auth/login').send({ email: 'nobody@civiclens.in', password: 'wrong-pass' });
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });
  it('TC10 /auth/me rejects missing and forged tokens', async () => {
    assert.equal((await api.get('/api/auth/me')).status, 401);
    assert.equal((await api.get('/api/auth/me').set('Authorization', 'Bearer forged.token.value')).status, 401);
    const ok = await api.get('/api/auth/me').set(auth('citizen'));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, 'citizen@civiclens.in');
  });
  it('TC11 NoSQL-injection payload in login is rejected', async () => {
    const r = await api.post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(r.status, 400);
  });
});

describe('3. Browsing, search & filters (public)', () => {
  it('TC12 issue list works without login and is paginated', async () => {
    const r = await api.get('/api/issues?limit=5');
    assert.equal(r.status, 200);
    assert.equal(r.body.items.length, 5);
    assert.equal(r.body.total, 20);
    assert.equal(r.body.pages, 4);
  });
  it('TC13 category filter returns only that category', async () => {
    const r = await api.get('/api/issues?category=roads&limit=50');
    assert.ok(r.body.items.length > 0);
    assert.ok(r.body.items.every((i) => i.category === 'roads'));
  });
  it('TC14 status=open returns only unresolved issues', async () => {
    const r = await api.get('/api/issues?status=open&limit=50');
    assert.ok(r.body.items.every((i) => ['reported', 'acknowledged', 'in_progress'].includes(i.status)));
  });
  it('TC15 full-text search finds matching issues', async () => {
    const r = await api.get('/api/issues?q=pothole');
    assert.ok(r.body.total >= 1);
    assert.ok(r.body.items.some((i) => /pothole/i.test(i.title + i.description)));
  });
  it('TC16 sort=top orders by upvotes (descending)', async () => {
    const r = await api.get('/api/issues?sort=top&limit=50');
    const counts = r.body.items.map((i) => i.upvoteCount);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  });
  it('TC17 invalid filter values return 400', async () => {
    assert.equal((await api.get('/api/issues?status=banana')).status, 400);
    assert.equal((await api.get('/api/issues?limit=1000')).status, 400);
  });
  it('TC18 malformed id returns 400, unknown id returns 404', async () => {
    assert.equal((await api.get('/api/issues/not-an-id')).status, 400);
    assert.equal((await api.get(`/api/issues/${new mongoose.Types.ObjectId()}`)).status, 404);
  });
  it('TC19 map endpoint returns coordinates for every issue', async () => {
    const r = await api.get('/api/issues/map');
    assert.equal(r.body.length, 20);
    assert.ok(r.body.every((p) => typeof p.location.lat === 'number'));
  });
});

describe('4. Reporting an issue', () => {
  it('TC20 anonymous users cannot report', async () => {
    assert.equal((await api.post('/api/issues').send(newIssue())).status, 401);
  });
  it('TC21 authorities cannot file reports (citizens only)', async () => {
    assert.equal((await api.post('/api/issues').set(auth('roads')).send(newIssue())).status, 403);
  });
  it('TC22 missing / too-short fields return 400', async () => {
    const r = await api.post('/api/issues').set(auth('citizen')).send({ title: 'x' });
    assert.equal(r.status, 400);
    assert.ok(r.body.details.length >= 3);
  });
  it('TC23 non-image uploads are rejected', async () => {
    const r = await api.post('/api/issues').set(auth('citizen')).send(newIssue({ image: 'data:text/html;base64,PHNjcmlwdD4=' }));
    assert.equal(r.status, 400);
  });
  it('TC24 valid report is created, auto-upvoted and routed to the department', async () => {
    const before = await Notification.countDocuments({ message: /New electricity issue/ });
    const r = await api.post('/api/issues').set(auth('citizen')).send(newIssue({ image: PNG }));
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'reported');
    assert.equal(r.body.history.length, 1);
    assert.equal(r.body.upvotes.length, 1);
    const afterCount = await Notification.countDocuments({ message: /New electricity issue/ });
    assert.equal(afterCount, before + 1, 'electricity officer should be notified');
  });
  it('TC25 issue list does not embed full photos (served separately)', async () => {
    const r = await api.get('/api/issues?q=streetlight school&limit=5');
    const item = r.body.items.find((i) => i.title === 'Broken streetlight near school');
    assert.ok(item, 'new issue should be listed');
    assert.equal(item.image, undefined, 'base64 image should not be in the list payload');
    assert.equal(item.hasImage, true);
    const img = await api.get(`/api/issues/${item._id}/image`);
    assert.equal(img.status, 200);
    assert.match(img.headers['content-type'], /^image\/png/);
  });
});

describe('5. Resolution workflow (roles & transitions)', () => {
  let id;
  before(async () => {
    id = (await api.post('/api/issues').set(auth('rahul')).send(newIssue({ title: 'Pothole on main road', category: 'roads' }))).body._id;
  });
  it('TC26 officer from another department cannot update it', async () => {
    assert.equal((await api.patch(`/api/issues/${id}/status`).set(auth('water')).send({ status: 'acknowledged' })).status, 403);
  });
  it('TC27 citizens cannot change status', async () => {
    assert.equal((await api.patch(`/api/issues/${id}/status`).set(auth('rahul')).send({ status: 'acknowledged' })).status, 403);
  });
  it('TC28 officer cannot skip steps (Reported → Resolved)', async () => {
    const r = await api.patch(`/api/issues/${id}/status`).set(auth('roads')).send({ status: 'resolved', note: 'done' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Cannot move/);
  });
  it('TC29 rejecting or resolving requires a note', async () => {
    const r = await api.patch(`/api/issues/${id}/status`).set(auth('roads')).send({ status: 'rejected' });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /note/);
  });
  it('TC30 full valid path records history, sets resolvedAt and notifies the reporter', async () => {
    for (const [status, note] of [['acknowledged', ''], ['in_progress', 'Crew assigned'], ['resolved', 'Pothole filled']]) {
      const r = await api.patch(`/api/issues/${id}/status`).set(auth('roads')).send({ status, note });
      assert.equal(r.status, 200, `${status} should succeed`);
    }
    const issue = await Issue.findById(id);
    assert.equal(issue.status, 'resolved');
    assert.ok(issue.resolvedAt);
    assert.equal(issue.history.length, 4);
    assert.equal(String(issue.assignedTo), String((await User.findOne({ email: 'roads@civiclens.in' }))._id), 'officer auto-assigned');
    const n = await api.get('/api/notifications').set(auth('rahul'));
    assert.ok(n.body.items.some((x) => /Resolved/.test(x.message)));
  });
  it('TC31 admin can reopen a resolved issue; resolvedAt is cleared', async () => {
    const r = await api.patch(`/api/issues/${id}/status`).set(auth('admin')).send({ status: 'in_progress', note: 'Reopened after complaint' });
    assert.equal(r.status, 200);
    assert.equal((await Issue.findById(id)).resolvedAt, null);
  });
});

describe('6. Assignment (admin)', () => {
  let id, water, citizen, inactive;
  before(async () => {
    id = (await Issue.findOne({ status: 'reported' }))._id;
    water = await User.findOne({ email: 'water@civiclens.in' });
    citizen = await User.findOne({ email: 'citizen@civiclens.in' });
    inactive = await User.create({ name: 'Old Officer', email: 'old@civiclens.in', password: 'password123', role: 'authority', department: 'roads', active: false });
  });
  it('TC32 admin assigns an active officer, who is notified', async () => {
    const r = await api.patch(`/api/issues/${id}/assign`).set(auth('admin')).send({ assignedTo: String(water._id), priority: 'high' });
    assert.equal(r.status, 200);
    const n = await api.get('/api/notifications').set(auth('water'));
    assert.ok(n.body.items.some((x) => /You were assigned/.test(x.message)));
  });
  it('TC33 cannot assign a non-authority user', async () => {
    assert.equal((await api.patch(`/api/issues/${id}/assign`).set(auth('admin')).send({ assignedTo: String(citizen._id) })).status, 400);
  });
  it('TC34 cannot assign a deactivated officer', async () => {
    assert.equal((await api.patch(`/api/issues/${id}/assign`).set(auth('admin')).send({ assignedTo: String(inactive._id) })).status, 400);
  });
  it('TC35 only admins can assign', async () => {
    assert.equal((await api.patch(`/api/issues/${id}/assign`).set(auth('roads')).send({ priority: 'low' })).status, 403);
  });
});

describe('7. Upvotes & comments', () => {
  let id;
  before(async () => { id = (await Issue.findOne({ status: 'in_progress' }))._id; });
  it('TC36 upvote toggles on and off with a correct count', async () => {
    const start = (await api.get(`/api/issues/${id}`).set(auth('rahul'))).body;
    const a = await api.post(`/api/issues/${id}/upvote`).set(auth('rahul'));
    assert.equal(a.body.upvoted, !start.upvoted);
    const b = await api.post(`/api/issues/${id}/upvote`).set(auth('rahul'));
    assert.equal(b.body.upvoted, start.upvoted);
    assert.equal(b.body.upvoteCount, start.upvoteCount);
  });
  it('TC37 empty and over-long comments are rejected', async () => {
    assert.equal((await api.post(`/api/issues/${id}/comments`).set(auth('rahul')).send({ text: '   ' })).status, 400);
    assert.equal((await api.post(`/api/issues/${id}/comments`).set(auth('rahul')).send({ text: 'x'.repeat(501) })).status, 400);
  });
  it('TC38 valid comment is saved with the author name', async () => {
    const r = await api.post(`/api/issues/${id}/comments`).set(auth('rahul')).send({ text: 'Still not fixed today.' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.name, 'Rahul Menon');
  });
  it('TC39 comment text containing HTML is stored as plain text', async () => {
    const r = await api.post(`/api/issues/${id}/comments`).set(auth('rahul')).send({ text: '<img src=x onerror=alert(1)>' });
    assert.equal(r.status, 201);
    assert.equal(r.body.text, '<img src=x onerror=alert(1)>'); // React escapes it on render
  });
});

describe('8. Deleting reports', () => {
  let mine, acked;
  before(async () => {
    mine = (await api.post('/api/issues').set(auth('citizen')).send(newIssue({ title: 'Delete me please', category: 'water' }))).body._id;
    acked = (await api.post('/api/issues').set(auth('citizen')).send(newIssue({ title: 'Keep me please', category: 'water' }))).body._id;
    await api.patch(`/api/issues/${acked}/status`).set(auth('water')).send({ status: 'acknowledged' });
  });
  it('TC40 another citizen cannot delete my report', async () => {
    assert.equal((await api.delete(`/api/issues/${mine}`).set(auth('rahul'))).status, 403);
  });
  it('TC41 I cannot delete once it has been acknowledged', async () => {
    assert.equal((await api.delete(`/api/issues/${acked}`).set(auth('citizen'))).status, 403);
  });
  it('TC42 I can delete my own report while it is still Reported; its notifications go too', async () => {
    assert.equal((await api.delete(`/api/issues/${mine}`).set(auth('citizen'))).status, 200);
    assert.equal(await Issue.countDocuments({ _id: mine }), 0);
    assert.equal(await Notification.countDocuments({ issue: mine }), 0);
  });
});

describe('9. User management (admin)', () => {
  it('TC43 non-admins cannot list users', async () => {
    assert.equal((await api.get('/api/users').set(auth('citizen'))).status, 403);
    assert.equal((await api.get('/api/users').set(auth('roads'))).status, 403);
  });
  it('TC44 authority accounts need a department', async () => {
    const r = await api.post('/api/users').set(auth('admin')).send({ name: 'No Dept', email: 'nodept@x.com', password: 'secret12', role: 'authority' });
    assert.equal(r.status, 400);
  });
  it('TC45 admin creates an officer who can then log in', async () => {
    const r = await api.post('/api/users').set(auth('admin')).send({ name: 'New Officer', email: 'newofficer@x.com', password: 'secret12', department: 'drainage' });
    assert.equal(r.status, 201);
    assert.ok(await login('newofficer@x.com', 'secret12'));
  });
  it('TC46 deactivated users are locked out immediately', async () => {
    const u = await User.findOne({ email: 'newofficer@x.com' });
    const t = await login('newofficer@x.com', 'secret12');
    assert.equal((await api.patch(`/api/users/${u._id}`).set(auth('admin')).send({ active: false })).status, 200);
    assert.equal((await api.get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status, 401);
    assert.equal((await api.post('/api/auth/login').send({ email: 'newofficer@x.com', password: 'secret12' })).status, 403);
  });
  it('TC47 admin cannot deactivate their own account', async () => {
    const me = await User.findOne({ email: 'admin@civiclens.in' });
    assert.equal((await api.patch(`/api/users/${me._id}`).set(auth('admin')).send({ active: false })).status, 400);
  });
});

describe('10. Stats & notifications', () => {
  it('TC48 public stats add up', async () => {
    const s = (await api.get('/api/stats')).body;
    const sum = Object.values(s.byStatus).reduce((a, b) => a + b, 0);
    assert.equal(sum, s.total);
    assert.equal(s.open + s.resolved + (s.byStatus.rejected || 0), s.total);
    assert.equal(s.trend.length, 14);
  });
  it('TC49 authority stats are scoped to their department', async () => {
    const s = (await api.get('/api/stats').set(auth('water'))).body;
    assert.deepEqual(s.byCategory.map((c) => c.category), ['water']);
  });
  it('TC50 mark-all-read clears the unread badge', async () => {
    await api.patch('/api/notifications/read-all').set(auth('rahul'));
    assert.equal((await api.get('/api/notifications').set(auth('rahul'))).body.unread, 0);
  });
});

describe('11. Robustness', () => {
  it('TC51 malformed JSON returns a friendly 400', async () => {
    const r = await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(r.status, 400);
    assert.equal(r.body.message, 'Request body is not valid JSON');
  });
  it('TC52 oversized request body returns 413', async () => {
    const r = await api.post('/api/issues').set(auth('citizen')).send(newIssue({ image: 'data:image/png;base64,' + 'A'.repeat(6_000_000) }));
    assert.equal(r.status, 413);
    assert.match(r.body.message, /too large/);
  });
  // Keep last: it trips the login rate limiter for this IP
  it('TC53 repeated failed logins are rate-limited (brute-force protection)', async () => {
    let status;
    for (let i = 0; i < 15; i++) {
      status = (await api.post('/api/auth/login').send({ email: 'admin@civiclens.in', password: `guess-${i}` })).status;
      if (status === 429) break;
    }
    assert.equal(status, 429);
  });
});
