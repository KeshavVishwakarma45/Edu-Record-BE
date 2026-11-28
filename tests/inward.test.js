import request from 'supertest';
import { createApp } from '../src/app.js';
import { File } from '../src/modules/files/file.model.js';
import { University } from '../src/modules/institutes/university.model.js';
import { Affiliation } from '../src/modules/institutes/affiliation.model.js';
import { Student } from '../src/modules/students/student.model.js';
import { InwardDocument } from '../src/modules/inward/inward.model.js';
import { DOCUMENT_STATUSES } from '../src/constants/statuses.js';
import { GENDERS } from '../src/constants/genders.js';
import { CATEGORIES } from '../src/constants/categories.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, loginAs, headersFor } from './helpers/fixtures.js';

const app = createApp();

let world;
let ssismHeaders;

const validBatch = (overrides = {}) => ({
  universityId: String(world.affiliations.SSISM.universityId),
  courseId: String(world.courses.SSISM._id),
  examTerm: 'Semester 1',
  examSession: {
    month: 11,
    year: 2026,
  },
  documentType: 'Marksheet',
  receivedDate: '2026-11-20',
  ...overrides,
});

beforeAll(async () => {
  await startDb();

  world = await createWorld();

  const token = await loginAs(app, world.users.admin);

  ssismHeaders = {
    Authorization: `Bearer ${token}`,
    'X-Institute-Id': String(world.institutes.ssism._id),
  };
});

afterAll(async () => {
  await stopDb();
});

describe('Inward batch validation (INW-3)', () => {
  test('SSISM cannot create a batch using SSEC course', async () => {
    const res = await request(app)
      .post('/api/v1/inward-batches')
      .set(ssismHeaders)
      .send(
        validBatch({
          courseId: String(world.courses.SSEC._id),
        }),
      );

    expect(res.status).toBe(400);
  });

  test('SSISM cannot use a university not affiliated with it', async () => {
    const otherUniversity = await University.create({
      name: 'Other University',
      shortCode: 'OTHER',
      enrollmentLabel: 'Other Enrollment No.',
    });

    const res = await request(app)
      .post('/api/v1/inward-batches')
      .set(ssismHeaders)
      .send(
        validBatch({
          universityId: String(otherUniversity._id),
        }),
      );

    expect(res.status).toBe(400);
  });

  test('course and selected university affiliation must match', async () => {
    const anotherUniversity = await University.create({
      name: 'Another University',
      shortCode: 'ANOTHER',
      enrollmentLabel: 'Another University Enrollment No.',
    });

    await Affiliation.create({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      universityId: anotherUniversity._id,
      fromYear: 2020,
    });

    const res = await request(app)
      .post('/api/v1/inward-batches')
      .set(ssismHeaders)
      .send(
        validBatch({
          universityId: String(anotherUniversity._id),
        }),
      );

    expect(res.status).toBe(400);
  });

  test('SSISM cannot use a covering-letter file belonging to SSEC', async () => {
    const ssecFile = await File.create({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssec._id,
      storageKey: 'test/ssec-letter.png',
      originalName: 'letter.png',
      mimeType: 'image/png',
      size: 100,
    });

    const res = await request(app)
      .post('/api/v1/inward-batches')
      .set(ssismHeaders)
      .send(
        validBatch({
          coveringLetterFileId: String(ssecFile._id),
        }),
      );

    expect(res.status).toBe(400);
  });
});

