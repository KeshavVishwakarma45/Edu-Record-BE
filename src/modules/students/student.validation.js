import Joi from 'joi';
import { objectId, listQuery } from '../../utils/validators.js';
import { STUDENT_STATUS_LIST } from '../../constants/statuses.js';
import { GENDER_LIST } from '../../constants/genders.js';
import { CATEGORY_LIST } from '../../constants/categories.js';

export const listStudentsQuery = listQuery(
  ['name', 'scholarNo', 'rollNo', 'admissionDate', 'createdAt'],

  {
    courseId: objectId().allow(''),
    status: Joi.string()
      .valid(...STUDENT_STATUS_LIST)
      .allow(''),
    gender: Joi.string()
      .valid(...GENDER_LIST)
      .allow(''),
    category: Joi.string()
      .valid(...CATEGORY_LIST)
      .allow(''),
    batch: Joi.string().trim().max(20).allow(''),
  },
);

// ---------- new pieces ----------
export const studentIdParam = objectId().label('Student ID');
// All fields are optional, but at least one must be sent.
export const updateStudentSchema = Joi.object({
  // you can copy the field definitions from the Mongoose schema,
  // but make them optional – Joi treats omitted keys as optional.
  scholarNo: Joi.string().trim().max(30).allow(''),
  enrollmentNo: Joi.string().trim().allow(''), // may be null/'' in DB
  universityId: objectId(),
  rollNo: Joi.string().trim().allow(''),
  name: Joi.string().trim().max(100).allow(''),
  fatherName: Joi.string().trim().max(100).allow(''),
  motherName: Joi.string().trim().allow(''),
  dob: Joi.date(),
  gender: Joi.string()
    .valid(...GENDER_LIST)
    .allow(''),
  category: Joi.string()
    .valid(...CATEGORY_LIST)
    .allow(''),
  religion: Joi.string().allow(''),
  address: Joi.string().allow(''),
  mobile: Joi.string().allow(''),
  admissionDate: Joi.date(),
  courseId: objectId(),
  branch: Joi.string().allow(''),
  batch: Joi.string().allow(''),
  previousSchool: Joi.string().allow(''),
  status: Joi.string()
    .valid(...STUDENT_STATUS_LIST)
    .allow(''),
  isLegacy: Joi.boolean(),
  // add any other fields you might need to edit
}).min(1); // ensures at least one key is present
