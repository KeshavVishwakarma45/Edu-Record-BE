// Admins manage the staff of their institute (or unit): invite by link, change role, remove
// access. Only the Super Admin can disable accounts or change other admins' limits.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Role } from '../src/modules/roles/role.model.js';
import { OWNER_TYPES } from '../src/constants/ownerTypes.js';
import { PERMISSIONS } from '../src/constants/permissions.js';
import { USER_STATUSES } from '../src/constants/statuses.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor, PASSWORD } from './helpers/fixtures.js';

const app = createApp();
let world;
let ssismAdmin;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  ssismAdmin = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);
});
afterAll(stopDb);

const tokenOf = (link) => link.split('/set-password/')[1];
const login = (email, password) =>
  request(app).post('/api/v1/auth/login').send({ email, password });

describe('invite by link', () => {
  let link;

  test('an admin invites a new person with a role and gets a one-time link', async () => {
    const res = await request(app)
      .post('/api/v1/users/invite')
      .set(ssismAdmin)
      .send({
        name: 'Neha Clerk',
        email: 'Neha@SSISM.test',
        roleId: String(world.roles.SSISM['Exam Clerk']._id),
      });
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'neha@ssism.test',
      status: USER_STATUSES.INVITED,
    });
    expect(res.body.data.inviteLink).toMatch(/\/set-password\/[0-9a-f]{64}$/);
    link = res.body.data.inviteLink;
  });

  test('the invited person cannot log in before setting a password', async () => {
    expect((await login('neha@ssism.test', 'anything1')).status).toBe(401);
  });

  test('the link shows who it is for, then sets the password and logs the person in', async () => {
    const check = await request(app).get(`/api/v1/auth/setup/${tokenOf(link)}`);
    expect(check.body.data).toMatchObject({ email: 'neha@ssism.test', isNewUser: true });

    const tooShort = await request(app)
      .post(`/api/v1/auth/setup/${tokenOf(link)}`)
      .send({ password: 'short' });
    expect(tooShort.status).toBe(400);

    const res = await request(app)
      .post(`/api/v1/auth/setup/${tokenOf(link)}`)
      .send({ password: 'Neha@2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.institutes.map((i) => i.roleName)).toEqual(['Exam Clerk']);
    expect((await login('neha@ssism.test', 'Neha@2026')).status).toBe(200);
  });

  test('a link works only once', async () => {
    const again = await request(app)
      .post(`/api/v1/auth/setup/${tokenOf(link)}`)
      .send({ password: 'Another@1' });
    expect(again.status).toBe(404);
  });

  test('an expired link does not work', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${world.users.ssismTcClerk._id}/setup-link`)
      .set(ssismAdmin);
    expect(res.status).toBe(200);
    await User.updateOne(
      { tenantId: world.tenantId, _id: world.users.ssismTcClerk._id },
      { setupTokenExpiresAt: new Date(Date.now() - 1000) },
    );
    expect(
      (await request(app).get(`/api/v1/auth/setup/${tokenOf(res.body.data.link)}`)).status,
    ).toBe(404);
  });
});

test('the user list shows only this institute’s staff, with their role here', async () => {
  const res = await request(app).get('/api/v1/users?sort=email').set(ssismAdmin);
  expect(res.status).toBe(200);
  const emails = res.body.data.map((u) => u.email);
  expect(emails).toContain('tcclerk@ssism.test');
  expect(emails).not.toContain('superadmin@singaji.test');
  expect(res.body.data.find((u) => u.email === 'tcclerk@ssism.test').roleName).toBe('TC Clerk');

  // An SSISM-only admin cannot open SSEC's user list at all
  const inSsec = await headersFor(app, world.users.ssismAdmin, world.institutes.ssec);
  expect((await request(app).get('/api/v1/users').set(inSsec)).status).toBe(403);
});

test('a role without user management cannot open the user list', async () => {
  const clerk = await headersFor(app, world.users.ssismTcClerk, world.institutes.ssism);
  expect((await request(app).get('/api/v1/users').set(clerk)).status).toBe(403);
});

test('changing a role, and the limits on it', async () => {
  const principalRole = String(world.roles.SSISM.Principal._id);
  const clerkId = world.users.ssismTcClerk._id;

  const res = await request(app)
    .patch(`/api/v1/users/${clerkId}/access`)
    .set(ssismAdmin)
    .send({ roleId: principalRole });
  expect(res.status).toBe(200);

  // Cannot change your own access (so nobody locks themselves out)
  const self = await request(app)
    .patch(`/api/v1/users/${world.users.ssismAdmin._id}/access`)
    .set(ssismAdmin)
    .send({ roleId: principalRole });
  expect(self.status).toBe(400);

  // A role of another institute cannot be given here
  const foreign = await request(app)
    .patch(`/api/v1/users/${clerkId}/access`)
    .set(ssismAdmin)
    .send({ roleId: String(world.roles.SSEC.Principal._id) });
  expect(foreign.status).toBe(400);

  // An admin cannot touch the Super Admin
  const superAdmin = await request(app)
    .patch(`/api/v1/users/${world.users.superAdmin._id}/access`)
    .set(ssismAdmin)
    .send({ roleId: principalRole });
  expect(superAdmin.status).toBe(403);
});

test('an admin cannot give a role with permissions they do not have', async () => {
  // "Office Manager" may manage users and read courses, but not approve TCs
  const manager = await Role.create({
    tenantId: world.tenantId,
    ownerType: OWNER_TYPES.INSTITUTE,
    ownerId: world.institutes.ssism._id,
    name: 'Office Manager',
    permissions: [PERMISSIONS.USERS_MANAGE, PERMISSIONS.COURSE_READ],
  });
  world.users.ssismPrincipal.access[0].roleId = manager._id;
  await User.updateOne(
    { tenantId: world.tenantId, _id: world.users.ssismPrincipal._id },
    { $set: { 'access.0.roleId': manager._id } },
  );
  const headers = await headersFor(app, world.users.ssismPrincipal, world.institutes.ssism);
  const res = await request(app)
    .post('/api/v1/users/invite')
    .set(headers)
    .send({
      name: 'New Principal',
      email: 'np@ssism.test',
      roleId: String(world.roles.SSISM.Principal._id),
    });
  expect(res.status).toBe(403);
  expect(res.body.error.message).toMatch(/tc.approve/);
});

test('only the Super Admin can disable an account, and a disabled user cannot log in', async () => {
  const target = world.users.admin;
  expect(
    (await request(app).post(`/api/v1/users/${target._id}/disable`).set(ssismAdmin)).status,
  ).toBe(403);

  const superAdmin = await headersFor(app, world.users.superAdmin, world.institutes.ssism);
  expect(
    (await request(app).post(`/api/v1/users/${target._id}/disable`).set(superAdmin)).status,
  ).toBe(200);
  expect((await login(target.email, PASSWORD)).status).toBe(401);

  expect(
    (await request(app).post(`/api/v1/users/${target._id}/enable`).set(superAdmin)).status,
  ).toBe(200);
  expect((await login(target.email, PASSWORD)).status).toBe(200);
});

test('inviting someone who already has access here is a 409', async () => {
  const res = await request(app)
    .post('/api/v1/users/invite')
    .set(ssismAdmin)
    .send({
      name: 'Again',
      email: 'tcclerk@ssism.test',
      roleId: String(world.roles.SSISM['TC Clerk']._id),
    });
  expect(res.status).toBe(409);
});
