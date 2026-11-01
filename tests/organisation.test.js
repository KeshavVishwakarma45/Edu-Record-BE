// ADR-016: the Super Admin combines separate institutes into a unit that shares roles and staff,
// and can separate them again. Records always stay with their own institute.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Institute } from '../src/modules/institutes/institute.model.js';
import { Role } from '../src/modules/roles/role.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Unit } from '../src/modules/organisation/unit.model.js';
import { University } from '../src/modules/institutes/university.model.js';
import { Department } from '../src/modules/institutes/department.model.js';
import { Affiliation } from '../src/modules/institutes/affiliation.model.js';
import { OWNER_TYPES } from '../src/constants/ownerTypes.js';
import { ROLE_TEMPLATES } from '../src/constants/roleTemplates.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();
let world;
let superAdmin; // headers of the Super Admin, working in SSISM

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  superAdmin = await headersFor(app, world.users.superAdmin, world.institutes.ssism);
});
afterAll(stopDb);

const combineBody = () => ({
  name: 'Sant Singaji Education Society',
  instituteIds: [String(world.institutes.ssism._id), String(world.institutes.ssec._id)],
  keepRolesFrom: String(world.institutes.ssism._id),
});

test('only the Super Admin can see or change the organisation', async () => {
  const admin = await headersFor(app, world.users.admin, world.institutes.ssism);
  expect((await request(app).get('/api/v1/organisation').set(admin)).status).toBe(403);
  expect(
    (await request(app).post('/api/v1/organisation/units').set(admin).send(combineBody())).status,
  ).toBe(403);

  const res = await request(app).get('/api/v1/organisation').set(superAdmin);
  expect(res.status).toBe(200);
  expect(res.body.data.units).toEqual([]);
  expect(res.body.data.institutes.map((i) => i.roleCount)).toEqual([
    ROLE_TEMPLATES.length,
    ROLE_TEMPLATES.length,
  ]);
});

test('while separate, an SSISM-only user cannot open SSEC', async () => {
  const headers = await headersFor(app, world.users.ssismPrincipal, world.institutes.ssec);
  expect((await request(app).get('/api/v1/courses').set(headers)).status).toBe(403);
});

test('the preview shows the kept roles and what happens to each user, and changes nothing', async () => {
  const res = await request(app)
    .post('/api/v1/organisation/units/preview')
    .set(superAdmin)
    .send(combineBody());
  expect(res.status).toBe(200);
  expect(res.body.data.keptRoles).toEqual(expect.arrayContaining(['Admin', 'Principal']));
  const clerk = res.body.data.assignments.find((a) => a.email === world.users.ssismTcClerk.email);
  expect(clerk).toMatchObject({
    from: [{ institute: 'SSISM', roleName: 'TC Clerk' }],
    toRoleName: 'TC Clerk',
  });
  expect(await Unit.countDocuments({ tenantId: world.tenantId })).toBe(0);
});

test('combining: one shared role list, one role per user that works in both institutes', async () => {
  const res = await request(app)
    .post('/api/v1/organisation/units')
    .set(superAdmin)
    .send(combineBody());
  expect(res.status).toBe(201);
  const unitId = res.body.data._id;

  // Roles: SSISM's moved to the unit, SSEC's removed
  const ownerRoles = (ownerType, ownerId) =>
    Role.countDocuments({ tenantId: world.tenantId, ownerType, ownerId });
  expect(await ownerRoles(OWNER_TYPES.UNIT, unitId)).toBe(ROLE_TEMPLATES.length);
  expect(await ownerRoles(OWNER_TYPES.INSTITUTE, world.institutes.ssec._id)).toBe(0);

  // The admin had Admin in both institutes: now one unit access
  const admin = await User.findOne({ tenantId: world.tenantId, _id: world.users.admin._id });
  expect(admin.access).toHaveLength(1);
  expect(admin.access[0].ownerType).toBe(OWNER_TYPES.UNIT);

  // The SSISM principal can now open SSEC with the same role...
  const inSsec = await headersFor(app, world.users.ssismPrincipal, world.institutes.ssec);
  const list = await request(app).get('/api/v1/courses').set(inSsec);
  expect(list.status).toBe(200);
  // ...but sees only SSEC's records there, and SSISM's course is still "not found"
  expect(list.body.data.map((c) => c._id)).toEqual([String(world.courses.SSEC._id)]);
  const ssismCourse = await request(app)
    .get(`/api/v1/courses/${world.courses.SSISM._id}`)
    .set(inSsec);
  expect(ssismCourse.status).toBe(404);

  // /me shows the unit
  const me = await request(app).get('/api/v1/auth/me').set({ Authorization: inSsec.Authorization });
  expect(me.body.data.institutes.map((i) => i.unit?.name)).toEqual([
    'Sant Singaji Education Society',
    'Sant Singaji Education Society',
  ]);
});

