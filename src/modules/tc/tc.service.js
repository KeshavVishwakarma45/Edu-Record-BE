// -------------------------------------------------------------------
// tc.service.js
// -------------------------------------------------------------------
// This file contains the business logic of the TC module.
// -------------------------------------------------------------------

import { Student } from '../students/student.model.js';
import { Department } from '../institutes/department.model.js';
import { Course } from '../courses/course.model.js';
import { TC } from './tc.model.js';

import { findScopedOr404 } from '../../utils/findScoped.js';
import { scoped } from '../../utils/scoped.js';
import { ApiError } from '../../utils/ApiError.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
// Audit entity name

// -------------------------------------------------------------------
// checkEligibility(req, studentId)
// Checks student existence and fetches mandatory departments.
// -------------------------------------------------------------------

export async function checkEligibility(req, studentId) {
  // 1. Fetch student within the current tenant and institute scope.
  const student = await findScopedOr404(req, Student, studentId, 'student');

  // 2. Fetch mandatory departments from the database.
  const mandatoryDepartments = await Department.find({
    ...scoped(req),
    mandatory: true,
  })
    .sort({ order: 1, name: 1 })
    .lean();

  // 3. Clearance module is not implemented yet.
  // Therefore, actual student clearance status cannot be determined.
  const eligible = null;
  const pending = null;
  const eligibilityStatus = 'unknown';

  // 4. Record the eligibility check in the audit log.

  // 5. Return the result to the controller.
  return {
    studentId: student._id,
    eligible,
    eligibilityStatus,
    pending,
    mandatoryDepartments,
    clearanceCheckAvailable: false,
  };
}

// -------------------------------------------------------------------
// getTCData(req, studentId)
// Fetches student and course details for TC preview.
// -------------------------------------------------------------------

export async function getTCData(req, studentId) {
  // 1. Fetch student within current institute scope.
  const student = await findScopedOr404(req, Student, studentId, 'student');

  // 2. Fetch the student's course within the same scope.
  const course = await Course.findOne({
    ...scoped(req),
    _id: student.courseId,
  }).lean();

  // 3. Return combined TC preview data.
  return {
    student: {
      _id: student._id,
      scholarNo: student.scholarNo,
      enrollmentNo: student.enrollmentNo,
      rollNo: student.rollNo,
      name: student.name,
      fatherName: student.fatherName,
      motherName: student.motherName,
      dob: student.dob,
      gender: student.gender,
      category: student.category,
      religion: student.religion,
      address: student.address,
      mobile: student.mobile,
      admissionDate: student.admissionDate,
      batch: student.batch,
      branch: student.branch,
      status: student.status,
    },

    course: course
      ? {
          _id: course._id,
          name: course.name,
          shortCode: course.shortCode,
          branch: course.branch,
          pattern: course.pattern,
          duration: course.duration,
          examTerms: course.examTerms,
        }
      : null,

    academicDetails: null,
    academicDetailsAvailable: false,

    clearanceSummary: null,
    clearanceCheckAvailable: false,
  };
}
export async function createTC(req, body) {
  const { studentId } = body;

  const eligibility = await checkEligibility(req, studentId);

  if (!eligibility.clearanceCheckAvailable) {
    throw new ApiError(
      501,
      'NOT_IMPLEMENTED',
      'TC draft creation is unavailable because student clearance verification is not implemented yet.',
    );
  }
}

// -------------------------------------------------------------------
// listTCs(req)
// Fetches TC records with pagination, search and status filter.
// -------------------------------------------------------------------

export async function listTCs(req) {
  const { search, sort, page, limit, status } = req.query;

  // Base filter: current tenant and institute only.
  const filter = {
    ...scoped(req),
  };

  // Optional status filter.
  if (status) {
    filter.status = status;
  }

  // Search in student details, TC reference number and book serial.
  if (search) {
    const matchingStudents = await Student.find({
      ...scoped(req),
      ...searchFilter(search, ['name', 'scholarNo', 'enrollmentNo', 'rollNo']),
    }).distinct('_id');

    const tcSearch = searchFilter(search, ['refNo', 'bookSerial']);

    filter.$or = [...(tcSearch.$or || []), { studentId: { $in: matchingStudents } }];
  }

  // Pagination.
  const { skip } = pageOptions(req.query);

  // Fetch records and total count.
  const [rows, total] = await Promise.all([
    TC.find(filter)
      .sort(sortOption(sort))
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'studentId',
        select: 'name scholarNo enrollmentNo rollNo courseId',
        match: scoped(req),
      })
      .lean(),

    TC.countDocuments(filter),
  ]);

  return {
    rows,
    meta: { page, limit, total },
  };
}

// -------------------------------------------------------------------
// getTCById(req, id)
// Fetches one TC with student and course details.
// -------------------------------------------------------------------

export async function getTCById(req, id) {
  // 1. Find TC within current institute scope.
  const tc = await findScopedOr404(req, TC, id, 'TC');

  // 2. Fetch student and course preview data.
  const preview = await getTCData(req, tc.studentId);

  // 3. Return combined details.
  return {
    tc: {
      _id: tc._id,
      studentId: tc.studentId,
      reasonForLeaving: tc.reasonForLeaving,
      conduct: tc.conduct,
      status: tc.status,
      refNo: tc.refNo,
      bookSerial: tc.bookSerial,
      createdAt: tc.createdAt,
      updatedAt: tc.updatedAt,
    },

    student: preview.student,
    course: preview.course,

    academicDetails: preview.academicDetails,
    academicDetailsAvailable: preview.academicDetailsAvailable,

    clearanceSummary: preview.clearanceSummary,
    clearanceCheckAvailable: preview.clearanceCheckAvailable,
  };
}

// -------------------------------------------------------------------
// updateTC(req, id, changes)
// Updates an existing TC only when its status is draft.
// -------------------------------------------------------------------

export async function updateTC(req, id, changes) {
  const tc = await findScopedOr404(req, TC, id, 'TC');

  if (tc.status !== 'draft') {
    throw ApiError.conflict('Only draft TCs can be updated');
  }
  const before = tc.toObject();

  tc.set(changes);
  tc.updatedBy = req.user.id;
  await tc.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, 'tc', tc._id, before, tc);
  return tc;
}
