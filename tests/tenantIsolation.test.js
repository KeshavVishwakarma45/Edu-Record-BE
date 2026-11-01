// SRS AC-10 / BR-01: a user of one institute can never read or change another institute's data,
// and every denied attempt is written to the audit log.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';
import { AUDIT_ACTIONS } from '../src/constants/auditActions.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, loginAs } from './helpers/fixtures.js';

const app = createApp();
let world;
let token;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  token = await loginAs(app, world.users.ssismPrincipal); // SSISM only
});
afterAll(stopDb);

describe('an SSISM-only user asking for SSEC (X-Institute-Id = SSEC)', () => {
  const ssecHeader = () => ({
    Authorization: `Bearer ${token}`,
    'X-Institute-Id': String(world.institutes.ssec._id),
  });
  const ssecCourse = () => `/api/v1/courses/${world.courses.SSEC._id}`;

  test('cannot list SSEC courses', async () => {
    const res = await request(app).get('/api/v1/courses').set(ssecHeader());
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
  });

  test('cannot read an SSEC course', async () => {
    const res = await request(app).get(ssecCourse()).set(ssecHeader());
    expect(res.status).toBe(403);
  });

  test('cannot update an SSEC course', async () => {
    const res = await request(app).patch(ssecCourse()).set(ssecHeader()).send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  test('cannot delete an SSEC course', async () => {
    const res = await request(app).delete(ssecCourse()).set(ssecHeader());
    expect(res.status).toBe(403);
  });

  test('every denied attempt is in the audit log', async () => {
    const entries = await AuditLog.find({
      tenantId: world.tenantId,
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      userId: world.users.ssismPrincipal._id,
    });
    expect(entries).toHaveLength(4);
  });
});

describe('an SSISM-only user using the SSISM header but an SSEC course id', () => {
  const ssismHeader = () => ({
    Authorization: `Bearer ${token}`,
    'X-Institute-Id': String(world.institutes.ssism._id),
  });

  test('gets 404 for read, update and delete, and the SSEC course is unchanged', async () => {
    const url = `/api/v1/courses/${world.courses.SSEC._id}`;
    expect((await request(app).get(url).set(ssismHeader())).status).toBe(404);
    expect((await request(app).patch(url).set(ssismHeader()).send({ name: 'Hacked' })).status).toBe(
      404,
    );
    expect((await request(app).delete(url).set(ssismHeader())).status).toBe(404);

    const list = await request(app).get('/api/v1/courses').set(ssismHeader());
    expect(list.status).toBe(200);
    expect(list.body.data.map((c) => c._id)).toEqual([String(world.courses.SSISM._id)]);
  });
});

test('a request without X-Institute-Id is rejected', async () => {
  const res = await request(app).get('/api/v1/courses').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('INSTITUTE_REQUIRED');
});

test('a request without a token is rejected', async () => {
  const res = await request(app)
    .get('/api/v1/courses')
    .set('X-Institute-Id', String(world.institutes.ssism._id));
  expect(res.status).toBe(401);
});
