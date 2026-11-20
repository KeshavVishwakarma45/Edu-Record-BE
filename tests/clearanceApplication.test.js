import request from 'supertest';

import { createApp } from '../src/app.js';

import { Student } from '../src/modules/students/student.model.js';
import { ClearanceApplication } from '../src/modules/clearance/clearanceApplication.model.js';
import { ClearanceItem } from '../src/modules/clearance/clearanceItem.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';
import { Department } from '../src/modules/institutes/department.model.js';
const app = createApp();

let world;
let headers;
let ssismStudent;
let ssecStudent;
let departmentHeaders;
let sportsDepartment;
let sportsItem;
let accountsDepartment;
let accountsItem;

const applicationBody = {
  lastClassAttended: 'B.Tech 4th Year',
  leavingReason: 'Higher Studies',
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
    name: 'Clearance Test Student',
    fatherName: 'Test Father',
    dob: new Date('2005-01-15'),
    gender: GENDERS.MALE,
    category: CATEGORIES.GEN,
    admissionDate: new Date('2024-07-01'),
    courseId: world.courses[instituteCode]._id,
  });
}
async function setRoleHeaders(user, role, departmentIds = []) {
  user.access[0].roleId = role._id;
  user.access[0].departmentIds = departmentIds;

  await user.save();

  return headersFor(app, user, world.institutes.ssism);
}
beforeAll(async () => {
  await startDb();

  world = await createWorld();

  headers = await headersFor(app, world.users.ssismTcClerk, world.institutes.ssism);

  ssismStudent = await createStudent('SSISM', 'CLR001');
  ssecStudent = await createStudent('SSEC', 'CLR002');
});

afterAll(stopDb);

test('TC Clerk creates application and clearance items for all institute departments', async () => {
  const res = await request(app)
    .post('/api/v1/clearance/applications')
    .set(headers)
    .send({
      ...applicationBody,
      studentId: String(ssismStudent._id),
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);

  expect(res.body.data.application.studentId).toBe(String(ssismStudent._id));
  expect(res.body.data.overallStatus).toBe('PENDING');

  const departments = await ClearanceItem.find({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: res.body.data.application._id,
  }).lean();

  const configuredDepartments = await import('../src/modules/institutes/department.model.js');

  const expectedCount = await configuredDepartments.Department.countDocuments({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
  });

  expect(departments).toHaveLength(expectedCount);

  expect(departments.every((item) => item.status === 'PENDING')).toBe(true);
  expect(departments.every((item) => item.amountDue === 0)).toBe(true);

  expect(res.body.data.clearanceItems).toHaveLength(expectedCount);
});

test('TC Clerk cannot submit another institute student', async () => {
  const res = await request(app)
    .post('/api/v1/clearance/applications')
    .set(headers)
    .send({
      ...applicationBody,
      studentId: String(ssecStudent._id),
    });

  expect(res.status).toBe(404);

  const count = await ClearanceApplication.countDocuments({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
  });

  expect(count).toBe(1);
});

test('database prevents duplicate clearance items for one application and department', async () => {
  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  });

  const originalItem = await ClearanceItem.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: application._id,
  }).lean();

  await expect(
    ClearanceItem.create({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      applicationId: application._id,
      studentId: ssismStudent._id,
      departmentId: originalItem.departmentId,
      status: 'PENDING',
    }),
  ).rejects.toMatchObject({ code: 11000 });
});

test('TC Clerk can list applications with student and department details', async () => {
  const res = await request(app)
    .get('/api/v1/clearance/applications')
    .query({
      search: 'CLR001',
      studentId: String(ssismStudent._id),
      page: 1,
      limit: 10,
    })
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.meta).toMatchObject({
    page: 1,
    limit: 10,
    total: 1,
  });

  expect(res.body.data).toHaveLength(1);

  const application = res.body.data[0];

  expect(application.student).toMatchObject({
    name: 'Clearance Test Student',
    scholarNo: 'CLR001',
  });

  expect(application).toHaveProperty('lastClassAttended');
  expect(application).toHaveProperty('leavingReason');
  expect(application).toHaveProperty('createdAt');

  expect(application.overallStatus).toBe('PENDING');

  expect(application.departmentWiseStatus).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        departmentName: 'Library',
        status: 'PENDING',
      }),
    ]),
  );
});

