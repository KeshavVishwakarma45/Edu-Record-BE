import request from 'supertest';

import { createApp } from '../src/app.js';

import { InwardBatch, InwardDocument } from '../src/modules/inward/inward.model.js';

import { Student } from '../src/modules/students/student.model.js';

import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';
import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

const GET_URL = '/api/v1/reports/not-received';

let world;
let headers;
let nextNumber = 0;

beforeAll(async () => {
  await startDb();

  world = await createWorld();

  headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);
});

afterAll(stopDb);

// Creates a student, inward batch and inward document.
async function createReportRecord({
  institute = 'ssism',
  name,
  status = DOCUMENT_STATUSES.NOT_RECEIVED,
  documentType = 'Marksheet',
  receivedDate = '2026-11-05T10:00:00.000Z',
  reason = 'ABSENT',
  otherReason = '',
  followUpDate = '2026-11-20',
} = {}) {
  nextNumber += 1;

  const code = institute.toUpperCase();
  const scope = {
    tenantId: world.tenantId,
    instituteId: world.institutes[institute]._id,
  };

  const student = await Student.create({
    ...scope,
    universityId: world.affiliations[code].universityId,
    courseId: world.courses[code]._id,
    scholarNo: `RPT-SCH-${nextNumber}`,
    enrollmentNo: `RPT-ENR-${nextNumber}`,
    rollNo: String(nextNumber),
    name: name ?? `RPT Student ${nextNumber}`,
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
    branch: 'Computer Science',
  });

  const batch = await InwardBatch.create({
    ...scope,
    universityId: world.affiliations[code].universityId,
    courseId: world.courses[code]._id,
    examTerm: 'Semester V',
    examSession: {
      month: 11,
      year: 2026,
    },
    documentType,
    receivedDate: new Date(receivedDate),
    receivedBy: world.users.admin._id,
    referenceNumber: `RPT-REF-${nextNumber}`,
  });

  const document = await InwardDocument.create({
    ...scope,
    batchId: batch._id,
    studentId: student._id,
    documentType,
    status,
    ...(status === DOCUMENT_STATUSES.NOT_RECEIVED && {
      missingDetails: {
        reason,
        otherReason,
        followUpDate: new Date(`${followUpDate}T00:00:00.000Z`),
      },
    }),
  });

  return { student, batch, document };
}

test('returns only Not received documents with student, course and university details', async () => {
  const { document } = await createReportRecord({
    name: 'RPT-VISIBLE-STUDENT',
  });

  await createReportRecord({
    name: 'RPT-EXPECTED-STUDENT',
    status: DOCUMENT_STATUSES.EXPECTED,
  });

  const res = await request(app).get(GET_URL).set(headers).query({ search: 'RPT-' });

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  expect(res.body.data).toHaveLength(1);
  expect(String(res.body.data[0]._id)).toBe(String(document._id));

  expect(res.body.data[0].status).toBe(DOCUMENT_STATUSES.NOT_RECEIVED);

  expect(res.body.data[0].student.name).toBe('RPT-VISIBLE-STUDENT');
  expect(res.body.data[0].student.scholarNo).toBeTruthy();
  expect(res.body.data[0].student.enrollmentNo).toBeTruthy();

  expect(res.body.data[0].course.name).toBeTruthy();
  expect(res.body.data[0].university.name).toBe('Vikram University');

  expect(res.body.data[0].inwardBatch.receivedDate).toBeTruthy();
  expect(res.body.data[0].examTerm).toBe('Semester V');
  expect(res.body.data[0].documentType).toBe('Marksheet');

  expect(res.body.meta.total).toBe(1);
});