test('an institute already in a unit cannot be combined again', async () => {
  const res = await request(app)
    .post('/api/v1/organisation/units')
    .set(superAdmin)
    .send({ ...combineBody(), name: 'Second unit' });
  expect(res.status).toBe(409);
});

test('separating: each institute gets its own copy of the roles and every user keeps access', async () => {
  const unit = await Unit.findOne({ tenantId: world.tenantId });
  const res = await request(app)
    .post(`/api/v1/organisation/units/${unit._id}/separate`)
    .set(superAdmin);
  expect(res.status).toBe(200);

  expect(await Unit.countDocuments({ tenantId: world.tenantId })).toBe(0);
  const institutes = await Institute.find({ tenantId: world.tenantId }).lean();
  expect(institutes.every((i) => i.unitId === null)).toBe(true);
  for (const institute of institutes) {
    const count = await Role.countDocuments({
      tenantId: world.tenantId,
      ownerType: OWNER_TYPES.INSTITUTE,
      ownerId: institute._id,
    });
    expect(count).toBe(ROLE_TEMPLATES.length);
  }
  // A unit user now has one access per institute, with the same role name
  const clerk = await User.findOne({ tenantId: world.tenantId, _id: world.users.ssismTcClerk._id });
  expect(clerk.access).toHaveLength(2);
  const headers = await headersFor(app, world.users.ssismTcClerk, world.institutes.ssec);
  const me = await request(app)
    .get('/api/v1/auth/me')
    .set({ Authorization: headers.Authorization });
  expect(me.body.data.institutes.map((i) => i.roleName)).toEqual(['TC Clerk', 'TC Clerk']);
});

test('combining from the default roles gives users with matching role names those roles', async () => {
  const res = await request(app)
    .post('/api/v1/organisation/units')
    .set(superAdmin)
    .send({ ...combineBody(), keepRolesFrom: 'template' });
  expect(res.status).toBe(201);
  const roles = await Role.find({ tenantId: world.tenantId, ownerId: res.body.data._id }).lean();
  expect(roles.map((r) => r.name).sort()).toEqual(ROLE_TEMPLATES.map((t) => t.name).sort());
});

