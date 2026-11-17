import request from 'supertest';
import { createApp } from '../src/app.js';

import { Student } from '../src/modules/students/student.model.js';
import { ClearanceItem } from '../src/modules/clearance/clearanceItem.model.js';
import { TC } from '../src/modules/tc/tc.model.js';
import { AuditLog } from '../src/modules/audit/auditLog.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';
import { CLEARANCE_STATUSES } from '../src/constants/clearanceStatuses.js';
import { AUDIT_ACTIONS } from '../src/constants/auditActions.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let tcClerkHeaders;
let ssecTcClerkHeaders;
let ssismStudent;
let ssecStudent;

const applicationBody = {
  lastClassAttended: 'BCA 3rd Year',
  leavingReason: 'Course Completed',
  documentsEnclosed: {
    tenthMarksheet: true,
    twelfthMarksheet: true,
    yearSemesterMarksheets: true,
  },
  declarations: {
    feesPaid: true,
    duesCleared: true,
    booksReturned: true,
  },
};

async function createStudent(instituteCode, scholarNo) {
  const institute = world.institutes[instituteCode.toLowerCase() === 'ssism' ? 'ssism' : 'ssec'];

  return Student.create({
    tenantId: world.tenantId,
    instituteId: institute._id,
    universityId: world.affiliations[instituteCode].universityId,
    scholarNo,
    name: `${instituteCode} Student ${scholarNo}`,
    fatherName: 'Father Name',
    motherName: 'Mother Name',
    dob: new Date('2004-06-15'),
    gender: GENDERS.MALE,
    category: CATEGORIES.GEN,
    admissionDate: new Date('2023-07-01'),
    courseId: world.courses[instituteCode]._id,
  });
}

beforeAll(async () => {
  await startDb();
  world = await createWorld();

  tcClerkHeaders = await headersFor(app, world.users.ssismTcClerk, world.institutes.ssism);
  ssecTcClerkHeaders = await headersFor(app, world.users.admin, world.institutes.ssec);

  ssismStudent = await createStudent('SSISM', 'TC-STU-001');
  ssecStudent = await createStudent('SSEC', 'TC-STU-002');
});

afterAll(stopDb);

// -------------------------------------------------------------------
// 1. POST /api/v1/tcs — Creation of TC draft with clearance checks
// -------------------------------------------------------------------

