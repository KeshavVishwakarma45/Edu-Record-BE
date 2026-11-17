import request from 'supertest';

import { createApp } from '../src/app.js';
import { Document } from '../src/modules/documents/document.model.js';
import { Student } from '../src/modules/students/student.model.js';

import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';
import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let student;
let documents;

beforeAll(async () => {
  await startDb();
  world = await createWorld();

  student = await Student.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    universityId: world.affiliations.SSISM.universityId,
    courseId: world.courses.SSISM._id,
    scholarNo: 'HANDSEARCH001',
    name: 'Test Student',
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
  });

  documents = await Document.create([
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      studentId: student._id,
      courseId: world.courses.SSISM._id,
      documentName: '10th Marksheet',
      documentType: 'Original',
      status: DOCUMENT_STATUSES.IN_CUSTODY,
      issueDate: new Date('2020-05-15T00:00:00.000Z'),
    },
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      studentId: student._id,
      courseId: world.courses.SSISM._id,
      documentName: '12th Marksheet',
      documentType: 'Original',
      status: DOCUMENT_STATUSES.EXPECTED,
    },
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      studentId: student._id,
      courseId: world.courses.SSISM._id,
      documentName: 'Transfer Certificate',
      documentType: 'Original',
      status: DOCUMENT_STATUSES.ISSUED,
    },
  ]);
});

afterAll(stopDb);

test('fetches student documents with correct handover eligibility', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .get(`/api/v1/handover/students/${student._id}/documents`)
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  const result = res.body.data.documents;

  expect(result).toHaveLength(3);

  const eligibleDocument = result.find((item) => item.documentId === String(documents[0]._id));

  const expectedDocument = result.find((item) => item.documentId === String(documents[1]._id));

  const issuedDocument = result.find((item) => item.documentId === String(documents[2]._id));

  expect(eligibleDocument.isEligibleForHandover).toBe(true);
  expect(eligibleDocument.status).toBe('In custody');
  expect(eligibleDocument.issueDate).toBe('2020-05-15');

  expect(expectedDocument.isEligibleForHandover).toBe(false);
  expect(issuedDocument.isEligibleForHandover).toBe(false);
});
