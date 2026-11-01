import Joi from 'joi';
import { objectId, listQuery } from '../../utils/validators.js';
import { COURSE_PATTERN_LIST } from '../../constants/coursePatterns.js';

// The server is the authority: the client checks the same rules, but these always run.

const courseFields = {
  affiliationId: objectId().label('Affiliation'),
  name: Joi.string().trim().min(2).max(100).label('Name'),
  shortCode: Joi.string().trim().min(1).max(20).label('Short code'),
  branch: Joi.string().trim().max(50).allow('').label('Branch'),
  pattern: Joi.string()
    .valid(...COURSE_PATTERN_LIST)
    .label('Pattern'),
  duration: Joi.number().integer().min(1).max(12).label('Duration'),
  // Optional: when left out, the service builds them from pattern + duration
  examTerms: Joi.array().items(Joi.string().trim().max(30)).max(12).label('Exam terms'),
};

export const createCourseSchema = Joi.object({
  ...courseFields,
  affiliationId: courseFields.affiliationId.required(),
  name: courseFields.name.required(),
  shortCode: courseFields.shortCode.required(),
  pattern: courseFields.pattern.required(),
  duration: courseFields.duration.required(),
});

// Every field optional on update, but at least one must be sent
export const updateCourseSchema = Joi.object(courseFields).min(1);

export const listCoursesQuery = listQuery(['name', 'shortCode', 'branch', 'duration', 'createdAt']);
