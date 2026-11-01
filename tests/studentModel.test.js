// The Student model is part of the skeleton: check its unique rules and tenant guard (SRS STU-03).
import { Student } from '../src/modules/students/student.model.js';
import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';
import { STUDENT_STATUSES } from '../src/constants/statuses.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld } from './helpers/fixtures.js';

let world;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
});
afterAll(stopDb);

// A valid student in an institute; override any field
const student = (institute, overrides = {}) => ({
  tenantId: world.tenantId,
  instituteId: world.institutes[institute]._id,
  universityId: world.affiliations[institute.toUpperCase()].universityId,
  courseId: world.courses[institute.toUpperCase()]._id,
  scholarNo: '101',
  name: 'Test Student',
  fatherName: 'Test Father',
  dob: '2006-05-01',
  gender: GENDERS.FEMALE,
  category: CATEGORIES.OBC,
  admissionDate: '2024-07-15',
  ...overrides,
});

test('a new student is Studying, and a YYYY-MM-DD date is stored as that calendar day', async () => {
  const saved = await Student.create(student('ssism', { scholarNo: 'A1' }));
  expect(saved.status).toBe(STUDENT_STATUSES.STUDYING);
  expect(saved.dob.toISOString()).toBe('2006-05-01T00:00:00.000Z');
});

test('scholar no. is unique per institute, but may repeat in another institute', async () => {
  await Student.create(student('ssism', { scholarNo: 'S1' }));
  await expect(Student.create(student('ssism', { scholarNo: 'S1' }))).rejects.toThrow(
    /duplicate key/,
  );
  await expect(Student.create(student('ssec', { scholarNo: 'S1' }))).resolves.toBeTruthy();
});

test('enrollment no. is unique per university, and students without one do not clash', async () => {
  await Student.create(student('ssism', { scholarNo: 'E1', enrollmentNo: 'V24R0799001' }));
  await expect(
    Student.create(student('ssism', { scholarNo: 'E2', enrollmentNo: 'V24R0799001' })),
  ).rejects.toThrow(/duplicate key/);

  await Student.create(student('ssism', { scholarNo: 'N1' }));
  await expect(Student.create(student('ssism', { scholarNo: 'N2' }))).resolves.toBeTruthy();
});

test('student queries without tenantId are blocked by tenantGuard', async () => {
  await expect(Student.find({ name: 'Test Student' })).rejects.toThrow(/tenantGuard/);
});
