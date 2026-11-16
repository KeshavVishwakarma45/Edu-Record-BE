import request from 'supertest';

import { createApp } from '../src/app.js';
import { Student } from '../src/modules/students/student.model.js';
import { File } from '../src/modules/files/file.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let student;

const uploadedFileIds = [];

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000', 'hex');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

beforeAll(async () => {
  await startDb();
  world = await createWorld();

  student = await Student.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    universityId: world.affiliations.SSISM.universityId,
    courseId: world.courses.SSISM._id,
    scholarNo: 'SIGN001',
    name: 'Test Student',
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
  });
});

afterAll(async () => {
  for (const id of uploadedFileIds) {
    const file = await File.findOne({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      _id: id,
    });

    if (file) {
      const { remove } = await import('../src/utils/storage.js');
      await remove(file);
    }
  }

  await stopDb();
});

test('uploads a signature image successfully', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-signature')
    .set(headers)
    .field('studentId', String(student._id))
    .attach('signature', PNG, {
      filename: 'signature.png',
      contentType: 'image/png',
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);

  const data = res.body.data;

  expect(data.fileId).toBeTruthy();
  expect(data.fileUrl).toBe(`/api/v1/files/${data.fileId}`);
  expect(new Date(data.uploadedAt).toString()).not.toBe('Invalid Date');

  uploadedFileIds.push(data.fileId);

  const storedFile = await File.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    _id: data.fileId,
  }).lean();

  expect(storedFile).toBeTruthy();
  expect(storedFile.mimeType).toBe('image/png');
});

test('uploads a signed receipt PDF successfully', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-signature')
    .set(headers)
    .field('studentId', String(student._id))
    .attach('signature', PDF, {
      filename: 'signed-receipt.pdf',
      contentType: 'application/pdf',
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data.fileId).toBeTruthy();

  uploadedFileIds.push(res.body.data.fileId);

  const storedFile = await File.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    _id: res.body.data.fileId,
  }).lean();

  expect(storedFile).toBeTruthy();
  expect(storedFile.mimeType).toBe('application/pdf');
});

test('rejects signature upload for a nonexistent student', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-signature')
    .set(headers)
    .field('studentId', '507f1f77bcf86cd799439011')
    .attach('signature', PNG, {
      filename: 'signature.png',
      contentType: 'image/png',
    });

  expect(res.status).toBe(404);
  expect(res.body.success).toBe(false);
});

test('rejects unsupported signature file types', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-signature')
    .set(headers)
    .field('studentId', String(student._id))
    .attach('signature', Buffer.from('plain text'), {
      filename: 'signature.txt',
      contentType: 'text/plain',
    });

  expect(res.status).toBe(400);
});
test('uploads a receiver photo successfully', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-photo')
    .set(headers)
    .field('studentId', String(student._id))
    .attach('photo', PNG, {
      filename: 'receiver.png',
      contentType: 'image/png',
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);

  const data = res.body.data;

  expect(data.fileId).toBeTruthy();
  expect(data.fileUrl).toBe(`/api/v1/files/${data.fileId}`);
  expect(new Date(data.uploadedAt).toString()).not.toBe('Invalid Date');

  uploadedFileIds.push(data.fileId);

  const storedFile = await File.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    _id: data.fileId,
  }).lean();

  expect(storedFile).toBeTruthy();
  expect(storedFile.mimeType).toBe('image/png');
});
test('uploads a receiver JPEG photo successfully', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-photo')
    .set(headers)
    .field('studentId', String(student._id))
    .attach('photo', JPEG, {
      filename: 'receiver.jpg',
      contentType: 'image/jpeg',
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);

  uploadedFileIds.push(res.body.data.fileId);

  const storedFile = await File.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    _id: res.body.data.fileId,
  }).lean();
  expect(storedFile).toBeTruthy();
  expect(storedFile.mimeType).toBe('image/jpeg');
});
test('rejects receiver photo upload when photo is missing', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-photo')
    .set(headers)
    .field('studentId', String(student._id));

  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});
test('rejects WebP receiver photo uploads', async () => {
  const headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const res = await request(app)
    .post('/api/v1/handover/upload-photo')
    .set(headers)
    .field('studentId', String(student._id))
    .attach('photo', Buffer.from('fake webp image'), {
      filename: 'receiver.webp',
      contentType: 'image/webp',
    });

  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
});
