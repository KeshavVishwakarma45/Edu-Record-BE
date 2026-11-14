import ExcelJS from 'exceljs';

import { University } from '../institutes/university.model.js';

import { ApiError } from '../../utils/ApiError.js';
import { File } from '../files/file.model.js';
import * as storage from '../../utils/storage.js';

import { Student } from './student.model.js';
import { Course } from '../courses/course.model.js';
import { studentImportRowSchema } from './student.validation.js';

import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { withTransaction } from '../../utils/transaction.js';
import { audit } from '../../utils/audit.js';

import { AUDIT_ACTIONS } from '../../constants/auditActions.js';

const ENTITY = 'student';

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

// Student Listing API
export async function list(req) {
  const { search, sort, page, limit, courseId, status, gender, category, batch } = req.query;

  const filter = {
    ...scoped(req),
    ...searchFilter(search, [
      'name',
      'fatherName',
      'scholarNo',
      'enrollmentNo',
      'rollNo',
      'mobile',
    ]),
  };

  if (courseId) filter.courseId = courseId;
  if (status) filter.status = status;
  if (gender) filter.gender = gender;
  if (category) filter.category = category;
  if (batch) filter.batch = batch;

  const { skip } = pageOptions(req.query);

  const [rows, total] = await Promise.all([
    Student.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);

  return { rows, meta: { page, limit, total } };
}

// Get Single Student
export function getById(req, id) {
  return findScopedOr404(req, Student, id, ENTITY);
}

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

// Download Excel Template
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

// Import Students from Excel
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

// Yahan importStudents() function close ho gaya hai.

/**
 * Verify that the selected course belongs to the selected university.
 */

async function checkCourse(req, courseId) {
  const course = await Course.findOne({
    ...scoped(req),
    _id: courseId,
  })
    .populate({
      path: 'affiliationId',
      match: {
        tenantId: req.scope.tenantId,
        instituteId: req.scope.instituteId,
      },
      select: 'universityId',
    })
    .lean();

  if (!course) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'courseId', message: 'Choose a course of this institute' },
    ]);
  }

  if (!course.affiliationId?.universityId) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'courseId', message: 'Course has no valid university affiliation' },
    ]);
  }

  const universityId = course.affiliationId.universityId;

  const universityExists = await University.exists({
    _id: universityId,
  });

  if (!universityExists) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'courseId', message: 'Course university does not exist' },
    ]);
  }

  return universityId;
}

// Create a new student
export async function create(req, data) {
  const universityId = await checkCourse(req, data.courseId);

  const existingScholar = await Student.exists({
    ...scoped(req),
    scholarNo: data.scholarNo,
  });

  if (existingScholar) {
    throw ApiError.conflict('Scholar number already exists', [
      { field: 'scholarNo', message: 'Already exists' },
    ]);
  }

  if (data.enrollmentNo) {
    const existingEnrollment = await Student.exists({
      tenantId: req.scope.tenantId,
      universityId,
      enrollmentNo: data.enrollmentNo,
    });

    if (existingEnrollment) {
      throw ApiError.conflict('Enrollment number already exists', [
        { field: 'enrollmentNo', message: 'Already exists' },
      ]);
    }
  }

  const student = await Student.create({
    ...data,
    universityId,
    ...scoped(req),
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  await audit(req, AUDIT_ACTIONS.CREATE, ENTITY, student._id, null, student);

  return student;
}

// Update existing student's status
export async function updateStatus(req, studentId, status) {
  const student = await Student.findOne({
    ...scoped(req),
    _id: studentId,
  });

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  const oldStudent = student.toObject();

  student.status = status;
  student.updatedBy = req.user.id;

  await student.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, student._id, oldStudent, student.toObject());

  return student;
}

// Upload or update student's photo
export async function uploadPhoto(req, studentId, uploaded) {
  const student = await Student.findOne({
    ...scoped(req),
    _id: studentId,
  });

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  if (!uploaded) {
    throw ApiError.badRequest('Please upload a student photo');
  }

  const oldStudent = student.toObject();

  const oldPhoto = student.photo
    ? await File.findOne({
        ...scoped(req),
        _id: student.photo,
      })
    : null;

  const newFile = await storage.save(req, uploaded);

  student.photo = newFile._id;
  student.updatedBy = req.user.id;

  try {
    await student.save();
  } catch (error) {
    await storage.remove(newFile);
    throw error;
  }

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, student._id, oldStudent, student.toObject());

  if (oldPhoto) {
    await storage.remove(oldPhoto);
  }

  return student;
}