describe('adding and editing institutes, and moving one institute in or out of a unit', () => {
  let ssnc; // a new institute made by the Super Admin
  let unitId; // the unit made by the previous test (SSISM + SSEC)

  const nursing = async () => ({
    name: 'Sant Singaji Nursing College',
    shortCode: 'ssnc',
    address: 'Sandalpur',
    universityId: String((await University.findOne({ shortCode: 'VIKRAM' }))._id),
    affiliatedFrom: 2024,
  });

  beforeAll(async () => {
    unitId = (await Unit.findOne({ tenantId: world.tenantId }))._id;
  });

  test('only the Super Admin can add an institute', async () => {
    const admin = await headersFor(app, world.users.admin, world.institutes.ssism);
    const res = await request(app)
      .post('/api/v1/organisation/institutes')
      .set(admin)
      .send(await nursing());
    expect(res.status).toBe(403);
  });

  test('a new separate institute gets its own roles, departments and affiliation', async () => {
    const res = await request(app)
      .post('/api/v1/organisation/institutes')
      .set(superAdmin)
      .send(await nursing());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ shortCode: 'SSNC', unitId: null });
    ssnc = res.body.data;

    const scope = { tenantId: world.tenantId, instituteId: ssnc._id };
    expect(await Department.countDocuments(scope)).toBe(4);
    expect(await Affiliation.countDocuments(scope)).toBe(1);
    expect(
      await Role.countDocuments({
        tenantId: world.tenantId,
        ownerType: OWNER_TYPES.INSTITUTE,
        ownerId: ssnc._id,
      }),
    ).toBe(ROLE_TEMPLATES.length);

    // The Super Admin can open it straight away
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set({ Authorization: superAdmin.Authorization });
    expect(me.body.data.institutes.map((i) => i.shortCode)).toContain('SSNC');
  });

  test('the Super Admin picks which built-in roles a separate institute starts with', async () => {
    const res = await request(app)
      .post('/api/v1/organisation/institutes')
      .set(superAdmin)
      .send({
        name: 'Sant Singaji Pharmacy College',
        shortCode: 'SSPC',
        roleTemplates: ['Admin', 'TC Clerk'],
      });
    expect(res.status).toBe(201);
    const roles = await Role.find({ tenantId: world.tenantId, ownerId: res.body.data._id }).lean();
    expect(roles.map((r) => r.name).sort()).toEqual(['Admin', 'TC Clerk']);

    const unknown = await request(app)
      .post('/api/v1/organisation/institutes')
      .set(superAdmin)
      .send({ name: 'Bad', shortCode: 'BAD', roleTemplates: ['Owner'] });
    expect(unknown.status).toBe(400);
  });

  test('the short code must be unique', async () => {
    const res = await request(app)
      .post('/api/v1/organisation/institutes')
      .set(superAdmin)
      .send({ ...(await nursing()), name: 'Another' });
    expect(res.status).toBe(409);
  });

  test('editing an institute and renaming a unit', async () => {
    const edit = await request(app)
      .patch(`/api/v1/organisation/institutes/${ssnc._id}`)
      .set(superAdmin)
      .send({ principalName: 'Dr. A. Sharma', shortCode: 'XX' });
    expect(edit.status).toBe(200);
    expect(edit.body.data).toMatchObject({ principalName: 'Dr. A. Sharma', shortCode: 'SSNC' });

    const rename = await request(app)
      .patch(`/api/v1/organisation/units/${unitId}`)
      .set(superAdmin)
      .send({ name: 'Singaji Group' });
    expect(rename.status).toBe(200);
  });

  test('adding a separate institute to a unit: its staff get the unit role with the same name', async () => {
    // Someone who works only in SSNC, as TC Clerk
    const inSsnc = { ...superAdmin, 'X-Institute-Id': String(ssnc._id) };
    const ssncTcClerk = await Role.findOne({
      tenantId: world.tenantId,
      ownerId: ssnc._id,
      name: 'TC Clerk',
    });
    const invite = await request(app)
      .post('/api/v1/users/invite')
      .set(inSsnc)
      .send({ name: 'Nursing Clerk', email: 'clerk@ssnc.test', roleId: String(ssncTcClerk._id) });
    expect(invite.status).toBe(201);

    const preview = await request(app)
      .post(`/api/v1/organisation/units/${unitId}/join/preview`)
      .set(superAdmin)
      .send({ instituteId: ssnc._id });
    expect(preview.body.data.assignments).toEqual([
      expect.objectContaining({ email: 'clerk@ssnc.test', toRoleName: 'TC Clerk' }),
    ]);

    const join = await request(app)
      .post(`/api/v1/organisation/units/${unitId}/join`)
      .set(superAdmin)
      .send({ instituteId: ssnc._id });
    expect(join.status).toBe(200);

    const unit = await Unit.findOne({ tenantId: world.tenantId, _id: unitId });
    expect(unit.instituteIds.map(String)).toContain(String(ssnc._id));
    expect(await Role.countDocuments({ tenantId: world.tenantId, ownerId: ssnc._id })).toBe(0);
    const clerk = await User.findOne({ tenantId: world.tenantId, email: 'clerk@ssnc.test' });
    expect(clerk.access.map((a) => [a.ownerType, String(a.ownerId)])).toEqual([
      [OWNER_TYPES.UNIT, String(unitId)],
    ]);
  });

  test('taking one institute out of a 3-institute unit keeps the unit, and staff keep access', async () => {
    const res = await request(app)
      .post(`/api/v1/organisation/units/${unitId}/remove`)
      .set(superAdmin)
      .send({ instituteId: ssnc._id });
    expect(res.status).toBe(200);
    expect(res.body.data.dissolved).toBe(false);

    const unit = await Unit.findOne({ tenantId: world.tenantId, _id: unitId });
    expect(unit.instituteIds).toHaveLength(2);
    expect(await Role.countDocuments({ tenantId: world.tenantId, ownerId: ssnc._id })).toBe(
      ROLE_TEMPLATES.length,
    );
    // The admin (unit staff) can still open SSNC, now with SSNC's own copy of the role
    const admin = await headersFor(app, world.users.admin, { _id: ssnc._id });
    expect((await request(app).get('/api/v1/courses').set(admin)).status).toBe(200);
  });

  test('taking one institute out of a 2-institute unit separates the unit', async () => {
    const res = await request(app)
      .post(`/api/v1/organisation/units/${unitId}/remove`)
      .set(superAdmin)
      .send({ instituteId: world.institutes.ssec._id });
    expect(res.body.data.dissolved).toBe(true);
    expect(await Unit.countDocuments({ tenantId: world.tenantId })).toBe(0);
  });

  test('a new institute can be created straight into a unit and uses its roles', async () => {
    const combined = await request(app)
      .post('/api/v1/organisation/units')
      .set(superAdmin)
      .send({ ...combineBody(), keepRolesFrom: 'template' });
    const created = await request(app)
      .post('/api/v1/organisation/institutes')
      .set(superAdmin)
      .send({
        name: 'Sant Singaji Public School',
        shortCode: 'SSPS',
        unitId: combined.body.data._id,
      });
    expect(created.status).toBe(201);
    expect(
      await Role.countDocuments({ tenantId: world.tenantId, ownerId: created.body.data._id }),
    ).toBe(0);
    const unit = await Unit.findOne({ tenantId: world.tenantId, _id: combined.body.data._id });
    expect(unit.instituteIds).toHaveLength(3);
  });
});
