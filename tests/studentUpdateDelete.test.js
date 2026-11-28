import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../src/app.js';

import { Student } from '../src/modules/students/student.model.js';
import { TC } from '../src/modules/tc/tc.model.js';
import { File } from '../src/modules/files/file.model.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';
import { AUDIT_ACTIONS } from '../src/constants/auditActions.js';

import * as storage from '../src/utils/storage.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let headers;
let sequence = 0;

beforeAll(async () => {
  await startDb();

  world = await createWorld();

  headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);
});

afterAll(stopDb);

// Create test student
async function createStudent(overrides = {}, instituteName = 'ssism') {
  sequence++;

  const code = instituteName.toUpperCase();

  return Student.create({
    tenantId: world.tenantId,
    instituteId: world.institutes[instituteName]._id,
    universityId: world.affiliations[code].universityId,
    courseId: world.courses[code]._id,

    scholarNo: `STU-TEST-${sequence}`,
    enrollmentNo: null,
    rollNo: `${sequence}`,

    name: 'Ram Agrawal',
    fatherName: 'Test Father',
    motherName: 'Test Mother',

    dob: new Date('2005-01-15'),
    gender: GENDERS.MALE,
    category: CATEGORIES.GEN,

    admissionDate: new Date('2024-07-01'),

    ...overrides,
  });
}

// Create a TC record for a student
async function createTCForStudent(student, status) {
  return TC.create({
    tenantId: world.tenantId,
    instituteId: student.instituteId,
    studentId: student._id,
    clearanceApplicationId: new mongoose.Types.ObjectId(),
    reasonForLeaving: 'Course Completed',
    conduct: 'Good',
    status,
  });
}

// TEST 1: Update Student
test('PATCH updates student details and preserves omitted fields', async () => {
  const student = await createStudent({
    enrollmentNo: 'ENR-TEST-1001',
  });

  const response = await request(app).patch(`/api/v1/students/${student._id}`).set(headers).send({
    name: 'Updated Ram Agrawal',
    mobile: '9876543210',
  });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(response.body.data.name).toBe('Updated Ram Agrawal');
  expect(response.body.data.mobile).toBe('9876543210');

  const savedStudent = await Student.findOne({
    tenantId: world.tenantId,
    _id: student._id,
  }).lean();

  expect(savedStudent.enrollmentNo).toBe('ENR-TEST-1001');

  const auditEntry = await AuditLog.findOne({
    tenantId: world.tenantId,
    entity: 'student',
    entityId: student._id,
    action: AUDIT_ACTIONS.UPDATE,
  }).lean();

  expect(auditEntry).not.toBeNull();
});

// TEST 2: Duplicate Scholar Number
test('PATCH rejects duplicate scholar number', async () => {
  const student1 = await createStudent({
    scholarNo: 'DUPLICATE-1001',
  });

  const student2 = await createStudent({
    scholarNo: 'DUPLICATE-1002',
  });

  const response = await request(app).patch(`/api/v1/students/${student2._id}`).set(headers).send({
    scholarNo: student1.scholarNo,
  });

  expect(response.status).toBe(409);
});

// TEST 3: Soft Delete Student
test('DELETE soft deletes student and prevents normal profile access', async () => {
  const student = await createStudent();

  const response = await request(app).delete(`/api/v1/students/${student._id}`).set(headers);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.data.deletedAt).toBeTruthy();
  expect(response.body.data.deletedBy).toBeTruthy();

  const savedStudent = await Student.findOne({
    tenantId: world.tenantId,
    _id: student._id,
  });

  expect(savedStudent).not.toBeNull();
  expect(savedStudent.deletedAt).toBeTruthy();
  expect(String(savedStudent.deletedBy)).toBe(String(world.users.ssismAdmin._id));

  const profileResponse = await request(app).get(`/api/v1/students/${student._id}`).set(headers);

  expect(profileResponse.status).toBe(404);

  const listingResponse = await request(app)
    .get('/api/v1/students')
    .query({ search: student.scholarNo })
    .set(headers);

  expect(listingResponse.status).toBe(200);
  expect(listingResponse.body.data).toHaveLength(0);

  const secondDelete = await request(app).delete(`/api/v1/students/${student._id}`).set(headers);

  expect(secondDelete.status).toBe(404);

  const deleteAudit = await AuditLog.find({
    tenantId: world.tenantId,
    entity: 'student',
    entityId: student._id,
    action: AUDIT_ACTIONS.DELETE,
  }).lean();

  expect(deleteAudit).toHaveLength(1);
});

// TEST 4: Active or issued TC blocks student deletion
test.each(['draft', 'submitted', 'pending_approval', 'approved', 'issued'])(
  'DELETE rejects student deletion when TC status is %s',
  async (status) => {
    const student = await createStudent();

    await createTCForStudent(student, status);

    const response = await request(app).delete(`/api/v1/students/${student._id}`).set(headers);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);

    // Tenant-scoped query: tenantId is required by tenantGuard
    const savedStudent = await Student.findOne({
      tenantId: world.tenantId,
      _id: student._id,
    }).lean();

    expect(savedStudent).not.toBeNull();
    expect(savedStudent.deletedAt).toBeNull();
  },
);

// TEST 5: Rejected TC allows student deletion
test('DELETE allows student deletion when all TC applications are rejected', async () => {
  const student = await createStudent();

  await createTCForStudent(student, 'rejected');

  const response = await request(app).delete(`/api/v1/students/${student._id}`).set(headers);

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  const savedStudent = await Student.findOne({
    tenantId: world.tenantId,
    _id: student._id,
  }).lean();

  expect(savedStudent).not.toBeNull();
  expect(savedStudent.deletedAt).toBeTruthy();
});

// TEST 6: Institute Scope Validation
test('student from another institute cannot be updated', async () => {
  const student = await createStudent(
    {
      name: 'SSEC Student',
    },
    'ssec',
  );

  const response = await request(app).patch(`/api/v1/students/${student._id}`).set(headers).send({
    name: 'Unauthorized Update',
  });

  expect(response.status).toBe(404);

  const savedStudent = await Student.findOne({
    tenantId: world.tenantId,
    _id: student._id,
  }).lean();

  expect(savedStudent.name).toBe('SSEC Student');
});

// TEST 7: Student Photo Replacement
test('PATCH replaces student photo and removes old photo', async () => {
  const student = await createStudent();

  const fakeRequest = {
    scope: {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
    },
    user: {
      id: world.users.ssismAdmin._id,
    },
  };

  // Create an existing photo
  const oldBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00]);

  const oldPhoto = await storage.save(fakeRequest, {
    buffer: oldBuffer,
    originalname: 'old.jpg',
    mimetype: 'image/jpeg',
    size: oldBuffer.length,
  });

  student.photo = oldPhoto._id;
  await student.save();

  // Upload replacement photo
  const newBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

  const response = await request(app)
    .patch(`/api/v1/students/${student._id}/photo`)
    .set(headers)
    .attach('photo', newBuffer, {
      filename: 'new.jpg',
      contentType: 'image/jpeg',
    });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  expect(String(response.body.data.photo)).not.toBe(String(oldPhoto._id));

  // Old photo should be removed
  const removedPhoto = await File.findOne({
    tenantId: world.tenantId,
    _id: oldPhoto._id,
  });

  expect(removedPhoto).toBeNull();

  // New photo should exist
  const newPhoto = await File.findOne({
    tenantId: world.tenantId,
    _id: response.body.data.photo,
  });

  expect(newPhoto).not.toBeNull();

  // Cleanup new photo created by test
  await storage.remove(newPhoto);
});