test('CLR-02 supports date filters and server-side pagination', async () => {
  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  }).lean();

  const applicationDate = application.createdAt.toISOString().slice(0, 10);

  const firstPage = await request(app)
    .get('/api/v1/clearance/applications')
    .query({
      fromDate: applicationDate,
      toDate: applicationDate,
      page: 1,
      limit: 1,
    })
    .set(headers);

  expect(firstPage.status).toBe(200);
  expect(firstPage.body.data).toHaveLength(1);
  expect(firstPage.body.meta.total).toBe(1);

  const secondPage = await request(app)
    .get('/api/v1/clearance/applications')
    .query({
      page: 2,
      limit: 1,
    })
    .set(headers);

  expect(secondPage.status).toBe(200);
  expect(secondPage.body.data).toHaveLength(0);
  expect(secondPage.body.meta.total).toBe(1);
});

test('CLR-02 calculates overall status from department-wise statuses', async () => {
  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  }).lean();

  const itemFilter = {
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: application._id,
  };

  await ClearanceItem.updateMany(itemFilter, {
    $set: { status: 'CLEAR' },
  });

  const clearResponse = await request(app)
    .get('/api/v1/clearance/applications')
    .query({ studentId: String(ssismStudent._id) })
    .set(headers);

  expect(clearResponse.status).toBe(200);
  expect(clearResponse.body.data[0].overallStatus).toBe('CLEAR');

  await ClearanceItem.updateMany(itemFilter, {
    $set: { status: 'NOT_CLEAR' },
  });

  const notClearResponse = await request(app)
    .get('/api/v1/clearance/applications')
    .query({ studentId: String(ssismStudent._id) })
    .set(headers);

  expect(notClearResponse.status).toBe(200);
  expect(notClearResponse.body.data[0].overallStatus).toBe('NOT_CLEAR');
});

test('CLR-02 does not expose applications from another institute', async () => {
  const res = await request(app)
    .get('/api/v1/clearance/applications')
    .query({
      studentId: String(ssecStudent._id),
    })
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body.data).toHaveLength(0);
  expect(res.body.meta.total).toBe(0);
});

test('Department In-charge sees only assigned queue and can update own department item', async () => {
  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  }).lean();

  sportsDepartment = await Department.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    name: 'Sports',
  });

  sportsItem = await ClearanceItem.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: application._id,
    studentId: ssismStudent._id,
    departmentId: sportsDepartment._id,
    status: 'PENDING',
    amountDue: 450,
  });

  departmentHeaders = await setRoleHeaders(
    world.users.ssismAdmin,
    world.roles.SSISM['Department In-charge'],
    [world.departments.SSISM._id],
  );

  const queue = await request(app).get('/api/v1/clearance/queue').set(departmentHeaders);

  expect(queue.status).toBe(200);
  expect(queue.body.data).toHaveLength(1);
  expect(queue.body.data[0].departmentName).toBe('Library');
  expect(queue.body.data[0].student.name).toBe('Clearance Test Student');

  const forbiddenQueue = await request(app)
    .get('/api/v1/clearance/queue')
    .query({ departmentId: String(sportsDepartment._id) })
    .set(departmentHeaders);

  expect(forbiddenQueue.status).toBe(403);

  const libraryItem = await ClearanceItem.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: application._id,
    departmentId: world.departments.SSISM._id,
  });

  const update = await request(app)
    .patch(`/api/v1/clearance/items/${libraryItem._id}`)
    .set(departmentHeaders)
    .send({
      status: 'CLEAR',
      remark: 'Library clearance completed',
    });

  expect(update.status).toBe(200);
  expect(update.body.data.status).toBe('CLEAR');
  expect(update.body.data.remark).toBe('Library clearance completed');
  expect(update.body.data.statusUpdatedBy).toBe(String(world.users.ssismAdmin._id));
  expect(update.body.data.statusUpdatedAt).toBeTruthy();

  const forbiddenUpdate = await request(app)
    .patch(`/api/v1/clearance/items/${sportsItem._id}`)
    .set(departmentHeaders)
    .send({ status: 'CLEAR' });

  expect(forbiddenUpdate.status).toBe(404);
});

