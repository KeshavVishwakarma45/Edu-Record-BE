import { Student } from './student.model.js';
import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { audit } from '../../utils/audit.js';
import { ApiError } from '../../utils/ApiError.js';
import { STUDENT_STATUS_LIST } from '../../constants/statuses.js';
const ENTITY = 'student';

export async function list(req) {
  const { search, sort, page, limit, courseId, status, gender, category, batch } = req.query;

  const filter = {
    ...scoped(req),
    // STU-07: in 6 fields mein search hoga ek saath
    ...searchFilter(search, [
      'name',
      'fatherName',
      'scholarNo',
      'enrollmentNo',
      'rollNo',
      'mobile',
    ]),
  };
  // optional filters (STU-07)
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

export function getById(req, id) {
  return findScopedOr404(req, Student, id, ENTITY);
}

export async function update(req, id, changes) {
  const student = await findScopedOr404(req, Student, id, ENTITY);
  if (changes.status && !STUDENT_STATUS_LIST.includes(changes.status)) {
    throw new ApiError(400, 'Invalid student status');
  }
  const before = student.toObject();
  student.set(changes);
  student.updatedBy = req.user.id;
  await student.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, student._id, before, student);
  return student;
}

export async function remove(req, id) {
  const student = await findScopedOr404(req, Student, id, ENTITY);

  await Student.deleteOne({ _id: student._id });

  await audit(req, AUDIT_ACTIONS.DELETE, ENTITY, student._id, student, null);
}
