// Roles are checked by the server, not only hidden on screen.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { AUDIT_ACTIONS } from '../src/constants/auditActions.js';
import { COURSE_PATTERNS } from '../src/constants/coursePatterns.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, loginAs } from './helpers/fixtures.js';

const app = createApp();
let world;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
});
afterAll(stopDb);

const newCourse = () => ({
  affiliationId: String(world.affiliations.SSISM._id),
  name: 'Bachelor of Commerce',
  shortCode: 'B.Com',
  pattern: COURSE_PATTERNS.YEAR,
  duration: 3,
});
const ssism = () => String(world.institutes.ssism._id);

test('a TC_CLERK can read courses but cannot create one', async () => {
  const token = await loginAs(app, world.users.ssismTcClerk);
  const headers = { Authorization: `Bearer ${token}`, 'X-Institute-Id': ssism() };

  expect((await request(app).get('/api/v1/courses').set(headers)).status).toBe(200);

  const res = await request(app).post('/api/v1/courses').set(headers).send(newCourse());
  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe('FORBIDDEN');
  expect(await Course.countDocuments({ tenantId: world.tenantId, shortCode: 'B.Com' })).toBe(0);
});

test('a PRINCIPAL can create a course, and the create is audited', async () => {
  const token = await loginAs(app, world.users.ssismPrincipal);
  const res = await request(app)
    .post('/api/v1/courses')
    .set({ Authorization: `Bearer ${token}`, 'X-Institute-Id': ssism() })
    .send(newCourse());

  expect(res.status).toBe(201);
  expect(res.body.data).toMatchObject({
    shortCode: 'B.Com',
    examTerms: ['Year I', 'Year II', 'Year III'],
  });
  // The course belongs to the selected institute, whatever the body says
  expect(res.body.data.instituteId).toBe(ssism());

  const entry = await AuditLog.findOne({ tenantId: world.tenantId, entityId: res.body.data._id });
  expect(entry.action).toBe(AUDIT_ACTIONS.CREATE);
});

test('a duplicate short code + branch is a 409 with the field named', async () => {
  const token = await loginAs(app, world.users.ssismPrincipal);
  const res = await request(app)
    .post('/api/v1/courses')
    .set({ Authorization: `Bearer ${token}`, 'X-Institute-Id': ssism() })
    .send(newCourse());

  expect(res.status).toBe(409);
  expect(res.body.error.details.map((d) => d.field)).toEqual(['shortCode', 'branch']);
});

test('invalid input is a 400 with one detail per field', async () => {
  const token = await loginAs(app, world.users.ssismPrincipal);
  const res = await request(app)
    .post('/api/v1/courses')
    .set({ Authorization: `Bearer ${token}`, 'X-Institute-Id': ssism() })
    .send({ name: 'X', pattern: 'weekly' });

  expect(res.status).toBe(400);
  const fields = res.body.error.details.map((d) => d.field);
  expect(fields).toEqual(
    expect.arrayContaining(['affiliationId', 'name', 'shortCode', 'pattern', 'duration']),
  );
});

test('the course form options list only this institute affiliations, with university names', async () => {
  const token = await loginAs(app, world.users.ssismPrincipal);
  const res = await request(app)
    .get('/api/v1/courses/options')
    .set({ Authorization: `Bearer ${token}`, 'X-Institute-Id': ssism() });

  expect(res.status).toBe(200);
  expect(res.body.data.affiliations).toEqual([
    { value: String(world.affiliations.SSISM._id), label: 'Vikram University (2010 onwards)' },
  ]);
});