test('CLR-04 returns student profile with application and department-wise status', async () => {
  const res = await request(app).get(`/api/v1/clearance/students/${ssismStudent._id}`).set(headers);

  expect(res.status).toBe(200);

  expect(res.body.data.student).toMatchObject({
    name: 'Clearance Test Student',
    scholarNo: 'CLR001',
  });

  expect(res.body.data.applications).toHaveLength(1);

  const application = res.body.data.applications[0];

  expect(application).toHaveProperty('overallStatus');
  expect(application.departmentWiseStatus).toHaveLength(2);

  expect(application.departmentWiseStatus).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ departmentName: 'Library', status: 'CLEAR' }),
      expect.objectContaining({ departmentName: 'Sports', status: 'PENDING' }),
    ]),
  );

  expect(application.overallStatus).toBe('PENDING');
});

test('Accounts can view and update pending dues, while department in-charge cannot access accounts dues', async () => {
  const accountsHeaders = await setRoleHeaders(
    world.users.ssismPrincipal,
    world.roles.SSISM.Accounts,
  );

  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  }).lean();

  expect(application).not.toBeNull();

  accountsDepartment = await Department.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    name: 'Accounts Department',
  });

  accountsItem = await ClearanceItem.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: application._id,
    studentId: ssismStudent._id,
    departmentId: accountsDepartment._id,
    status: 'PENDING',
    amountDue: 450,
  });

  const pendingDues = await request(app)
    .get('/api/v1/clearance/accounts/pending-dues')
    .query({ search: 'CLR001' })
    .set(accountsHeaders);

  expect(pendingDues.status).toBe(200);

  expect(pendingDues.body.data).toHaveLength(1);

  expect(pendingDues.body.data.every((item) => item.departmentName === 'Accounts Department')).toBe(
    true,
  );

  expect(pendingDues.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        amountDue: 450,
        departmentName: 'Accounts Department',
      }),
    ]),
  );

  const pendingCount = await request(app)
    .get('/api/v1/clearance/accounts/pending-count')
    .set(accountsHeaders);

  expect(pendingCount.status).toBe(200);
  expect(pendingCount.body.data.pendingCount).toBe(1);

  const forbiddenCount = await request(app)
    .get('/api/v1/clearance/accounts/pending-count')
    .set(departmentHeaders);

  expect(forbiddenCount.status).toBe(403);

  const forbiddenDues = await request(app)
    .get('/api/v1/clearance/accounts/pending-dues')
    .set(departmentHeaders);

  expect(forbiddenDues.status).toBe(403);

  const forbiddenDuesUpdate = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}/dues`)
    .set(departmentHeaders)
    .send({ amountDue: 0 });

  expect(forbiddenDuesUpdate.status).toBe(403);

  const forbiddenSportsUpdate = await request(app)
    .patch(`/api/v1/clearance/items/${sportsItem._id}/dues`)
    .set(accountsHeaders)
    .send({ amountDue: 0 });

  expect(forbiddenSportsUpdate.status).toBe(404);

  const update = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}/dues`)
    .set(accountsHeaders)
    .send({
      amountDue: 0,
      remark: 'Outstanding dues paid',
    });

  expect(update.status).toBe(200);
  expect(update.body.data.amountDue).toBe(0);
  expect(update.body.data.remark).toBe('Outstanding dues paid');

  const afterUpdate = await request(app)
    .get('/api/v1/clearance/accounts/pending-dues')
    .query({ search: 'CLR001' })
    .set(accountsHeaders);

  expect(afterUpdate.status).toBe(200);
  expect(afterUpdate.body.data).toHaveLength(0);

  const countAfterPayment = await request(app)
    .get('/api/v1/clearance/accounts/pending-count')
    .set(accountsHeaders);

  expect(countAfterPayment.status).toBe(200);
  expect(countAfterPayment.body.data.pendingCount).toBe(0);
});

