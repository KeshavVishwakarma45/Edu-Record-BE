import { Student } from './student.model.js';
import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
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
