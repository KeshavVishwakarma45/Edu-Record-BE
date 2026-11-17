// -------------------------------------------------------------------
// tc.service.js
// -------------------------------------------------------------------
// This file contains the business logic of the TC module.
// -------------------------------------------------------------------

import { Student } from '../students/student.model.js';
import { Department } from '../institutes/department.model.js';
import { Course } from '../courses/course.model.js';
import { University } from '../institutes/university.model.js';
import { ClearanceApplication } from '../clearance/clearanceApplication.model.js';
import { validateMandatoryClearances } from '../clearance/clearance.service.js';
import { TC } from './tc.model.js';

import { findScopedOr404 } from '../../utils/findScoped.js';
import { scoped } from '../../utils/scoped.js';
import { ApiError } from '../../utils/ApiError.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { STUDENT_STATUSES } from '../../constants/statuses.js';

// -------------------------------------------------------------------
// checkEligibility(req, studentId)
// Checks student existence and verifies clearance across mandatory departments (TC-01).
// -------------------------------------------------------------------

export async function checkEligibility(req, studentId) {
  // 1. Fetch student within the current tenant and institute scope.
  const student = await findScopedOr404(req, Student, studentId, 'student');
  if (student.deletedAt) {
    throw ApiError.notFound('Student not found');
  }

  // 2. Fetch mandatory departments from the database.
  const mandatoryDepartments = await Department.find({
    ...scoped(req),
    mandatory: true,
  })
    .sort({ order: 1, name: 1 })
    .lean();

  // 3. Find latest clearance application for this student.
  const application = await ClearanceApplication.findOne({
    ...scoped(req),
    studentId: student._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!application) {
    return {
      studentId: student._id,
      eligible: false,
      eligibilityStatus: 'no_clearance_application',
      pending: mandatoryDepartments.map((dept) => ({
        departmentId: dept._id,
        departmentName: dept.name,
        status: 'MISSING',
        isClear: false,
      })),
      mandatoryDepartments: mandatoryDepartments.map((dept) => ({
        departmentId: dept._id,
        departmentName: dept.name,
        status: 'MISSING',
        isClear: false,
      })),
      clearanceCheckAvailable: true,
      clearanceApplicationId: null,
    };
  }

  // 4. Validate mandatory clearances via Clearance module.
  const validation = await validateMandatoryClearances(req, student._id, application._id);

  return {
    studentId: student._id,
    eligible: validation.isEligibleForTCSubmission,
    eligibilityStatus: validation.isEligibleForTCSubmission ? 'eligible' : 'pending',
    pending: validation.incompleteDepartments,
    mandatoryDepartments: validation.mandatoryDepartments,
    clearanceCheckAvailable: true,
    clearanceApplicationId: application._id,
  };
}

// -------------------------------------------------------------------
// getTCData(req, studentId)
// Fetches student, course, university and clearance details for TC preview (TC-02, BR-12).
// -------------------------------------------------------------------

export async function getTCData(req, studentId) {
  // 1. Fetch student within current institute scope.
  const student = await findScopedOr404(req, Student, studentId, 'student');
  if (student.deletedAt) {
    throw ApiError.notFound('Student not found');
  }

  // 2. Fetch the student's course within the same scope.
  const course = await Course.findOne({
    ...scoped(req),
    _id: student.courseId,
  }).lean();

  // 3. Fetch university for enrollment label (BR-12).
  const university = student.universityId
    ? await University.findById(student.universityId)
        .select('name shortCode enrollmentLabel')
        .lean()
    : null;

  // 4. Fetch latest clearance application and summary if available.
  const latestApp = await ClearanceApplication.findOne({
    ...scoped(req),
    studentId: student._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  let clearanceSummary = null;
  const clearanceCheckAvailable = true;

  if (latestApp) {
    const clearanceValidation = await validateMandatoryClearances(req, student._id, latestApp._id);
    clearanceSummary = {
      applicationId: latestApp._id,
      isEligible: clearanceValidation.isEligibleForTCSubmission,
      mandatoryDepartments: clearanceValidation.mandatoryDepartments,
      incompleteDepartments: clearanceValidation.incompleteDepartments,
    };
  } else {
    clearanceSummary = {
      applicationId: null,
      isEligible: false,
      mandatoryDepartments: [],
      incompleteDepartments: [],
    };
  }

  // 5. Return combined TC preview data.
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
      previousSchool: student.previousSchool,
      status: student.status,
      universityId: student.universityId,
      university: university
        ? {
            _id: university._id,
            name: university.name,
            shortCode: university.shortCode,
            enrollmentLabel: university.enrollmentLabel,
          }
        : null,
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

    clearanceSummary,
    clearanceCheckAvailable,
  };
}

// -------------------------------------------------------------------
// createTC(req, body)
// Creates a new TC draft only when every mandatory clearance is Clear (TC-01).
// -------------------------------------------------------------------

export async function createTC(req, body) {
  const { studentId, reasonForLeaving = '', conduct = '' } = body;

  // 1. Fetch student within current institute scope.
  const student = await findScopedOr404(req, Student, studentId, 'student');
  if (student.deletedAt) {
    throw ApiError.notFound('Student not found');
  }

  // 2. Check if student already has a TC issued.
  if (student.status === STUDENT_STATUSES.TC_ISSUED) {
    throw ApiError.conflict('Transfer Certificate has already been issued for this student');
  }

  // 3. Check if an active TC draft/submission/approval already exists.
  const existingTC = await TC.findOne({
    ...scoped(req),
    studentId: student._id,
    status: { $in: ['draft', 'submitted', 'approved'] },
  });

  if (existingTC) {
    throw ApiError.conflict(
      'A Transfer Certificate draft or record already exists for this student',
    );
  }

  // 4. Verify clearance eligibility (SRS TC-01).
  const eligibility = await checkEligibility(req, student._id);

  if (!eligibility.eligible) {
    throw ApiError.conflict('Cannot create TC draft: mandatory clearances are not clear', {
      pending: eligibility.pending,
    });
  }

  // 5. Create TC in draft status. Spread scoped(req) last to enforce tenant isolation.
  const tc = await TC.create({
    studentId: student._id,
    reasonForLeaving,
    conduct,
    status: 'draft',
    createdBy: req.user.id,
    updatedBy: req.user.id,
    ...scoped(req),
  });

  // 6. Record creation in audit log.
  await audit(req, AUDIT_ACTIONS.CREATE, 'tc', tc._id, null, tc);

  return tc;
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
      deletedAt: null,
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
// Updates an existing TC only when its status is draft (TC-03, TC-06).
// -------------------------------------------------------------------

export async function updateTC(req, id, changes) {
  const tc = await findScopedOr404(req, TC, id, 'TC');

  if (tc.status !== 'draft') {
    throw ApiError.conflict('Only draft TCs can be updated');
  }
  const before = tc.toObject();

  const updates = {};
  if (changes.reasonForLeaving !== undefined) {
    updates.reasonForLeaving = changes.reasonForLeaving;
  }
  if (changes.conduct !== undefined) {
    updates.conduct = changes.conduct;
  }

  tc.set(updates);
  tc.updatedBy = req.user.id;
  await tc.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, 'tc', tc._id, before, tc);
  return tc;
}
