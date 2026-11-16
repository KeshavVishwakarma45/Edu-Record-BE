import ExcelJS from 'exceljs';
import request from 'supertest';

import { createApp } from '../src/app.js';

import { Student } from '../src/modules/students/student.model.js';
import { Course } from '../src/modules/courses/course.model.js';

import { CATEGORIES } from '../src/constants/categories.js';
import { GENDERS } from '../src/constants/genders.js';
import { COURSE_PATTERNS } from '../src/constants/coursePatterns.js';

import { startDb, stopDb } from './helpers/db.js';
import { createWorld, headersFor } from './helpers/fixtures.js';

const app = createApp();

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const COLUMNS = [
  'scholarNo',
  'enrollmentNo',
  'rollNo',
  'name',
  'fatherName',
  'motherName',
  'dob',
  'gender',
  'category',
  'religion',
  'address',
  'mobile',
  'admissionDate',
  'courseShortCode',
  'branch',
  'batch',
  'previousSchool',
  'status',
];

let world;
let headers;

async function createExcel(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');

  sheet.columns = COLUMNS.map((column) => ({
    header: column,
    key: column,
  }));

  rows.forEach((row) => sheet.addRow(row));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function validRow(overrides = {}) {
  return {
    scholarNo: 'SCH001',
    enrollmentNo: '',
    rollNo: '101',
    name: 'Test Student',
    fatherName: 'Test Father',
    motherName: 'Test Mother',
    dob: '2005-01-15',
    gender: GENDERS.FEMALE,
    category: CATEGORIES.OBC,
    religion: 'Hindu',
    address: 'Bhopal',
    mobile: '9876543210',
    admissionDate: '2024-07-01',
    courseShortCode: 'BCA',
    branch: '',
    batch: '2024-27',
    previousSchool: '',
    status: 'Studying',
    ...overrides,
  };
}

async function uploadExcel(rows) {
  const buffer = await createExcel(rows);

  return request(app).post('/api/v1/students/import').set(headers).attach('file', buffer, {
    filename: 'students.xlsx',
    contentType: XLSX_MIME,
  });
}

beforeAll(async () => {
  await startDb();

  world = await createWorld();

  headers = await headersFor(app, world.users.ssismAdmin, world.institutes.ssism);
});

afterAll(stopDb);

test('downloads Excel template with course short code when institute has multiple courses', async () => {
  // Add another course to ensure template works with multiple courses
  await Course.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    affiliationId: world.affiliations.SSISM._id,
    name: 'B.Tech Information Technology',
    shortCode: 'BTEMP',
    branch: 'Information Technology',
    pattern: COURSE_PATTERNS.YEAR,
    duration: 4,
  });

  const res = await request(app)
    .get('/api/v1/students/import-template')
    .set(headers)
    .buffer(true)
    .parse(parseExcelResponse);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain(XLSX_MIME);
  expect(res.headers['content-disposition']).toContain('students-import-template.xlsx');

  // Read the downloaded Excel file
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(res.body);

  const sheet = workbook.getWorksheet('Students');

  expect(sheet).toBeTruthy();
  const excelHeaders = sheet.getRow(1).values.slice(1);

  expect(excelHeaders).toContain('courseShortCode');
  expect(excelHeaders).not.toContain('courseId');

  // Template should contain a sample course short code
  const courseShortCodeColumn = excelHeaders.indexOf('courseShortCode') + 1;

  const sampleShortCode = sheet.getRow(2).getCell(courseShortCodeColumn).value;

  expect(sampleShortCode).toBeTruthy();
});
function parseExcelResponse(res, callback) {
  const chunks = [];

  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
test('imports student using course short code and automatically assigns courseId', async () => {
  const course = world.courses.SSISM;

  const res = await uploadExcel([
    validRow({
      scholarNo: 'SHORT001',
      courseShortCode: 'BCA',
    }),
  ]);

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  expect(res.body.data.imported).toBe(1);
  expect(res.body.data.failed).toBe(0);

  const student = await Student.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    scholarNo: 'SHORT001',
  }).lean();

  expect(student).toBeTruthy();

  // Excel short code must become actual MongoDB Course ID
  expect(String(student.courseId)).toBe(String(course._id));
});

test('matches course short code without case sensitivity', async () => {
  const course = world.courses.SSISM;

  const res = await uploadExcel([
    validRow({
      scholarNo: 'SHORT002',
      courseShortCode: 'bca',
    }),
  ]);

  expect(res.body.data.imported).toBe(1);

  const student = await Student.findOne({
    ...{
      tenantId: world.tenantId,
      instituteId: world.institutes.ssism._id,
    },
    scholarNo: 'SHORT002',
  }).lean();

  expect(String(student.courseId)).toBe(String(course._id));
});

test('selects the correct course using short code and branch', async () => {
  const course = await Course.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    affiliationId: world.affiliations.SSISM._id,
    name: 'B.Tech Computer Science',
    shortCode: 'BTECH',
    branch: 'Computer Science',
    pattern: COURSE_PATTERNS.YEAR,
    duration: 4,
  });

  const res = await uploadExcel([
    validRow({
      scholarNo: 'SHORT003',
      courseShortCode: 'BTECH',
      branch: 'Computer Science',
    }),
  ]);

  expect(res.body.data.imported).toBe(1);

  const student = await Student.findOne({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    scholarNo: 'SHORT003',
  }).lean();

  expect(String(student.courseId)).toBe(String(course._id));
});

test('rejects an invalid course short code', async () => {
  const res = await uploadExcel([
    validRow({
      scholarNo: 'SHORT004',
      courseShortCode: 'INVALID',
    }),
  ]);

  expect(res.body.data.imported).toBe(0);
  expect(res.body.data.failed).toBe(1);

  expect(res.body.data.errors[0].messages[0]).toContain('Invalid course short code');
});

test('rejects ambiguous short code when branch is not specified', async () => {
  await Course.create({
    tenantId: world.tenantId,
    instituteId: world.institutes.ssism._id,
    affiliationId: world.affiliations.SSISM._id,
    name: 'BCA Science',
    shortCode: 'BCA',
    branch: 'Science',
    pattern: COURSE_PATTERNS.YEAR,
    duration: 3,
  });

  const res = await uploadExcel([
    validRow({
      scholarNo: 'SHORT005',
      courseShortCode: 'BCA',
      branch: '',
    }),
  ]);

  expect(res.body.data.imported).toBe(0);
  expect(res.body.data.failed).toBe(1);

  expect(res.body.data.errors[0].messages[0]).toContain('ambiguous');
});
