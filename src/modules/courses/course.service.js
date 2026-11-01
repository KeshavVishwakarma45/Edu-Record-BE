import { Course } from './course.model.js';
import { Affiliation } from '../institutes/affiliation.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { audit } from '../../utils/audit.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { buildExamTerms } from '../../constants/coursePatterns.js';

// All business rules for courses live here. Every query starts from scoped(req),
// so a user only ever sees and changes courses of the institute they selected.

const ENTITY = 'course';

export async function list(req) {
  const { search, sort, page, limit } = req.query;
  const filter = { ...scoped(req), ...searchFilter(search, ['name', 'shortCode', 'branch']) };
  const { skip } = pageOptions(req.query);

  const [rows, total] = await Promise.all([
    Course.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  return { rows, meta: { page, limit, total } };
}

// Another institute's course answers 404 too (and the attempt is audited)
export function getById(req, id) {
  return findScopedOr404(req, Course, id, ENTITY);
}

// Choices for the course form's Affiliation select, e.g. "Vikram University (2010 onwards)"
export async function options(req) {
  const affiliations = await Affiliation.find(scoped(req))
    .populate({ path: 'universityId', select: 'name' })
    .sort({ fromYear: -1 })
    .lean();
  return {
    affiliations: affiliations.map((a) => ({
      value: String(a._id),
      label: `${a.universityId?.name ?? 'Unknown university'} (${a.fromYear}${a.toYear ? `–${a.toYear}` : ' onwards'})`,
    })),
  };
}

// A course must link to an affiliation of the SAME institute
async function checkAffiliation(req, affiliationId) {
  const exists = await Affiliation.exists({ ...scoped(req), _id: affiliationId });
  if (!exists) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'affiliationId', message: 'Choose an affiliation of this institute' },
    ]);
  }
}

export async function create(req, data) {
  await checkAffiliation(req, data.affiliationId);
  const course = await Course.create({
    ...data,
    examTerms: data.examTerms?.length
      ? data.examTerms
      : buildExamTerms(data.pattern, data.duration),
    ...scoped(req), // last, so the request body can never choose its own tenant or institute
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });
  await audit(req, AUDIT_ACTIONS.CREATE, ENTITY, course._id, null, course);
  return course;
}

export async function update(req, id, changes) {
  const course = await getById(req, id);
  if (changes.affiliationId) await checkAffiliation(req, changes.affiliationId);

  const before = course.toObject();
  course.set(changes);
  // Rebuild the terms when pattern or duration changed and no terms were sent
  if ((changes.pattern || changes.duration) && !changes.examTerms) {
    course.examTerms = buildExamTerms(course.pattern, course.duration);
  }
  course.updatedBy = req.user.id;
  await course.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, course._id, before, course);
  return course;
}

export async function remove(req, id) {
  const course = await getById(req, id);
  // When students exist, block deleting a course that students use (Module A adds this check)
  await Course.deleteOne({ ...scoped(req), _id: course._id });
  await audit(req, AUDIT_ACTIONS.DELETE, ENTITY, course._id, course, null);
}
