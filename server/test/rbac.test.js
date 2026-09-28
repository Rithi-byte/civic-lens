// Role-based access control (RBAC) matrix tests.
// Every protected action is attempted by every kind of user and the HTTP status is checked.
// Run with:  npm test   (from the server folder)
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const { default: app } = await import('../src/app.js');
const { seed } = await import('../src/seed.js');
const { signToken } = await import('../src/middleware/auth.js');
const { default: User } = await import('../src/models/User.js');
const { default: Issue } = await import('../src/models/Issue.js');

const api = request(app);
let mem;
const U = {}; // user documents
const T = {}; // tokens

// Actors: who is making the request
const ACTORS = ['anonymous', 'owner', 'otherCitizen', 'roadsOfficer', 'waterOfficer', 'admin', 'deactivated'];
const hdr = (who) => (T[who] ? { Authorization: `Bearer ${T[who]}` } : {});

// A fresh "roads" issue reported by the owner, in the given status
async function makeIssue(status = 'reported', extra = {}) {
  const issue = await Issue.create({
    title: 'RBAC test pothole',
    description: 'Issue created by the RBAC matrix test suite.',
    category: 'roads',
    status,
    location: { address: 'Test Road', area: 'Tambaram', lat: 12.9, lng: 80.1 },
    reporter: U.owner._id,
    history: [{ status: 'reported', by: U.owner._id }],
    ...extra,
  });
  return String(issue._id);
}

const matrix = []; // collected for the printed summary
async function expectMatrix(action, expected, send) {
  const row = { action };
  for (const who of ACTORS) {
    if (!(who in expected)) continue;
    const res = await send(who);
    row[who] = res.status;
    assert.equal(res.status, expected[who], `${action} as ${who}: expected ${expected[who]}, got ${res.status} ${JSON.stringify(res.body)}`);
  }
  matrix.push(row);
}

before(async () => {
  mem = await MongoMemoryServer.create();
  await mongoose.connect(mem.getUri('civiclens-rbac'));
  await Issue.syncIndexes();
  await seed();
  U.owner = await User.findOne({ email: 'citizen@civiclens.in' });
  U.otherCitizen = await User.findOne({ email: 'rahul@civiclens.in' });
  U.roadsOfficer = await User.findOne({ email: 'roads@civiclens.in' });
  U.waterOfficer = await User.findOne({ email: 'water@civiclens.in' });
  U.admin = await User.findOne({ email: 'admin@civiclens.in' });
  U.deactivated = await User.create({ name: 'Blocked User', email: 'blocked@civiclens.in', password: 'password123', active: false });
  for (const k of Object.keys(U)) T[k] = signToken(U[k]);
});

after(async () => {
  console.log('\nRBAC MATRIX (HTTP status per actor)');
  console.table(matrix);
  await mongoose.disconnect();
  await mem.stop();
});

