// Asking for a record of another institute or tenant answers 404 (we never confirm it exists),
// but the attempt is written to the audit log as ACCESS_DENIED_RECORD. A missing id is not logged.
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';
import { Tenant } from '../src/modules/institutes/tenant.model.js';
import { Institute } from '../src/modules/institutes/institute.model.js';
import { Affiliation } from '../src/modules/institutes/affiliation.model.js';
import { Course } from '../src/modules/courses/course.model.js';
import { AUDIT_ACTIONS } from '../src/constants/auditActions.js';
import { COURSE_PATTERNS } from '../src/constants/coursePatterns.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, loginAs } from './helpers/fixtures.js';

const app = createApp();
let world;
let headers;
let otherTenantCourse;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  const token = await loginAs(app, world.users.ssismPrincipal); // SSISM only
  headers = {
    Authorization: `Bearer ${token}`,
    'X-Institute-Id': String(world.institutes.ssism._id),
  };

  // A course that belongs to a completely different tenant
  const tenant = await Tenant.create({ name: 'Other Society' });
  const institute = await Institute.create({
    tenantId: tenant._id,
    name: 'Other',
    shortCode: 'OTH',
  });
  const affiliation = await Affiliation.create({
    tenantId: tenant._id,
    instituteId: institute._id,
    universityId: new mongoose.Types.ObjectId(),
    fromYear: 2015,
  });
  otherTenantCourse = await Course.create({
    tenantId: tenant._id,
    instituteId: institute._id,
    affiliationId: affiliation._id,
    name: 'Other course',
    shortCode: 'BA',
    pattern: COURSE_PATTERNS.YEAR,
    duration: 3,
  });
});
afterAll(stopDb);

const deniedEntries = (entityId) =>
  AuditLog.find({
    tenantId: world.tenantId,
    action: AUDIT_ACTIONS.ACCESS_DENIED_RECORD,
    entityId,
  }).lean();

test('another institute’s course: 404 for read, update and delete, each one audited', async () => {
  const ssecCourseId = world.courses.SSEC._id;
  const url = `/api/v1/courses/${ssecCourseId}`;

  expect((await request(app).get(url).set(headers)).status).toBe(404);
  expect((await request(app).patch(url).set(headers).send({ name: 'Hacked' })).status).toBe(404);
  expect((await request(app).delete(url).set(headers)).status).toBe(404);

  const entries = await deniedEntries(ssecCourseId);
  expect(entries).toHaveLength(3);
  expect(entries[0]).toMatchObject({
    entity: 'course',
    userId: world.users.ssismPrincipal._id,
    instituteId: world.institutes.ssism._id, // the institute the user was working in
    after: expect.objectContaining({ requestedInstituteId: world.institutes.ssism._id }),
  });
  expect(entries.map((e) => e.after.method).sort()).toEqual(['DELETE', 'GET', 'PATCH']);

  // And nothing changed
  const course = await Course.findOne({ tenantId: world.tenantId, _id: ssecCourseId });
  expect(course.name).toBe('SSEC course');
});

test('another tenant’s course: 404, and audited in the user’s own tenant log', async () => {
  const res = await request(app).get(`/api/v1/courses/${otherTenantCourse._id}`).set(headers);
  expect(res.status).toBe(404);
  expect(await deniedEntries(otherTenantCourse._id)).toHaveLength(1);
});

test('the 404 looks exactly the same as for an id that does not exist', async () => {
  const missingId = new mongoose.Types.ObjectId();
  const missing = await request(app).get(`/api/v1/courses/${missingId}`).set(headers);
  const elsewhere = await request(app)
    .get(`/api/v1/courses/${world.courses.SSEC._id}`)
    .set(headers);

  expect(missing.status).toBe(404);
  expect(missing.body).toEqual(elsewhere.body);
  // A missing id is not suspicious, so it is not logged
  expect(await deniedEntries(missingId)).toHaveLength(0);
});
