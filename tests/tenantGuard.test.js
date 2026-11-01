// The tenantGuard plugin is the safety net: a query without tenantId must fail, never leak data.
import { Course } from '../src/modules/courses/course.model.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld } from './helpers/fixtures.js';

let world;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
});
afterAll(stopDb);

test.each([
  ['find', () => Course.find({})],
  ['findOne', () => Course.findOne({ shortCode: 'BCA' })],
  ['findById', () => Course.findById(world.courses.SSISM._id)],
  ['countDocuments', () => Course.countDocuments({})],
  ['updateOne', () => Course.updateOne({ shortCode: 'BCA' }, { name: 'x' })],
  ['updateMany', () => Course.updateMany({}, { name: 'x' })],
  ['deleteMany', () => Course.deleteMany({})],
  ['aggregate', () => Course.aggregate([{ $match: { shortCode: 'BCA' } }])],
])('%s without tenantId throws', async (_name, query) => {
  await expect(query()).rejects.toThrow(/tenantGuard/);
});

test('queries with tenantId work', async () => {
  const courses = await Course.find({ tenantId: world.tenantId });
  expect(courses).toHaveLength(2);
});

test('populate works when the tenant is passed in match', async () => {
  const course = await Course.findOne({
    tenantId: world.tenantId,
    _id: world.courses.SSISM._id,
  }).populate({
    path: 'affiliationId',
    match: { tenantId: world.tenantId },
  });
  expect(course.affiliationId.fromYear).toBe(2010);
});

test('audit log entries cannot be changed or deleted', async () => {
  await AuditLog.create({ tenantId: world.tenantId, action: 'CREATE', entity: 'test' });
  await expect(AuditLog.updateOne({ tenantId: world.tenantId }, { action: 'x' })).rejects.toThrow();
  await expect(AuditLog.deleteMany({ tenantId: world.tenantId })).rejects.toThrow();
});