test('Accounts can process only Accounts Department clearance', async () => {
  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  }).lean();

  expect(application).not.toBeNull();

  expect(accountsDepartment).toBeDefined();
  expect(accountsItem).toBeDefined();

  const accountsHeaders = await setRoleHeaders(
    world.users.ssismPrincipal,
    world.roles.SSISM.Accounts,
  );

  // Accounts can mark its own department CLEAR.
  const clearResponse = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}`)
    .set(accountsHeaders)
    .send({ status: 'CLEAR' });

  expect(clearResponse.status).toBe(200);
  expect(clearResponse.body.data.status).toBe('CLEAR');

  // NOT_CLEAR requires a remark.
  const missingRemarkResponse = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}`)
    .set(accountsHeaders)
    .send({ status: 'NOT_CLEAR' });

  expect(missingRemarkResponse.status).toBe(400);

  // Accounts can update status, remark and pending amount.
  const notClearResponse = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}`)
    .set(accountsHeaders)
    .send({
      status: 'NOT_CLEAR',
      remark: 'Outstanding fees pending',
      amountDue: 1250.75,
    });

  expect(notClearResponse.status).toBe(200);
  expect(notClearResponse.body.data).toMatchObject({
    status: 'NOT_CLEAR',
    remark: 'Outstanding fees pending',
    amountDue: 1250.75,
  });

  // Accounts cannot update Sports clearance.
  const accountsSportsResponse = await request(app)
    .patch(`/api/v1/clearance/items/${sportsItem._id}`)
    .set(accountsHeaders)
    .send({ status: 'CLEAR' });

  expect(accountsSportsResponse.status).toBe(404);

  // Department In-charge assigned to Library cannot update Accounts clearance.
  const departmentAccountsResponse = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}`)
    .set(departmentHeaders)
    .send({ status: 'CLEAR' });

  expect(departmentAccountsResponse.status).toBe(404);

  // Prepare a clearance item belonging to SSEC.
  const ssecApplication = await ClearanceApplication.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssec._id,
    studentId: ssecStudent._id,
    lastClassAttended: applicationBody.lastClassAttended,
    leavingReason: applicationBody.leavingReason,
    documentsEnclosed: applicationBody.documentsEnclosed,
    declarations: applicationBody.declarations,
  });

  const ssecItem = await ClearanceItem.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssec._id,
    applicationId: ssecApplication._id,
    studentId: ssecStudent._id,
    departmentId: world.departments.SSEC._id,
    status: 'PENDING',
    amountDue: 1000,
  });

  // SSISM Accounts cannot update an SSEC record.
  const crossInstituteResponse = await request(app)
    .patch(`/api/v1/clearance/items/${ssecItem._id}`)
    .set(accountsHeaders)
    .send({ status: 'CLEAR' });

  expect(crossInstituteResponse.status).toBe(404);

  // SSISM Accounts cannot switch to an institute without access.
  const switchedInstituteResponse = await request(app)
    .patch(`/api/v1/clearance/items/${ssecItem._id}`)
    .set({
      ...accountsHeaders,
      'X-Institute-Id': String(world.institutes.ssec._id),
    })
    .send({ status: 'CLEAR' });

  expect(switchedInstituteResponse.status).toBe(403);
});