describe('RBAC: reading', () => {
  it('R01 anyone can browse public issues', () =>
    expectMatrix('GET /issues (public list)', Object.fromEntries(ACTORS.map((a) => [a, 200])), (w) => api.get('/api/issues').set(hdr(w))));

  it('R02 "my reports" needs login', () =>
    expectMatrix('GET /issues?mine=true', { anonymous: 401, owner: 200, otherCitizen: 200, roadsOfficer: 200, admin: 200, deactivated: 401 },
      (w) => api.get('/api/issues?mine=true').set(hdr(w))));

  it('R03 department queue is for authorities only', () =>
    expectMatrix('GET /issues?scope=department', { anonymous: 403, owner: 403, roadsOfficer: 200, waterOfficer: 200, admin: 403 },
      (w) => api.get('/api/issues?scope=department').set(hdr(w))));

  it('R04 department queue only contains that department', async () => {
    const r = await api.get('/api/issues?scope=department&limit=50').set(hdr('waterOfficer'));
    assert.ok(r.body.items.length > 0);
    assert.ok(r.body.items.every((i) => i.category === 'water' || String(i.assignedTo?._id) === String(U.waterOfficer._id)));
  });

  it('R05 the "Take action" panel is only offered to people who can act', async () => {
    const id = await makeIssue();
    const flags = {};
    for (const w of ['anonymous', 'owner', 'otherCitizen', 'roadsOfficer', 'waterOfficer', 'admin']) {
      flags[w] = (await api.get(`/api/issues/${id}`).set(hdr(w))).body.canManage;
    }
    assert.deepEqual(flags, { anonymous: false, owner: false, otherCitizen: false, roadsOfficer: true, waterOfficer: false, admin: true });
  });

  it('R06 admin sees every status option; officers only the next workflow steps', async () => {
    const id = await makeIssue();
    assert.deepEqual((await api.get(`/api/issues/${id}`).set(hdr('roadsOfficer'))).body.allowedStatuses, ['acknowledged', 'rejected']);
    assert.equal((await api.get(`/api/issues/${id}`).set(hdr('admin'))).body.allowedStatuses.length, 4);
  });

  it('R07 user list is admin-only', () =>
    expectMatrix('GET /users', { anonymous: 401, owner: 403, roadsOfficer: 403, waterOfficer: 403, admin: 200, deactivated: 401 },
      (w) => api.get('/api/users').set(hdr(w))));

  it('R08 each user only ever sees their own notifications', async () => {
    for (const w of ['owner', 'otherCitizen', 'roadsOfficer', 'admin']) {
      const r = await api.get('/api/notifications').set(hdr(w));
      assert.equal(r.status, 200);
      assert.ok(r.body.items.every((n) => String(n.user) === String(U[w]._id)), `${w} saw someone else's notification`);
    }
    assert.equal((await api.get('/api/notifications')).status, 401);
  });

  it('R09 /auth/me returns the correct role for each account', async () => {
    const roles = {};
    for (const w of ['owner', 'roadsOfficer', 'admin']) roles[w] = (await api.get('/api/auth/me').set(hdr(w))).body.user.role;
    assert.deepEqual(roles, { owner: 'citizen', roadsOfficer: 'authority', admin: 'admin' });
    assert.equal((await api.get('/api/auth/me').set(hdr('deactivated'))).status, 401);
  });

  it('R10 authority statistics are limited to their department', async () => {
    const r = await api.get('/api/stats').set(hdr('roadsOfficer'));
    assert.deepEqual(r.body.byCategory.map((c) => c.category), ['roads']);
    const pub = await api.get('/api/stats');
    assert.ok(pub.body.byCategory.length > 1);
  });
});

describe('RBAC: writing', () => {
  it('W01 only citizens can report issues', () =>
    expectMatrix('POST /issues (report)', { anonymous: 401, owner: 201, otherCitizen: 201, roadsOfficer: 403, waterOfficer: 403, admin: 403, deactivated: 401 },
      (w) => api.post('/api/issues').set(hdr(w)).send({
        title: 'Role test report', description: 'Checking who is allowed to report.', category: 'roads',
        location: { address: 'Somewhere', lat: 12.9, lng: 80.1 },
      })));

  it('W02 only the right department officer or admin can change status', async () => {
    const ids = {};
    for (const w of ACTORS) ids[w] = await makeIssue();
    await expectMatrix('PATCH /issues/:id/status', { anonymous: 401, owner: 403, otherCitizen: 403, roadsOfficer: 200, waterOfficer: 403, admin: 200, deactivated: 401 },
      (w) => api.patch(`/api/issues/${ids[w]}/status`).set(hdr(w)).send({ status: 'acknowledged' }));
  });

  it('W03 an officer from another department CAN act once the admin assigns them', async () => {
    const id = await makeIssue();
    assert.equal((await api.patch(`/api/issues/${id}/status`).set(hdr('waterOfficer')).send({ status: 'acknowledged' })).status, 403);
    await api.patch(`/api/issues/${id}/assign`).set(hdr('admin')).send({ assignedTo: String(U.waterOfficer._id) });
    assert.equal((await api.patch(`/api/issues/${id}/status`).set(hdr('waterOfficer')).send({ status: 'acknowledged' })).status, 200);
  });

  it('W04 only admins can assign officers and set priority', async () => {
    const id = await makeIssue();
    await expectMatrix('PATCH /issues/:id/assign', { anonymous: 401, owner: 403, otherCitizen: 403, roadsOfficer: 403, waterOfficer: 403, admin: 200, deactivated: 401 },
      (w) => api.patch(`/api/issues/${id}/assign`).set(hdr(w)).send({ priority: 'high' }));
  });

  it('W05 any logged-in user can upvote', async () => {
    const id = await makeIssue();
    await expectMatrix('POST /issues/:id/upvote', { anonymous: 401, owner: 200, otherCitizen: 200, roadsOfficer: 200, waterOfficer: 200, admin: 200, deactivated: 401 },
      (w) => api.post(`/api/issues/${id}/upvote`).set(hdr(w)));
  });

  it('W06 any logged-in user can comment', async () => {
    const id = await makeIssue();
    await expectMatrix('POST /issues/:id/comments', { anonymous: 401, owner: 201, otherCitizen: 201, roadsOfficer: 201, waterOfficer: 201, admin: 201, deactivated: 401 },
      (w) => api.post(`/api/issues/${id}/comments`).set(hdr(w)).send({ text: 'Role test comment' }));
  });

  it('W07 delete while "Reported": only the owner or admin', async () => {
    const ids = {};
    for (const w of ACTORS) ids[w] = await makeIssue('reported');
    await expectMatrix('DELETE /issues/:id (Reported)', { anonymous: 401, owner: 200, otherCitizen: 403, roadsOfficer: 403, waterOfficer: 403, admin: 200, deactivated: 401 },
      (w) => api.delete(`/api/issues/${ids[w]}`).set(hdr(w)));
  });

  it('W08 delete after acknowledgement: admin only (owner is locked out)', async () => {
    const ids = {};
    for (const w of ACTORS) ids[w] = await makeIssue('acknowledged');
    await expectMatrix('DELETE /issues/:id (Acknowledged)', { anonymous: 401, owner: 403, otherCitizen: 403, roadsOfficer: 403, waterOfficer: 403, admin: 200, deactivated: 401 },
      (w) => api.delete(`/api/issues/${ids[w]}`).set(hdr(w)));
  });

  it('W09 only admins can create officer accounts', () =>
    expectMatrix('POST /users (create officer)', { anonymous: 401, owner: 403, roadsOfficer: 403, waterOfficer: 403, admin: 201, deactivated: 401 },
      (w) => api.post('/api/users').set(hdr(w)).send({ name: `Officer ${w}`, email: `officer-${w}@x.com`, password: 'secret12', department: 'water' })));

  it('W10 only admins can activate / deactivate users', () =>
    expectMatrix('PATCH /users/:id', { anonymous: 401, owner: 403, roadsOfficer: 403, waterOfficer: 403, admin: 200, deactivated: 401 },
      (w) => api.patch(`/api/users/${U.otherCitizen._id}`).set(hdr(w)).send({ active: true })));
});

