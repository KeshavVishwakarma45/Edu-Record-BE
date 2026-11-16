import request from 'supertest';

import { createApp } from '../src/app.js';
import { jest } from '@jest/globals';
import { Student } from '../src/modules/students/student.model.js';
import { Document } from '../src/modules/documents/document.model.js';
import { Handover } from '../src/modules/documents/handover.model.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';

import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';
import { AUDIT_ACTIONS } from '../src/constants/auditActions.js';
import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

import { save, remove } from '../src/utils/storage.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let student;
let headers;
let photoFile;
let receiptFile;

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');

const scope = () => ({
  tenantId: world.tenantId,
  instituteId: world.institutes.ssism._id,
});

async function createDocuments(statuses, prefix) {
  return Document.create(
    statuses.map((status, index) => ({
      ...scope(),
      studentId: student._id,
      courseId: world.courses.SSISM._id,
      documentName: `${prefix} ${index + 1}`,
      documentType: 'Original',
      status,
    })),
  );
}

function handoverPayload(documentIds) {
  return {
    studentId: String(student._id),
    documentIds: documentIds.map((document) => String(document._id)),
    receiverType: 'SELF',
    receiverName: 'Test Student',
    receiverMobile: '9876543210',
    receiverPhotoId: String(photoFile._id),
    signedReceiptId: String(receiptFile._id),
  };
}

async function submit(documentIds) {
  return request(app).post('/api/v1/handover').set(headers).send(handoverPayload(documentIds));
}

beforeAll(async () => {
  await startDb();
  world = await createWorld();

  student = await Student.create({
    ...scope(),
    universityId: world.affiliations.SSISM.universityId,
    courseId: world.courses.SSISM._id,
    scholarNo: 'HANDSUBMIT001',
    name: 'Test Student',
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
  });

  headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);

  const fakeReq = {
    scope: scope(),
    user: { id: world.users.ssismAdmin._id },
  };

  photoFile = await save(fakeReq, {
    buffer: PNG,
    mimetype: 'image/png',
    size: PNG.length,
    originalname: 'receiver.png',
  });

  receiptFile = await save(fakeReq, {
    buffer: PDF,
    mimetype: 'application/pdf',
    size: PDF.length,
    originalname: 'signed-receipt.pdf',
  });
});

afterAll(async () => {
  if (photoFile) await remove(photoFile);
  if (receiptFile) await remove(receiptFile);

  await stopDb();
});

test('submits handover for multiple documents successfully', async () => {
  const documents = await createDocuments(
    [DOCUMENT_STATUSES.IN_CUSTODY, DOCUMENT_STATUSES.IN_CUSTODY],
    'Successful Handover Document',
  );

  const res = await submit(documents);

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);

  const data = res.body.data;

  expect(data.handoverId).toBeTruthy();
  expect(data.documentIds).toHaveLength(2);
  expect(data.receiverType).toBe('SELF');
  expect(data.receiverName).toBe('Test Student');
  expect(data.status).toBe('Completed');

  const handover = await Handover.findOne({
    ...scope(),
    _id: data.handoverId,
  }).lean();

  expect(handover).toBeTruthy();
  expect(String(handover.issuedBy)).toBe(String(world.users.ssismAdmin._id));
  expect(handover.handoverAt).toBeInstanceOf(Date);

  const updatedDocuments = await Document.find({
    ...scope(),
    _id: { $in: documents.map((document) => document._id) },
  }).lean();

  expect(updatedDocuments).toHaveLength(2);

  for (const document of updatedDocuments) {
    expect(document.status).toBe(DOCUMENT_STATUSES.ISSUED);
    expect(document.issuedAt).toBeInstanceOf(Date);
    expect(String(document.issuedBy)).toBe(String(world.users.ssismAdmin._id));
  }

  const auditEntries = await AuditLog.find({
    ...scope(),
    entity: 'handover',
    entityId: handover._id,
    action: AUDIT_ACTIONS.HANDOVER,
  }).lean();

  expect(auditEntries).toHaveLength(1);
});

test('prevents handing over an already issued document again', async () => {
  const documents = await createDocuments(
    [DOCUMENT_STATUSES.IN_CUSTODY],
    'Duplicate Handover Document',
  );

  const firstResponse = await submit(documents);

  expect(firstResponse.status).toBe(201);

  const secondResponse = await submit(documents);

  expect(secondResponse.status).toBe(409);

  const handovers = await Handover.find({
    ...scope(),
    documentIds: documents[0]._id,
  }).lean();

  expect(handovers).toHaveLength(1);
});

test('rejects a handover containing a document that is not in custody', async () => {
  const documents = await createDocuments(
    [DOCUMENT_STATUSES.IN_CUSTODY, DOCUMENT_STATUSES.EXPECTED],
    'Unavailable Handover Document',
  );

  const beforeCount = await Handover.countDocuments({
    ...scope(),
    studentId: student._id,
  });

  const res = await submit(documents);

  expect(res.status).toBe(409);

  const afterCount = await Handover.countDocuments({
    ...scope(),
    studentId: student._id,
  });

  expect(afterCount).toBe(beforeCount);

  const unchangedDocuments = await Document.find({
    ...scope(),
    _id: { $in: documents.map((document) => document._id) },
  }).lean();

  expect(unchangedDocuments[0].status).toBe(DOCUMENT_STATUSES.IN_CUSTODY);
  expect(unchangedDocuments[1].status).toBe(DOCUMENT_STATUSES.EXPECTED);
});

test('rolls back handover and document updates if audit creation fails', async () => {
  const documents = await createDocuments(
    [DOCUMENT_STATUSES.IN_CUSTODY, DOCUMENT_STATUSES.IN_CUSTODY],
    'Rollback Handover Document',
  );

  const beforeHandoverCount = await Handover.countDocuments({
    ...scope(),
    studentId: student._id,
  });

  const beforeAuditCount = await AuditLog.countDocuments({
    ...scope(),
    entity: 'handover',
  });

  const auditSpy = jest
    .spyOn(AuditLog, 'create')
    .mockRejectedValueOnce(new Error('Simulated audit failure'));

  let res;

  try {
    res = await submit(documents);
  } finally {
    auditSpy.mockRestore();
  }

  expect(res.status).toBe(500);

  const afterHandoverCount = await Handover.countDocuments({
    ...scope(),
    studentId: student._id,
  });

  const afterAuditCount = await AuditLog.countDocuments({
    ...scope(),
    entity: 'handover',
  });

  expect(afterHandoverCount).toBe(beforeHandoverCount);
  expect(afterAuditCount).toBe(beforeAuditCount);

  const unchangedDocuments = await Document.find({
    ...scope(),
    _id: { $in: documents.map((document) => document._id) },
  }).lean();

  for (const document of unchangedDocuments) {
    expect(document.status).toBe(DOCUMENT_STATUSES.IN_CUSTODY);
    expect(document.issuedAt).toBeNull();
    expect(document.issuedBy).toBeNull();
  }
});
