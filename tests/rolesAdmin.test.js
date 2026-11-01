// Admins create and change the roles of their own institute (or unit) from permissions.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PERMISSIONS } from '../src/constants/permissions.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();
let world;
let ssismAdmin;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  ssismAdmin = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);
});
afterAll(stopDb);

test('the role list shows this institute’s roles and how many users hold each', async () => {
  const res = await request(app).get('/api/v1/roles?sort=name').set(ssismAdmin);
  expect(res.status).toBe(200);
  const clerk = res.body.data.find((r) => r.name === 'TC Clerk');
  expect(clerk.userCount).toBe(1);
  expect(res.body.data.every((r) => String(r.ownerId) === String(world.institutes.ssism._id))).toBe(
    true,
  );
});

test('the built-in roles are offered as a starting point', async () => {
  const res = await request(app).get('/api/v1/roles/templates').set(ssismAdmin);
  expect(res.status).toBe(200);
  expect(res.body.data.map((t) => t.name)).toContain('TC Clerk');
  expect(res.body.data.every((t) => Array.isArray(t.permissions))).toBe(true);
});

test('create, rename and delete a role', async () => {
  const created = await request(app)
    .post('/api/v1/roles')
    .set(ssismAdmin)
    .send({
      name: 'Librarian',
      permissions: [PERMISSIONS.CLEARANCE_VIEW, PERMISSIONS.CLEARANCE_ACT],
    });
  expect(created.status).toBe(201);

  const id = created.body.data._id;
  expect(
    (await request(app).patch(`/api/v1/roles/${id}`).set(ssismAdmin).send({ name: 'Library' }))
      .status,
  ).toBe(200);
  expect((await request(app).delete(`/api/v1/roles/${id}`).set(ssismAdmin)).status).toBe(200);
});

test('a role with users cannot be deleted', async () => {
  const res = await request(app)
    .delete(`/api/v1/roles/${world.roles.SSISM['TC Clerk']._id}`)
    .set(ssismAdmin);
  expect(res.status).toBe(409);
});

test('another institute’s role is not found', async () => {
  const res = await request(app)
    .patch(`/api/v1/roles/${world.roles.SSEC.Principal._id}`)
    .set(ssismAdmin)
    .send({ name: 'Hacked' });
  expect(res.status).toBe(404);
});

test('an admin cannot remove user and role management from their own role', async () => {
  const res = await request(app)
    .patch(`/api/v1/roles/${world.roles.SSISM.Admin._id}`)
    .set(ssismAdmin)
    .send({ permissions: [PERMISSIONS.COURSE_READ] });
  expect(res.status).toBe(400);
});

test('an unknown permission is rejected', async () => {
  const res = await request(app)
    .post('/api/v1/roles')
    .set(ssismAdmin)
    .send({ name: 'Bad', permissions: ['launch.rockets'] });
  expect(res.status).toBe(400);
});

test('a role without role management cannot open roles', async () => {
  const principal = await headersFor(app, world.users.ssismPrincipal, world.institutes.ssism);
  expect((await request(app).get('/api/v1/roles').set(principal)).status).toBe(403);
});
