import ExcelJS from 'exceljs';

import { Student } from './student.model.js';
import { Course } from '../courses/course.model.js';

import { studentImportRowSchema } from './student.validation.js';

import { scoped } from '../../utils/scoped.js';
import { withTransaction } from '../../utils/transaction.js';
import { audit } from '../../utils/audit.js';

import { AUDIT_ACTIONS } from '../../constants/auditActions.js';

// Excel template columns
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
  'courseId',
  'branch',
  'batch',
  'previousSchool',
  'status',
];

// Convert Excel cell values into simple values
function getCellValue(value) {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'object') {
    if (value.text !== undefined) return value.text;
    if (value.result !== undefined) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join('');
    }
  }

  return typeof value === 'string' ? value.trim() : value;
}

// Generate the downloadable Excel template
export async function downloadImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');

  sheet.columns = COLUMNS.map((column) => ({
    header: column,
    key: column,
    width: 22,
  }));

  sheet.getRow(1).font = { bold: true };

  sheet.addRow({
    scholarNo: 'SCH001',
    enrollmentNo: '',
    rollNo: '101',
    name: 'Rahul Sharma',
    fatherName: 'Ramesh Sharma',
    motherName: 'Sunita Sharma',
    dob: '2005-01-15',
    gender: 'Male',
    category: 'GEN',
    religion: 'Hindu',
    address: 'Bhopal',
    mobile: '9876543210',
    admissionDate: '2024-07-01',
    courseId: 'PASTE_VALID_COURSE_ID',
    branch: '',
    batch: '2024-27',
    previousSchool: '',
    status: 'Studying',
  });

  return workbook.xlsx.writeBuffer();
}

// Import students from an uploaded Excel file
export async function importStudents(req) {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(req.file.buffer);

  const sheet = workbook.getWorksheet('Students') || workbook.worksheets[0];

  if (!sheet || sheet.rowCount < 2) {
    return {
      totalRows: 0,
      imported: 0,
      failed: 0,
      errors: [],
    };
  }

  const headers = sheet.getRow(1).values.slice(1);

  const missingHeaders = COLUMNS.filter((column) => !headers.includes(column));

  if (missingHeaders.length) {
    return {
      totalRows: 0,
      imported: 0,
      failed: 0,
      errors: [
        {
          row: 1,
          message: `Missing columns: ${missingHeaders.join(', ')}`,
        },
      ],
    };
  }

  const errors = [];
  const imported = [];
  const scholarNumbers = new Set();
  const enrollmentNumbers = new Set();

  let totalRows = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);

    const data = {};

    COLUMNS.forEach((column) => {
      const columnIndex = headers.indexOf(column) + 1;
      data[column] = getCellValue(row.getCell(columnIndex).value);
    });

    if (Object.values(data).every((value) => value === '')) {
      continue;
    }

    totalRows++;

    const { error, value } = studentImportRowSchema.validate(data, {
      abortEarly: false,
      convert: true,
    });

    if (error) {
      errors.push({
        row: rowNumber,
        messages: error.details.map((item) => item.message),
      });
      continue;
    }

    const studentData = {
      ...value,
      enrollmentNo: value.enrollmentNo || null,
    };

    const scholarKey = studentData.scholarNo.toLowerCase();

    const enrollmentKey = studentData.enrollmentNo?.toLowerCase();

    if (scholarNumbers.has(scholarKey)) {
      errors.push({
        row: rowNumber,
        messages: ['Duplicate scholar number in this Excel file'],
      });
      continue;
    }

    if (enrollmentKey && enrollmentNumbers.has(enrollmentKey)) {
      errors.push({
        row: rowNumber,
        messages: ['Duplicate enrollment number in this Excel file'],
      });
      continue;
    }

    try {
      // Check that the selected course belongs to this institute
      const course = await Course.findOne({
        ...scoped(req),
        _id: studentData.courseId,
      })
        .populate({
          path: 'affiliationId',
          match: {
            tenantId: req.scope.tenantId,
            instituteId: req.scope.instituteId,
          },
        })
        .lean();

      if (!course || !course.affiliationId) {
        errors.push({
          row: rowNumber,
          messages: ['Invalid course or institute affiliation'],
        });
        continue;
      }

      const universityId = course.affiliationId.universityId;

      const existingScholar = await Student.findOne({
        ...scoped(req),
        scholarNo: studentData.scholarNo,
      }).lean();

      if (existingScholar) {
        errors.push({
          row: rowNumber,
          messages: ['Scholar number already exists in this institute'],
        });
        continue;
      }

      if (studentData.enrollmentNo) {
        const existingEnrollment = await Student.findOne({
          tenantId: req.scope.tenantId,
          universityId,
          enrollmentNo: studentData.enrollmentNo,
        }).lean();

        if (existingEnrollment) {
          errors.push({
            row: rowNumber,
            messages: ['Enrollment number already exists in this university'],
          });
          continue;
        }
      }

      const student = await withTransaction(async (session) => {
        const [createdStudent] = await Student.create(
          [
            {
              ...studentData,
              universityId,
              ...scoped(req),
              createdBy: req.user.id,
              updatedBy: req.user.id,
            },
          ],
          { session, ordered: true },
        );

        await audit(
          req,
          AUDIT_ACTIONS.CREATE,
          'student',
          createdStudent._id,
          null,
          createdStudent,
          session,
        );

        return createdStudent;
      });

      imported.push(student);

      scholarNumbers.add(scholarKey);

      if (enrollmentKey) {
        enrollmentNumbers.add(enrollmentKey);
      }
    } catch (err) {
      if (err.code === 11000) {
        errors.push({
          row: rowNumber,
          messages: ['Duplicate student record'],
        });
        continue;
      }

      throw err;
    }
  }

  return {
    totalRows,
    imported: imported.length,
    failed: errors.filter((item) => item.row !== 1).length,
    errors,
  };
}