describe('RBAC: privilege-escalation attempts', () => {
  it('E01 public sign-up cannot create an authority or admin', async () => {
    for (const role of ['authority', 'admin']) {
      const r = await api.post('/api/auth/register').send({ name: 'Climber', email: `climb-${role}@x.com`, password: 'secret12', role, department: 'roads' });
      assert.equal(r.status, 201);
      assert.equal(r.body.user.role, 'citizen');
      assert.equal(r.body.user.department, null);
    }
  });

  it('E02 a token with a faked "admin" role is ignored; the database role is used', async () => {
    const fake = jwt.sign({ id: U.owner._id, role: 'admin' }, process.env.JWT_SECRET);
    assert.equal((await api.get('/api/users').set('Authorization', `Bearer ${fake}`)).status, 403);
  });

  it('E03 a token signed with the wrong secret is rejected', async () => {
    const forged = jwt.sign({ id: U.admin._id, role: 'admin' }, 'not-the-secret');
    assert.equal((await api.get('/api/users').set('Authorization', `Bearer ${forged}`)).status, 401);
  });

  it('E04 an expired token is rejected', async () => {
    const old = jwt.sign({ id: U.admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: -10 });
    assert.equal((await api.get('/api/users').set('Authorization', `Bearer ${old}`)).status, 401);
  });

  it('E05 a user cannot give themselves a role through the user-update API', async () => {
    const r = await api.patch(`/api/users/${U.owner._id}`).set(hdr('owner')).send({ role: 'admin' });
    assert.equal(r.status, 403);
    assert.equal((await User.findById(U.owner._id)).role, 'citizen');
  });

  it('E06 admins cannot change anyone’s role through the update API either (not an allowed field)', async () => {
    await api.patch(`/api/users/${U.owner._id}`).set(hdr('admin')).send({ role: 'admin', active: true });
    assert.equal((await User.findById(U.owner._id)).role, 'citizen');
  });

  it('E07 deactivating a user takes effect immediately, even with a valid token', async () => {
    const t = signToken(U.otherCitizen);
    assert.equal((await api.get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status, 200);
    await api.patch(`/api/users/${U.otherCitizen._id}`).set(hdr('admin')).send({ active: false });
    assert.equal((await api.get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status, 401);
    assert.equal((await api.post('/api/issues').set('Authorization', `Bearer ${t}`).send({})).status, 401);
    await api.patch(`/api/users/${U.otherCitizen._id}`).set(hdr('admin')).send({ active: true });
  });

  it('E08 officers cannot bypass the workflow even on their own department', async () => {
    const id = await makeIssue('reported');
    const r = await api.patch(`/api/issues/${id}/status`).set(hdr('roadsOfficer')).send({ status: 'resolved', note: 'skip' });
    assert.equal(r.status, 400);
  });
});