describe('Inward batch and document workflow', () => {
  let studentA;
  let studentB;
  let ssecHeaders;
  let createdBatchId;

  beforeAll(async () => {
    ssecHeaders = await headersFor(app, world.users.admin, world.institutes.ssec);

    studentA = await Student.create({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      universityId: world.affiliations.SSISM.universityId,
      courseId: world.courses.SSISM._id,
      scholarNo: 'INW-STU-001',
      name: 'Student One',
      fatherName: 'Father One',
      motherName: 'Mother One',
      dob: new Date('2004-01-01'),
      gender: GENDERS.MALE,
      category: CATEGORIES.GEN,
      admissionDate: new Date('2023-07-01'),
    });

    studentB = await Student.create({
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
      universityId: world.affiliations.SSISM.universityId,
      courseId: world.courses.SSISM._id,
      scholarNo: 'INW-STU-002',
      name: 'Student Two',
      fatherName: 'Father Two',
      motherName: 'Mother Two',
      dob: new Date('2004-02-02'),
      gender: GENDERS.FEMALE,
      category: CATEGORIES.OBC,
      admissionDate: new Date('2023-07-01'),
    });
  });

  test('creates batch and automatically generates Expected InwardDocument rows (INW-1, INW-2)', async () => {
    const res = await request(app)
      .post('/api/v1/inward-batches')
      .set(ssismHeaders)
      .send(
        validBatch({
          referenceNumber: 'REF-FLOW-001',
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBeDefined();

    createdBatchId = res.body.data._id;

    // Verify InwardDocument rows were generated for both students
    const docs = await InwardDocument.find({
      tenantId: world.tenantId,
      batchId: createdBatchId,
    }).lean();

    expect(docs.length).toBe(2);
    expect(docs.every((d) => d.status === DOCUMENT_STATUSES.EXPECTED)).toBe(true);
  });

  test('GET /:id/students returns expected students with populated student data', async () => {
    const res = await request(app)
      .get(`/api/v1/inward-batches/${createdBatchId}/students`)
      .set(ssismHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].studentId.scholarNo).toBeDefined();
  });

  test('POST /:id/receipts marks expected document as In custody (INW-4)', async () => {
    const res = await request(app)
      .post(`/api/v1/inward-batches/${createdBatchId}/receipts`)
      .set(ssismHeaders)
      .send({
        studentId: String(studentA._id),
        documentSerialNo: 'SN-001',
        storageLocation: {
          almirah: 'ALM-1',
          fileNo: 'F-01',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(DOCUMENT_STATUSES.IN_CUSTODY);
  });

  test('POST /:id/receipts returns 409 if document is already received (atomic check)', async () => {
    const res = await request(app)
      .post(`/api/v1/inward-batches/${createdBatchId}/receipts`)
      .set(ssismHeaders)
      .send({
        studentId: String(studentA._id),
        documentSerialNo: 'SN-001-DUPLICATE',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('POST /:id/missing marks expected document as Not received (INW-4, SEC-19)', async () => {
    const res = await request(app)
      .post(`/api/v1/inward-batches/${createdBatchId}/missing`)
      .set(ssismHeaders)
      .send({
        studentId: String(studentB._id),
        reason: 'ABSENT',
        followUpDate: '2026-12-01',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(DOCUMENT_STATUSES.NOT_RECEIVED);
    expect(res.body.data.missingDetails.reason).toBe('ABSENT');
  });

  test('POST /:id/missing returns 409 if document is not in Expected status', async () => {
    const res = await request(app)
      .post(`/api/v1/inward-batches/${createdBatchId}/missing`)
      .set(ssismHeaders)
      .send({
        studentId: String(studentB._id),
        reason: 'NOT_PRINTED',
        followUpDate: '2026-12-15',
      });

    expect(res.status).toBe(409);
  });

  test('GET /:id/counts returns aggregate status counts (INW-7)', async () => {
    const res = await request(app)
      .get(`/api/v1/inward-batches/${createdBatchId}/counts`)
      .set(ssismHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      expected: 0,
      received: 1,
      missing: 1,
      total: 2,
    });
  });

  test('GET /:id/missing lists not received documents', async () => {
    const res = await request(app)
      .get(`/api/v1/inward-batches/${createdBatchId}/missing`)
      .set(ssismHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rows.length).toBe(1);
    expect(res.body.data.rows[0].missingDetails.reason).toBe('ABSENT');
  });

  test('cross-institute isolation: SSEC cannot access SSISM inward batch', async () => {
    const res = await request(app).get(`/api/v1/inward-batches/${createdBatchId}`).set(ssecHeaders);

    expect(res.status).toBe(404);
  });
});