test('filters by course, document type and inward batch received date', async () => {
  await createReportRecord({
    name: 'RPT-FILTER-INCLUDED',
    documentType: 'Marksheet',
    receivedDate: '2026-11-05T15:00:00.000Z',
  });

  await createReportRecord({
    name: 'RPT-FILTER-WRONG-TYPE',
    documentType: 'Degree',
    receivedDate: '2026-11-05T15:00:00.000Z',
  });

  await createReportRecord({
    name: 'RPT-FILTER-OLD-DATE',
    documentType: 'Marksheet',
    receivedDate: '2026-10-25T10:00:00.000Z',
  });

  const res = await request(app)
    .get(GET_URL)
    .set(headers)
    .query({
      search: 'RPT-FILTER',
      courseId: String(world.courses.SSISM._id),
      documentType: 'Marksheet',
      fromDate: '2026-11-01T00:00:00.000Z',
      toDate: '2026-11-05T00:00:00.000Z',
    });

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0].student.name).toBe('RPT-FILTER-INCLUDED');
  expect(res.body.meta.total).toBe(1);
});

test('supports server-side pagination', async () => {
  await createReportRecord({ name: 'RPT-PAGE-A' });
  await createReportRecord({ name: 'RPT-PAGE-B' });
  await createReportRecord({ name: 'RPT-PAGE-C' });

  const res = await request(app).get(GET_URL).set(headers).query({
    search: 'RPT-PAGE-',
    page: 2,
    limit: 2,
    sort: 'receivedDate',
  });

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);

  expect(res.body.meta).toEqual({
    page: 2,
    limit: 2,
    total: 3,
  });
});

test('updates follow-up date independently and reason independently', async () => {
  const { document } = await createReportRecord({
    name: 'RPT-PATCH-STUDENT',
    reason: 'ABSENT',
    followUpDate: '2026-11-20',
  });

  const baseUrl = `${GET_URL}/${document._id}/follow-up`;

  // Update only follow-up date.
  const dateRes = await request(app).patch(baseUrl).set(headers).send({
    followUpDate: '2026-11-25',
  });

  expect(dateRes.status).toBe(200);
  expect(dateRes.body.data.reason).toBe('ABSENT');
  expect(dateRes.body.data.followUpDate).toBe('2026-11-25T00:00:00.000Z');

  // Update only reason and its explanation.
  const reasonRes = await request(app).patch(baseUrl).set(headers).send({
    reason: 'OTHER',
    otherReason: 'Awaiting university dispatch',
  });

  expect(reasonRes.status).toBe(200);
  expect(reasonRes.body.data.reason).toBe('OTHER');
  expect(reasonRes.body.data.otherReason).toBe('Awaiting university dispatch');

  // Previous follow-up date should remain unchanged.
  expect(reasonRes.body.data.followUpDate).toBe('2026-11-25T00:00:00.000Z');

  const saved = await InwardDocument.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    _id: document._id,
  });

  expect(saved.missingDetails.reason).toBe('OTHER');
  expect(saved.missingDetails.otherReason).toBe('Awaiting university dispatch');
});

test('rejects OTHER without otherReason', async () => {
  const { document } = await createReportRecord();

  const res = await request(app).patch(`${GET_URL}/${document._id}/follow-up`).set(headers).send({
    reason: 'OTHER',
  });

  expect(res.status).toBe(400);
});

test('rejects an empty PATCH request', async () => {
  const { document } = await createReportRecord();

  const res = await request(app)
    .patch(`${GET_URL}/${document._id}/follow-up`)
    .set(headers)
    .send({});

  expect(res.status).toBe(400);
});

test('does not allow follow-up updates for other document statuses', async () => {
  const { document } = await createReportRecord({
    status: DOCUMENT_STATUSES.EXPECTED,
  });

  const res = await request(app).patch(`${GET_URL}/${document._id}/follow-up`).set(headers).send({
    followUpDate: '2026-11-25',
  });

  expect(res.status).toBe(409);
});

test('does not allow updating another institute document', async () => {
  const { document } = await createReportRecord({
    institute: 'ssec',
  });

  const res = await request(app).patch(`${GET_URL}/${document._id}/follow-up`).set(headers).send({
    followUpDate: '2026-11-25',
  });

  expect(res.status).toBe(404);
});
