import { Document } from '../src/modules/documents/document.model.js';
import { Student } from '../src/modules/students/student.model.js';

import { createWorld } from './helpers/fixtures.js';
import { startDb, stopDb } from './helpers/db.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';

let world;
let student;

beforeAll(async () => {
  await startDb();
  world = await createWorld();

  student = await Student.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    universityId: world.affiliations.SSISM.universityId,
    courseId: world.courses.SSISM._id,
    scholarNo: 'DOC001',
    name: 'Test Student',
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
  });
});

afterAll(stopDb);

const validDocument = (overrides = {}) => ({
  tenantId: world.tenantId,
  instituteId: world.institutes.ssism._id,
  studentId: student._id,
  courseId: world.courses.SSISM._id,
  documentName: '10th Marksheet',
  documentType: 'Original',
  ...overrides,
});

test('new document has Expected status by default', async () => {
  const document = await Document.create(validDocument());

  expect(document.status).toBe(DOCUMENT_STATUSES.EXPECTED);
});

test('document can be created with In custody status', async () => {
  const document = await Document.create(
    validDocument({
      documentName: '12th Marksheet',
      status: DOCUMENT_STATUSES.IN_CUSTODY,
    }),
  );

  expect(document.status).toBe(DOCUMENT_STATUSES.IN_CUSTODY);
});

test('invalid document status is rejected', async () => {
  await expect(
    Document.create(
      validDocument({
        status: 'Available',
      }),
    ),
  ).rejects.toThrow(/validation/i);
});

test('document without studentId is rejected', async () => {
  const data = validDocument();
  delete data.studentId;

  await expect(Document.create(data)).rejects.toThrow(/validation/i);
});

test('document query without tenantId is blocked by tenantGuard', async () => {
  await expect(Document.find({ documentName: '10th Marksheet' })).rejects.toThrow(/tenantGuard/);
});
