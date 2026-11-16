import request from 'supertest';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';

import { Student } from '../src/modules/students/student.model.js';
import { Document } from '../src/modules/documents/document.model.js';
import { Handover } from '../src/modules/documents/handover.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';
import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let student;
let headers;
let olderHandover;
let newerHandover;

beforeAll(async () => {
  await startDb();
  world = await createWorld();

  student = await Student.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    universityId: world.affiliations.SSISM.universityId,
    courseId: world.courses.SSISM._id,
    scholarNo: 'HISTORY001',
    enrollmentNo: 'ENR-HISTORY001',
    name: 'Ram Agrawal',
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.MALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
  });

  headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const documents = await Document.create([
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      studentId: student._id,
      courseId: world.courses.SSISM._id,
      documentName: '10th Marksheet',
      documentType: 'Original',
      status: DOCUMENT_STATUSES.ISSUED,
    },
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      studentId: student._id,
      courseId: world.courses.SSISM._id,
      documentName: '12th Marksheet',
      documentType: 'Original',
      status: DOCUMENT_STATUSES.ISSUED,
    },
  ]);

  const createHandover = (document, date) =>
    Handover.create({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      studentId: student._id,
      documentIds: [document._id],
      receiverType: 'SELF',
      receiverName: 'Ram Agrawal',
      receiverMobile: '9876543210',
      receiverPhotoId: new mongoose.Types.ObjectId(),
      signedReceiptId: new mongoose.Types.ObjectId(),
      issuedBy: world.users.ssismAdmin._id,
      handoverAt: new Date(date),
      status: 'Completed',
    });

  olderHandover = await createHandover(documents[0], '2026-11-10T10:00:00.000Z');

  newerHandover = await createHandover(documents[1], '2026-11-14T10:00:00.000Z');
});

afterAll(stopDb);

test('fetches handover history with student, document and staff details', async () => {
  const res = await request(app).get('/api/v1/handover/history').set(headers);

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  expect(res.body.data).toHaveLength(2);

  // Latest handover should appear first
  expect(res.body.data[0].handoverId).toBe(String(newerHandover._id));

  expect(res.body.data[0].studentName).toBe('Ram Agrawal');
  expect(res.body.data[0].enrollmentNumber).toBe('ENR-HISTORY001');

  expect(res.body.data[0].documents[0].documentName).toBe('12th Marksheet');

  expect(res.body.data[0].issuingStaffName).toBe(world.users.ssismAdmin.name);

  expect(res.body.data[0].status).toBe('Completed');

  expect(res.body.meta.total).toBe(2);
});

test('searches handover history by enrollment number', async () => {
  const res = await request(app)
    .get('/api/v1/handover/history')
    .query({ search: 'ENR-HISTORY001' })
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
});

test('filters history by date range', async () => {
  const res = await request(app)
    .get('/api/v1/handover/history')
    .query({
      fromDate: '2026-11-12',
      toDate: '2026-11-14',
    })
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0].handoverId).toBe(String(newerHandover._id));
});

test('filters history by student ID', async () => {
  const res = await request(app)
    .get('/api/v1/handover/history')
    .query({ studentId: String(student._id) })
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(2);
});

test('supports pagination', async () => {
  const res = await request(app)
    .get('/api/v1/handover/history')
    .query({ page: 1, limit: 1 })
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(1);
  expect(res.body.data[0].handoverId).toBe(String(newerHandover._id));

  expect(res.body.meta.page).toBe(1);
  expect(res.body.meta.limit).toBe(1);
  expect(res.body.meta.total).toBe(2);

  // Check second page
  const secondPage = await request(app)
    .get('/api/v1/handover/history')
    .query({ page: 2, limit: 1 })
    .set(headers);

  expect(secondPage.status).toBe(200);
  expect(secondPage.body.data).toHaveLength(1);

  expect(secondPage.body.data[0].handoverId).toBe(String(olderHandover._id));
});
