import { Student } from './student.model.js';
import { Course } from '../courses/course.model.js';
import { Affiliation } from '../institutes/affiliation.model.js';
import { University } from '../institutes/university.model.js';

import { ApiError } from '../../utils/ApiError.js';
import { scoped } from '../../utils/scoped.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { File } from '../files/file.model.js';
import * as storage from '../../utils/storage.js';

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

// Update existing student's status
export async function updateStatus(req, studentId, status) {
  // Find student within selected institute
  const student = await Student.findOne({
    ...scoped(req),
    _id: studentId,
  });

  // Check student exists
  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  // Store old data for audit history
  const oldStudent = student.toObject();

  // Update status
  student.status = status;
  student.updatedBy = req.user.id;

  // Save changes
  await student.save();

  // Maintain audit history
  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, student._id, oldStudent, student.toObject());

  return student;
}

// Upload or update student's photo
export async function uploadPhoto(req, studentId, uploaded) {
  // 1. Find student within selected institute
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

  // 2. Keep old student data for audit
  const oldStudent = student.toObject();

  // 3. Find existing photo, if available
  const oldPhoto = student.photo
    ? await File.findOne({
        ...scoped(req),
        _id: student.photo,
      })
    : null;

  // 4. Save new photo using existing storage utility
  const newFile = await storage.save(req, uploaded);

  // 5. Update student photo reference
  student.photo = newFile._id;
  student.updatedBy = req.user.id;

  try {
    await student.save();
  } catch (error) {
    // Remove newly uploaded file if student update fails
    await storage.remove(newFile);
    throw error;
  }

  // 6. Maintain audit history
  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, student._id, oldStudent, student.toObject());

  // 7. Remove old photo only after successful update
  if (oldPhoto) {
    await storage.remove(oldPhoto);
  }

  return student;
}
