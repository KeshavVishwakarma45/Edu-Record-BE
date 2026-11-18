import request from 'supertest';
import { createApp } from '../src/app.js';

import { Student } from '../src/modules/students/student.model.js';
import { InwardBatch, InwardDocument } from '../src/modules/inward/inward.model.js';
import { TC } from '../src/modules/tc/tc.model.js';
import { ClearanceApplication } from '../src/modules/clearance/clearanceApplication.model.js';
import { ClearanceItem } from '../src/modules/clearance/clearanceItem.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';
import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';
import { CLEARANCE_STATUSES } from '../src/constants/clearanceStatuses.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor, loginAs } from './helpers/fixtures.js';
const app = createApp();

let world;
let superAdminAllHeaders;
let principalHeaders;
let tcClerkHeaders;
let ssismStudent;
let ssecStudent;
let inwardBatch;
let issuedTc;

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

async function createClearanceApplication(student, instituteCode = 'SSISM') {
  const institute = world.institutes[instituteCode.toLowerCase() === 'ssism' ? 'ssism' : 'ssec'];

  return ClearanceApplication.create({
    tenantId: world.tenantId,
    instituteId: institute._id,
    studentId: student._id,
    lastClassAttended: 'BCA 3rd Year',
    leavingReason: 'Course Completed',
  });
}

async function createTc(student, application, status, suffix) {
  const institute = world.institutes.ssism;
  const now = new Date();

  return TC.create({
    tenantId: world.tenantId,
    instituteId: institute._id,
    studentId: student._id,
    clearanceApplicationId: application._id,
    status,
    refNo: `TC-${suffix}`,
    bookSerial: `BOOK-${suffix}`,
    submittedAt: now,
    approvedAt: status === 'approved' || status === 'issued' ? now : null,
    issuedAt: status === 'issued' ? now : null,
    receivedBy: status === 'issued' ? 'Student本人' : null,
  });
}

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  const superAdminToken = await loginAs(app, world.users.superAdmin);

  superAdminAllHeaders = {
    Authorization: `Bearer ${superAdminToken}`,
    'X-Institute-Id': 'all',
  };
  principalHeaders = await headersFor(app, world.users.ssismPrincipal, world.institutes.ssism);

  tcClerkHeaders = await headersFor(app, world.users.ssismTcClerk, world.institutes.ssism);

  ssismStudent = await createStudent('SSISM', 'DASH-SSISM-001');
  ssecStudent = await createStudent('SSEC', 'DASH-SSEC-001');

  // Inward batch with one received and one missing document.
  inwardBatch = await InwardBatch.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    universityId: world.affiliations.SSISM.universityId,
    courseId: world.courses.SSISM._id,
    examTerm: 'Semester 1',
    examSession: { month: 6, year: 2026 },
    documentType: 'Marksheet',
    receivedDate: new Date(),
    receivedBy: world.users.ssismPrincipal._id,
    referenceNumber: 'INWARD-DASH-001',
  });

  await InwardDocument.create([
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      batchId: inwardBatch._id,
      studentId: ssismStudent._id,
      documentType: 'Marksheet',
      status: DOCUMENT_STATUSES.IN_CUSTODY,
    },
    {
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      batchId: inwardBatch._id,
      studentId: ssismStudent._id,
      documentType: 'Marksheet',
      status: DOCUMENT_STATUSES.NOT_RECEIVED,
      missingDetails: { reason: 'NOT_PRINTED' },
    },
  ]);

  // A blocked clearance application.
  const blockedApplication = await createClearanceApplication(ssismStudent);

  await ClearanceItem.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: blockedApplication._id,
    studentId: ssismStudent._id,
    departmentId: world.departments.SSISM._id,
    status: CLEARANCE_STATUSES.PENDING,
  });

  // TC records for the attention dashboard.
  const pendingApplication = await createClearanceApplication(ssismStudent);
  await createTc(ssismStudent, pendingApplication, 'pending_approval', 'PENDING');

  const approvedApplication = await createClearanceApplication(ssismStudent);
  await createTc(ssismStudent, approvedApplication, 'approved', 'APPROVED');

  // An issued TC for the recent-TCs endpoint.
  const issuedApplication = await createClearanceApplication(ssismStudent);
  issuedTc = await createTc(ssismStudent, issuedApplication, 'issued', 'ISSUED');

  // Data in the second institute verifies institute-level isolation.
  const ssecBatch = await InwardBatch.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssec._id,
    universityId: world.affiliations.SSEC.universityId,
    courseId: world.courses.SSEC._id,
    examTerm: 'Semester 1',
    examSession: { month: 6, year: 2026 },
    documentType: 'Marksheet',
    receivedDate: new Date(),
    receivedBy: world.users.admin._id,
    referenceNumber: 'INWARD-SSEC-001',
  });

  await InwardDocument.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssec._id,
    batchId: ssecBatch._id,
    studentId: ssecStudent._id,
    documentType: 'Marksheet',
    status: DOCUMENT_STATUSES.NOT_RECEIVED,
  });
});

