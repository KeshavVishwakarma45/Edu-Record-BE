// The Super Admin's "All institutes" view: X-Institute-Id: all reads every institute at once.
// It is read only, and only the Super Admin may use it.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, loginAs } from './helpers/fixtures.js';

const app = createApp();
let world;
let superAll;

const allHeaders = async (user) => ({
  Authorization: `Bearer ${await loginAs(app, user)}`,
  'X-Institute-Id': 'all',
});

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  superAll = await allHeaders(world.users.superAdmin);
});
afterAll(stopDb);

test('the course list shows both institutes, and ?instituteId narrows it to one', async () => {
  const res = await request(app).get('/api/v1/courses?limit=100').set(superAll);
  expect(res.status).toBe(200);
  const institutes = new Set(res.body.data.map((c) => String(c.instituteId)));
  expect(institutes).toEqual(
    new Set([String(world.institutes.ssism._id), String(world.institutes.ssec._id)]),
  );

  const ssecOnly = await request(app)
    .get(`/api/v1/courses?instituteId=${world.institutes.ssec._id}`)
    .set(superAll);
  expect(ssecOnly.status).toBe(200);
  expect(ssecOnly.body.data.length).toBeGreaterThan(0);
  expect(
    ssecOnly.body.data.every((c) => String(c.instituteId) === String(world.institutes.ssec._id)),
  ).toBe(true);
});

test('one record of any institute opens in the view', async () => {
  const res = await request(app).get(`/api/v1/courses/${world.courses.SSEC._id}`).set(superAll);
  expect(res.status).toBe(200);
});

test('changes need one institute chosen', async () => {
  const res = await request(app)
    .patch(`/api/v1/courses/${world.courses.SSEC._id}`)
    .set(superAll)
    .send({ name: 'Changed' });
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('INSTITUTE_REQUIRED');
});

test('an admin cannot use the view', async () => {
  const res = await request(app)
    .get('/api/v1/courses')
    .set(await allHeaders(world.users.admin));
  expect(res.status).toBe(403);
});

test('roles and users of every institute are listed with their owner', async () => {
  const roles = await request(app).get('/api/v1/roles?limit=100').set(superAll);
  expect(roles.status).toBe(200);
  const owners = new Set(roles.body.data.map((r) => r.ownerName));
  expect(owners).toEqual(new Set(['SSISM', 'SSEC']));
  expect(roles.body.data.every((r) => r.ownerInstituteId)).toBe(true);

  const users = await request(app).get('/api/v1/users?limit=100').set(superAll);
  expect(users.status).toBe(200);
  // admin@singaji.test works in both institutes: one row for each
  const adminRows = users.body.data.filter((u) => u.email === world.users.admin.email);
  expect(adminRows.map((r) => r.ownerName).sort()).toEqual(['SSEC', 'SSISM']);
  expect(new Set(adminRows.map((r) => r._id)).size).toBe(2);
  expect(adminRows.every((r) => String(r.userId) === String(world.users.admin._id))).toBe(true);

  const options = await request(app).get('/api/v1/users/options').set(superAll);
  expect(options.status).toBe(400);
});
