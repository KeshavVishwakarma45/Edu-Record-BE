import Joi from 'joi';
import { objectId, mobile } from '../../utils/validators.js';
import { CATEGORY_LIST } from '../../constants/categories.js';
import { GENDER_LIST } from '../../constants/genders.js';
import { STUDENT_STATUS_LIST } from '../../constants/statuses.js';

// Fields required when adding a new student
export const createStudentSchema = Joi.object({
  scholarNo: Joi.string().trim().min(1).max(30).required(),

  enrollmentNo: Joi.string().trim().max(50).empty('').default(null),

  universityId: objectId().required(),

  rollNo: Joi.string().trim().max(30).allow('').default(''),

  name: Joi.string().trim().min(2).max(100).required(),

  fatherName: Joi.string().trim().min(2).max(100).required(),

  motherName: Joi.string().trim().max(100).allow('').default(''),

  dob: Joi.date().iso().required(),

  gender: Joi.string()
    .valid(...GENDER_LIST)
    .required(),

  category: Joi.string()
    .valid(...CATEGORY_LIST)
    .required(),

  religion: Joi.string().trim().max(50).allow('').default(''),

  address: Joi.string().trim().max(500).allow('').default(''),

  mobile: mobile().allow('').default(''),

  admissionDate: Joi.date().iso().required(),

  courseId: objectId().required(),

  branch: Joi.string().trim().max(100).allow('').default(''),

  batch: Joi.string().trim().max(30).allow('').default(''),

  previousSchool: Joi.string().trim().max(150).allow('').default(''),

  photo: objectId().allow(null).default(null),
});

// Validation for updating student status
export const updateStudentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...STUDENT_STATUS_LIST)
    .required(),
});