afterAll(async () => {
  await stopDb();
});

describe('Dashboard API authentication and access', () => {
  test('rejects unauthenticated dashboard requests', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('allows a TC Clerk to view dashboard summary', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary').set(tcClerkHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/v1/dashboard/summary', () => {
  test('returns dashboard counts for the selected institute', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary').set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      documentsNotReceived: 1,
      documentsInCustody: 1,
      clearancePending: 1,
      tcsAwaitingPrincipalApproval: 1,
      approvedTcsNotHandedOver: 1,
    });
  });

  test('does not include another institute data in summary counts', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary').set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.documentsNotReceived).toBe(1);
  });
});

describe('GET /api/v1/dashboard/attention', () => {
  test('returns attention items from the permitted dashboard sections', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/attention?limit=20')
      .set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(4);

    const types = res.body.data.items.map((item) => item.type);

    expect(types).toContain('TC_PENDING_APPROVAL');
    expect(types).toContain('DOCUMENT_NOT_RECEIVED');
    expect(types).toContain('CLEARANCE_BLOCKED');
    expect(types).toContain('TC_APPROVED_NOT_HANDED_OVER');
  });

  test('respects the attention limit', async () => {
    const res = await request(app).get('/api/v1/dashboard/attention?limit=2').set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(2);
    expect(res.body.data.items).toHaveLength(2);
  });

  test('rejects an attention limit above the maximum', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/attention?limit=21')
      .set(principalHeaders);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/dashboard/recent-inward', () => {
  test('returns recent inward batches with document counts', async () => {
    const res = await request(app).get('/api/v1/dashboard/recent-inward').set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      batchId: String(inwardBatch._id),
      documentType: 'Marksheet',
      referenceNumber: 'INWARD-DASH-001',
      receivedCount: 1,
      totalExpected: 2,
      missingCount: 1,
    });
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
    });
  });

  test('supports pagination query parameters', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent-inward?page=1&limit=5')
      .set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 5,
      total: 1,
    });
  });

  test('does not return another institute inward batches', async () => {
    const res = await request(app).get('/api/v1/dashboard/recent-inward').set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].referenceNumber).toBe('INWARD-DASH-001');
  });
});

describe('GET /api/v1/dashboard/recent-tcs', () => {
  test('returns recently issued TCs with student details', async () => {
    const res = await request(app).get('/api/v1/dashboard/recent-tcs').set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      tcId: String(issuedTc._id),
      referenceNumber: 'TC-ISSUED',
      bookSerial: 'BOOK-ISSUED',
      studentId: String(ssismStudent._id),
      studentName: ssismStudent.name,
      scholarNo: ssismStudent.scholarNo,
      collectedBy: 'Student本人',
    });
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
    });
  });

  test('supports pagination query parameters', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent-tcs?page=1&limit=5')
      .set(principalHeaders);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 5,
      total: 1,
    });
  });
});

describe('Dashboard Super Admin all-institutes access', () => {
  test('returns combined summary for both institutes', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary').set(superAdminAllHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(res.body.data).toMatchObject({
      documentsNotReceived: 2,
      documentsInCustody: 1,
      clearancePending: 1,
      tcsAwaitingPrincipalApproval: 1,
      approvedTcsNotHandedOver: 1,
    });
  });

  test('returns inward batches from both institutes', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent-inward?limit=100')
      .set(superAdminAllHeaders);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const references = res.body.data.map((item) => item.referenceNumber);

    expect(references).toContain('INWARD-DASH-001');
    expect(references).toContain('INWARD-SSEC-001');
  });

  test('filters dashboard summary by instituteId', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/summary?instituteId=${world.institutes.ssec._id}`)
      .set(superAdminAllHeaders);

    expect(res.status).toBe(200);

    expect(res.body.data).toMatchObject({
      documentsNotReceived: 1,
      documentsInCustody: 0,
      clearancePending: 0,
      tcsAwaitingPrincipalApproval: 0,
      approvedTcsNotHandedOver: 0,
    });
  });

  test('does not allow a normal admin to access all institutes', async () => {
    const adminToken = await loginAs(app, world.users.admin);

    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set({
        Authorization: `Bearer ${adminToken}`,
        'X-Institute-Id': 'all',
      });

    expect(res.status).toBe(403);
  });
});