test('Accounts history is limited to Accounts Department and supports filters', async () => {
  const accountsHeaders = await setRoleHeaders(
    world.users.ssismPrincipal,
    world.roles.SSISM.Accounts,
  );

  // Create an auditable Accounts Department update.
  const update = await request(app)
    .patch(`/api/v1/clearance/items/${accountsItem._id}`)
    .set(accountsHeaders)
    .send({
      remark: 'Accounts history test update',
      amountDue: 888.25,
    });

  expect(update.status).toBe(200);

  const history = await request(app)
    .get('/api/v1/clearance/accounts/history')
    .query({
      studentId: String(ssismStudent._id),
      status: 'NOT_CLEAR',
      page: 1,
      limit: 10,
    })
    .set(accountsHeaders);

  expect(history.status).toBe(200);
  expect(history.body.success).toBe(true);
  expect(history.body.meta.total).toBeGreaterThanOrEqual(1);

  expect(history.body.data.every((row) => row.department?.name === 'Accounts Department')).toBe(
    true,
  );

  expect(history.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        department: expect.objectContaining({
          name: 'Accounts Department',
        }),
        current: expect.objectContaining({
          status: 'NOT_CLEAR',
          remarks: 'Accounts history test update',
          amountDue: 888.25,
        }),
        performedBy: expect.objectContaining({
          name: expect.any(String),
          email: expect.any(String),
        }),
        timestamp: expect.any(String),
      }),
    ]),
  );

  // Department In-charge cannot read institute-level Accounts history.
  const departmentResponse = await request(app)
    .get('/api/v1/clearance/accounts/history')
    .set(departmentHeaders);

  expect(departmentResponse.status).toBe(403);

  // TC Clerk does not have the required clearance action permission.
  const tcClerkResponse = await request(app).get('/api/v1/clearance/accounts/history').set(headers);

  expect(tcClerkResponse.status).toBe(403);

  // Accounts cannot switch to an institute without access.
  const crossInstituteResponse = await request(app)
    .get('/api/v1/clearance/accounts/history')
    .set({
      ...accountsHeaders,
      'X-Institute-Id': String(world.institutes.ssec._id),
    });

  expect(crossInstituteResponse.status).toBe(403);
});

test('Department In-charge APIs are department-scoped and record history', async () => {
  const application = await ClearanceApplication.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    studentId: ssismStudent._id,
  }).lean();

  const libraryItem = await ClearanceItem.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    applicationId: application._id,
    departmentId: world.departments.SSISM._id,
  });

  // 1. Application details: only the assigned department is returned.
  const details = await request(app)
    .get(`/api/v1/clearance/applications/${application._id}`)
    .set(departmentHeaders);

  expect(details.status).toBe(200);
  expect(details.body.success).toBe(true);

  expect(details.body.data.student).toMatchObject({
    name: 'Clearance Test Student',
    scholarNo: 'CLR001',
  });

  expect(details.body.data.application.documentsEnclosed.tenthMarksheet).toBe(true);
  expect(details.body.data.application.submittedDocuments).toContain('tenthMarksheet');

  expect(details.body.data.departmentClearances).toHaveLength(1);
  expect(details.body.data.departmentClearances[0].department.name).toBe('Library');
  expect(details.body.data.departmentClearances[0].verificationStatus).toBe('CLEAR');

  // 2. Pending count is calculated for assigned departments only.
  const pendingCount = await request(app)
    .get('/api/v1/clearance/queue/pending-count')
    .set(departmentHeaders);

  expect(pendingCount.status).toBe(200);
  expect(pendingCount.body.data.pendingCount).toBe(0);

  // 3. Frontend dateFrom/dateTo aliases work.
  const queue = await request(app)
    .get('/api/v1/clearance/queue')
    .query({
      dateFrom: application.createdAt.toISOString().slice(0, 10),
      dateTo: application.createdAt.toISOString().slice(0, 10),
    })
    .set(departmentHeaders);

  expect(queue.status).toBe(200);
  expect(queue.body.data).toHaveLength(1);

  // 4. NOT_CLEAR must contain a reason.
  const missingReason = await request(app)
    .patch(`/api/v1/clearance/items/${libraryItem._id}`)
    .set(departmentHeaders)
    .send({ status: 'NOT_CLEAR' });

  expect(missingReason.status).toBe(400);

  // 5. Remarks can be updated without changing the status.
  const remarkOnly = await request(app)
    .patch(`/api/v1/clearance/items/${libraryItem._id}`)
    .set(departmentHeaders)
    .send({ remark: 'Rechecked by Library' });

  expect(remarkOnly.status).toBe(200);
  expect(remarkOnly.body.data.status).toBe('CLEAR');
  expect(remarkOnly.body.data.remark).toBe('Rechecked by Library');

  // 6. Mark the item NOT_CLEAR with a mandatory reason.
  const markNotClear = await request(app)
    .patch(`/api/v1/clearance/items/${libraryItem._id}`)
    .set(departmentHeaders)
    .send({
      status: 'NOT_CLEAR',
      remark: 'Library book has not been returned',
    });

  expect(markNotClear.status).toBe(200);
  expect(markNotClear.body.data.status).toBe('NOT_CLEAR');

  // 7. Verify that the application details show the latest status.
  const updatedDetails = await request(app)
    .get(`/api/v1/clearance/applications/${application._id}`)
    .set(departmentHeaders);

  expect(updatedDetails.status).toBe(200);
  expect(updatedDetails.body.data.departmentClearances[0]).toMatchObject({
    verificationStatus: 'NOT_CLEAR',
    remarks: 'Library book has not been returned',
  });

  // 8. History contains the department's status update.
  const history = await request(app)
    .get('/api/v1/clearance/history')
    .query({
      studentId: String(ssismStudent._id),
      status: 'NOT_CLEAR',
      page: 1,
      limit: 10,
    })
    .set(departmentHeaders);

  expect(history.status).toBe(200);
  expect(history.body.success).toBe(true);
  expect(history.body.meta.total).toBeGreaterThanOrEqual(1);

  expect(history.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        department: expect.objectContaining({ name: 'Library' }),
        current: expect.objectContaining({
          status: 'NOT_CLEAR',
          remarks: 'Library book has not been returned',
        }),
      }),
    ]),
  );

  // 9. Initial PENDING creation event is available in history.
  const creationHistory = await request(app)
    .get('/api/v1/clearance/history')
    .query({
      studentId: String(ssismStudent._id),
      status: 'PENDING',
      page: 1,
      limit: 10,
    })
    .set(departmentHeaders);

  expect(creationHistory.status).toBe(200);

  expect(creationHistory.body.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: 'CREATE',
        department: expect.objectContaining({ name: 'Library' }),
        current: expect.objectContaining({ status: 'PENDING' }),
      }),
    ]),
  );
});

