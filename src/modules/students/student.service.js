import { Student } from './student.model.js';
import { Course } from '../courses/course.model.js';
import { Affiliation } from '../institutes/affiliation.model.js';
import { University } from '../institutes/university.model.js';

import { ApiError } from '../../utils/ApiError.js';
import { scoped } from '../../utils/scoped.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';

const ENTITY = 'student';

// Check whether the selected course belongs to this institute
async function checkCourse(req, courseId, universityId) {
  const course = await Course.findOne({
    ...scoped(req),
    _id: courseId,
  });

  if (!course) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'courseId', message: 'Choose a course of this institute' },
    ]);
  }

  // Check whether the university exists
  const universityExists = await University.exists({
    _id: universityId,
  });

  if (!universityExists) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'universityId', message: 'Choose a valid university' },
    ]);
  }

  // Course must be affiliated with the selected university
  const affiliationExists = await Affiliation.exists({
    ...scoped(req),
    _id: course.affiliationId,
    universityId,
  });

  if (!affiliationExists) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      {
        field: 'universityId',
        message: 'This university is not affiliated with the selected course',
      },
    ]);
  }
}

// Create a new student
export async function create(req, data) {
  // 1. Verify course and university
  await checkCourse(req, data.courseId, data.universityId);

  // 2. Check duplicate scholar number in this institute
  const existingScholar = await Student.exists({
    ...scoped(req),
    scholarNo: data.scholarNo,
  });

  if (existingScholar) {
    throw ApiError.conflict('Scholar number already exists', [
      { field: 'scholarNo', message: 'Already exists' },
    ]);
  }

  // 3. Check duplicate enrollment number within this tenant/university
  if (data.enrollmentNo) {
    const existingEnrollment = await Student.exists({
      tenantId: req.scope.tenantId,
      universityId: data.universityId,
      enrollmentNo: data.enrollmentNo,
    });

    if (existingEnrollment) {
      throw ApiError.conflict('Enrollment number already exists', [
        { field: 'enrollmentNo', message: 'Already exists' },
      ]);
    }
  }

  // 4. Save student
  const student = await Student.create({
    ...data,

    // Never accept institute or tenant IDs from frontend
    ...scoped(req),

    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  // 5. Maintain audit history
  await audit(req, AUDIT_ACTIONS.CREATE, ENTITY, student._id, null, student);

  return student;
}
