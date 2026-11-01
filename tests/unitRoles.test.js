// Institutes combined in a unit share one role list, but each institute can use only some of
// those roles (role.instituteIds). Staff can open only the institutes where their role is used.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Role } from '../src/modules/roles/role.model.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor, loginAs } from './helpers/fixtures.js';

const app = createApp();
let world;
let superAdmin;
let unitId;
let unitRoles; // name -> role

const ids = (...names) => names.map((n) => String(unitRoles[n]._id));
const roleById = (id) => Role.findOne({ tenantId: world.tenantId, _id: id }).lean();
const editSsism = (roleIds) =>
  request(app)
    .patch(`/api/v1/organisation/institutes/${world.institutes.ssism._id}`)
    .set(superAdmin)
    .send({ roleIds });

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  superAdmin = await headersFor(app, world.users.superAdmin, world.institutes.ssism);
  const combined = await request(app)
    .post('/api/v1/organisation/units')
    .set(superAdmin)
    .send({
      name: 'Society',
      instituteIds: [String(world.institutes.ssism._id), String(world.institutes.ssec._id)],
      keepRolesFrom: String(world.institutes.ssism._id),
    });
  expect(combined.status).toBe(201);
  unitId = combined.body.data._id;
  const roles = await Role.find({ tenantId: world.tenantId, ownerId: unitId }).lean();
  unitRoles = Object.fromEntries(roles.map((r) => [r.name, r]));
});
afterAll(stopDb);

test('SSISM keeps only some unit roles; TC Clerk staff can then open SSEC only', async () => {
  const res = await editSsism(ids('Admin', 'Principal'));
  expect(res.status).toBe(200);

  const tcClerk = (await roleById(unitRoles['TC Clerk']._id)).instituteIds.map(String);
  expect(tcClerk).toEqual([String(world.institutes.ssec._id)]);
  expect((await roleById(unitRoles.Admin._id)).instituteIds).toEqual([]);

  const token = await loginAs(app, world.users.ssismTcClerk);
  const auth = { Authorization: `Bearer ${token}` };
  const me = await request(app).get('/api/v1/auth/me').set(auth);
  expect(me.body.data.institutes.map((i) => i.shortCode)).toEqual(['SSEC']);
  const ssism = await request(app)
    .get('/api/v1/courses')
    .set({ ...auth, 'X-Institute-Id': String(world.institutes.ssism._id) });
  expect(ssism.status).toBe(403);
  const ssec = await request(app)
    .get('/api/v1/courses')
    .set({ ...auth, 'X-Institute-Id': String(world.institutes.ssec._id) });
  expect(ssec.status).toBe(200);
});

test('the overview shows the roles each member institute uses', async () => {
  const res = await request(app).get('/api/v1/organisation').set(superAdmin);
  const ssism = res.body.data.institutes.find((i) => i.shortCode === 'SSISM');
  expect(ssism.roleIds.sort()).toEqual(ids('Admin', 'Principal').sort());
  expect(res.body.data.units[0].roles.length).toBe(Object.keys(unitRoles).length);
});

test('a role cannot end up used in no institute', async () => {
  // Make Accounts SSISM-only, then try to untick it in SSISM
  await request(app)
    .patch(`/api/v1/roles/${unitRoles.Accounts._id}`)
    .set(superAdmin)
    .send({ instituteIds: [String(world.institutes.ssism._id)] });
  const res = await editSsism(ids('Admin', 'Principal'));
  expect(res.status).toBe(400);
  expect(res.body.error.message).toMatch(/Accounts/);
});

test('in "All institutes" the roles list can be narrowed to one institute and says where each is used', async () => {
  const all = {
    Authorization: superAdmin.Authorization,
    'X-Institute-Id': 'all',
  };
  // A role saved before instituteIds existed has no such field: it is used everywhere
  await Role.collection.updateOne({ _id: unitRoles.Admin._id }, { $unset: { instituteIds: 1 } });
  const res = await request(app)
    .get(`/api/v1/roles?limit=100&instituteId=${world.institutes.ssism._id}`)
    .set(all);
  expect(res.status).toBe(200);
  const names = res.body.data.map((r) => r.name);
  expect(names).toContain('Accounts');
  expect(names).toContain('Admin');
  expect(names).not.toContain('TC Clerk');

  const ssec = await request(app)
    .get(`/api/v1/roles?limit=100&instituteId=${world.institutes.ssec._id}`)
    .set(all);
  const clerk = ssec.body.data.find((r) => r.name === 'TC Clerk');
  expect(clerk.usedIn).toEqual(['SSEC']);
  expect(clerk.ownerName).toBe('Society');
});

test('separating copies to each institute only the roles it used', async () => {
  const res = await request(app)
    .post(`/api/v1/organisation/units/${unitId}/separate`)
    .set(superAdmin);
  expect(res.status).toBe(200);
  const ssismRoles = await Role.find({
    tenantId: world.tenantId,
    ownerId: world.institutes.ssism._id,
  }).lean();
  expect(ssismRoles.map((r) => r.name).sort()).toEqual(['Accounts', 'Admin', 'Principal']);
  const me = await request(app)
    .get('/api/v1/auth/me')
    .set({ Authorization: `Bearer ${await loginAs(app, world.users.ssismTcClerk)}` });
  expect(me.body.data.institutes.map((i) => i.shortCode)).toEqual(['SSEC']);
});