test('Department In-charge cannot access institute-wide applications or student profiles', async () => {
  const applications = await request(app)
    .get('/api/v1/clearance/applications')
    .set(departmentHeaders);

  expect(applications.status).toBe(403);

  const studentProfile = await request(app)
    .get(`/api/v1/clearance/students/${ssismStudent._id}`)
    .set(departmentHeaders);

  expect(studentProfile.status).toBe(403);
});

test('Department In-charge without exactly one department assignment is denied', async () => {
  const departmentRole = world.roles.SSISM['Department In-charge'];

  const unassignedHeaders = await setRoleHeaders(world.users.ssismAdmin, departmentRole, []);

  const unassignedQueue = await request(app).get('/api/v1/clearance/queue').set(unassignedHeaders);

  expect(unassignedQueue.status).toBe(403);

  const unassignedApplications = await request(app)
    .get('/api/v1/clearance/applications')
    .set(unassignedHeaders);

  expect(unassignedApplications.status).toBe(403);

  const unassignedStudentProfile = await request(app)
    .get(`/api/v1/clearance/students/${ssismStudent._id}`)
    .set(unassignedHeaders);

  expect(unassignedStudentProfile.status).toBe(403);

  const unassignedAccounts = await request(app)
    .get('/api/v1/clearance/accounts/pending-dues')
    .set(unassignedHeaders);

  expect(unassignedAccounts.status).toBe(403);

  const multipleDepartmentHeaders = await setRoleHeaders(world.users.ssismAdmin, departmentRole, [
    world.departments.SSISM._id,
    sportsDepartment._id,
  ]);

  const multipleDepartmentQueue = await request(app)
    .get('/api/v1/clearance/queue')
    .set(multipleDepartmentHeaders);

  expect(multipleDepartmentQueue.status).toBe(403);
});