describe('POST /api/v1/tcs', () => {
  test('rejects TC creation if student has no clearance application', async () => {
    const res = await request(app)
      .post('/api/v1/tcs')
      .set(tcClerkHeaders)
      .send({
        studentId: String(ssismStudent._id),
        reasonForLeaving: 'Higher Studies',
        conduct: 'Good',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/mandatory clearances/i);
  });

  test('rejects TC creation if mandatory departments are not clear', async () => {
    // Create clearance application with pending status
    const appRes = await request(app)
      .post('/api/v1/clearance/applications')
      .set(tcClerkHeaders)
      .send({
        ...applicationBody,
        studentId: String(ssismStudent._id),
      });

    expect(appRes.status).toBe(201);

    const res = await request(app)
      .post('/api/v1/tcs')
      .set(tcClerkHeaders)
      .send({
        studentId: String(ssismStudent._id),
        reasonForLeaving: 'Course Completed',
        conduct: 'Satisfactory',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/mandatory clearances/i);
  });

  test('successfully creates a TC draft when mandatory clearances are Clear', async () => {
    // Mark all clearance items for this student as CLEAR
    await ClearanceItem.updateMany(
      { tenantId: world.tenantId, studentId: ssismStudent._id },
      { status: CLEARANCE_STATUSES.CLEAR },
    );

    const res = await request(app)
      .post('/api/v1/tcs')
      .set(tcClerkHeaders)
      .send({
        studentId: String(ssismStudent._id),
        reasonForLeaving: 'Course Completed',
        conduct: 'Excellent',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      studentId: String(ssismStudent._id),
      reasonForLeaving: 'Course Completed',
      conduct: 'Excellent',
      status: 'draft',
    });

    // Verify record in database
    const savedTC = await TC.findOne({
      tenantId: world.tenantId,
      _id: res.body.data._id,
    }).lean();
    expect(savedTC).not.toBeNull();
    expect(savedTC.status).toBe('draft');
    expect(String(savedTC.tenantId)).toBe(String(world.tenantId));
    expect(String(savedTC.instituteId)).toBe(String(world.institutes.ssism._id));

    // Verify audit log
    const auditLog = await AuditLog.findOne({
      tenantId: world.tenantId,
      entity: 'tc',
      entityId: savedTC._id,
      action: AUDIT_ACTIONS.CREATE,
    }).lean();
    expect(auditLog).not.toBeNull();
  });

  test('rejects duplicate TC creation if an active TC draft already exists', async () => {
    const res = await request(app)
      .post('/api/v1/tcs')
      .set(tcClerkHeaders)
      .send({
        studentId: String(ssismStudent._id),
        reasonForLeaving: 'Duplicate Attempt',
        conduct: 'Good',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  test('rejects TC creation for a student from another institute', async () => {
    const res = await request(app)
      .post('/api/v1/tcs')
      .set(tcClerkHeaders)
      .send({
        studentId: String(ssecStudent._id),
        reasonForLeaving: 'Cross-institute test',
        conduct: 'Good',
      });

    expect(res.status).toBe(404);
  });

  test('rejects TC creation if student is soft-deleted', async () => {
    const deletedStudent = await createStudent('SSISM', 'TC-DEL-001');
    await Student.findOneAndUpdate(
      { tenantId: world.tenantId, _id: deletedStudent._id },
      { deletedAt: new Date() },
    );

    const res = await request(app)
      .post('/api/v1/tcs')
      .set(tcClerkHeaders)
      .send({
        studentId: String(deletedStudent._id),
        reasonForLeaving: 'Leaving',
        conduct: 'Good',
      });

    expect(res.status).toBe(404);
  });
});

// -------------------------------------------------------------------
// 2. GET /api/v1/tcs/:id — Retrieval by valid TC ID
// -------------------------------------------------------------------

describe('GET /api/v1/tcs/:id', () => {
  let createdTcId;

  beforeAll(async () => {
    const existing = await TC.findOne({
      tenantId: world.tenantId,
      studentId: ssismStudent._id,
    }).lean();
    createdTcId = String(existing._id);
  });

  test('successfully retrieves TC details using valid TC ID', async () => {
    const res = await request(app).get(`/api/v1/tcs/${createdTcId}`).set(tcClerkHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { tc, student, course, clearanceSummary } = res.body.data;
    expect(tc).toMatchObject({
      _id: createdTcId,
      studentId: String(ssismStudent._id),
      status: 'draft',
      reasonForLeaving: 'Course Completed',
      conduct: 'Excellent',
    });

    expect(student).toMatchObject({
      _id: String(ssismStudent._id),
      scholarNo: ssismStudent.scholarNo,
      name: ssismStudent.name,
    });
    expect(student.university).toHaveProperty('enrollmentLabel');

    expect(course).toMatchObject({
      shortCode: 'BCA',
    });

    expect(clearanceSummary).not.toBeNull();
    expect(clearanceSummary.isEligible).toBe(true);
  });

  test('returns 404 when retrieving TC from another institute scope', async () => {
    const res = await request(app).get(`/api/v1/tcs/${createdTcId}`).set(ssecTcClerkHeaders);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Verify ACCESS_DENIED_RECORD audit log entry
    const accessDenied = await AuditLog.findOne({
      tenantId: world.tenantId,
      action: AUDIT_ACTIONS.ACCESS_DENIED_RECORD,
      entityId: createdTcId,
    }).lean();
    expect(accessDenied).not.toBeNull();
  });

  test('returns 404 for a non-existent TC ID', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/api/v1/tcs/${fakeId}`).set(tcClerkHeaders);

    expect(res.status).toBe(404);
  });

  test('returns 400 for an invalid ObjectId format', async () => {
    const res = await request(app).get('/api/v1/tcs/not-a-valid-id').set(tcClerkHeaders);

    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------------------
// 3. PATCH /api/v1/tcs/:id — Draft update functionality
// -------------------------------------------------------------------

describe('PATCH /api/v1/tcs/:id', () => {
  let createdTcId;

  beforeAll(async () => {
    const existing = await TC.findOne({
      tenantId: world.tenantId,
      studentId: ssismStudent._id,
    }).lean();
    createdTcId = String(existing._id);
  });

  test('successfully updates draft fields reasonForLeaving and conduct', async () => {
    const res = await request(app).patch(`/api/v1/tcs/${createdTcId}`).set(tcClerkHeaders).send({
      reasonForLeaving: 'Family Relocation',
      conduct: 'Very Good',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      _id: createdTcId,
      reasonForLeaving: 'Family Relocation',
      conduct: 'Very Good',
      status: 'draft',
    });

    // Verify in database
    const updated = await TC.findOne({
      tenantId: world.tenantId,
      _id: createdTcId,
    }).lean();
    expect(updated.reasonForLeaving).toBe('Family Relocation');
    expect(updated.conduct).toBe('Very Good');

    // Verify audit log
    const updateAudit = await AuditLog.findOne({
      tenantId: world.tenantId,
      entity: 'tc',
      entityId: createdTcId,
      action: AUDIT_ACTIONS.UPDATE,
    }).lean();
    expect(updateAudit).not.toBeNull();
  });

  test('rejects update if TC status is not draft', async () => {
    // Temporarily set TC status to approved
    await TC.findOneAndUpdate(
      { tenantId: world.tenantId, _id: createdTcId },
      { status: 'approved' },
    );

    const res = await request(app).patch(`/api/v1/tcs/${createdTcId}`).set(tcClerkHeaders).send({
      reasonForLeaving: 'Attempting to edit approved TC',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/only draft/i);

    // Restore to draft for any remaining tests
    await TC.findOneAndUpdate({ tenantId: world.tenantId, _id: createdTcId }, { status: 'draft' });
  });

  test('rejects update from another institute scope with 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/tcs/${createdTcId}`)
      .set(ssecTcClerkHeaders)
      .send({
        conduct: 'Hacked',
      });

    expect(res.status).toBe(404);
  });

  test('rejects update with empty payload (min 1 field required)', async () => {
    const res = await request(app).patch(`/api/v1/tcs/${createdTcId}`).set(tcClerkHeaders).send({});

    expect(res.status).toBe(400);
  });
});

// -------------------------------------------------------------------
// 4. GET /api/v1/tcs — List TCs with filters and pagination
// -------------------------------------------------------------------

describe('GET /api/v1/tcs', () => {
  test('lists TCs with pagination and status filter', async () => {
    const res = await request(app)
      .get('/api/v1/tcs')
      .query({ status: 'draft', page: 1, limit: 10 })
      .set(tcClerkHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
    });
  });
});
