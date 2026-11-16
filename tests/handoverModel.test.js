import mongoose from 'mongoose';

import { Handover } from '../src/modules/documents/handover.model.js';
import { Student } from '../src/modules/students/student.model.js';

import { createWorld } from './helpers/fixtures.js';
import { startDb, stopDb } from './helpers/db.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

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
    scholarNo: 'HAND001',
    name: 'Test Student',
    fatherName: 'Test Father',
    dob: '2006-05-01',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    admissionDate: '2024-07-15',
  });
});

afterAll(stopDb);

const validHandover = (overrides = {}) => ({
  tenantId: world.tenantId,
  instituteId: world.institutes.ssism._id,
  studentId: student._id,

  documentIds: [new mongoose.Types.ObjectId()],

  receiverType: 'SELF',
  receiverName: 'Test Student',
  receiverMobile: '9876543210',

  receiverPhotoId: new mongoose.Types.ObjectId(),
  signedReceiptId: new mongoose.Types.ObjectId(),

  issuedBy: world.users.ssismAdmin._id,

  ...overrides,
});

test('valid SELF handover can be created', async () => {
  const handover = await Handover.create(validHandover());

  expect(handover.receiverType).toBe('SELF');
  expect(handover.receiverName).toBe('Test Student');
  expect(handover.status).toBe('Completed');
});

test('handover requires at least one document', async () => {
  await expect(Handover.create(validHandover({ documentIds: [] }))).rejects.toThrow(
    /At least one document is required/,
  );
});

test('duplicate document IDs are rejected', async () => {
  const documentId = new mongoose.Types.ObjectId();

  await expect(
    Handover.create(
      validHandover({
        documentIds: [documentId, documentId],
      }),
    ),
  ).rejects.toThrow(/Duplicate document IDs are not allowed/);
});

test('receiver type other than SELF is rejected', async () => {
  await expect(
    Handover.create(
      validHandover({
        receiverType: 'AUTHORISED_PERSON',
      }),
    ),
  ).rejects.toThrow(/not a valid enum value/);
});

test('receiver photo is mandatory', async () => {
  const data = validHandover();
  delete data.receiverPhotoId;

  await expect(Handover.create(data)).rejects.toThrow(/receiverPhotoId/);
});

test('signed receipt is mandatory', async () => {
  const data = validHandover();
  delete data.signedReceiptId;

  await expect(Handover.create(data)).rejects.toThrow(/signedReceiptId/);
});

test('handover timestamp is generated automatically', async () => {
  const handover = await Handover.create(validHandover());

  expect(handover.handoverAt).toBeInstanceOf(Date);
  expect(handover.status).toBe('Completed');
});

test('handover queries without tenantId are blocked by tenantGuard', async () => {
  await expect(Handover.find({ studentId: student._id })).rejects.toThrow(/tenantGuard/);
});
