import Joi from 'joi';
import { objectId, mobile } from '../../utils/validators.js';
import { CATEGORY_LIST } from '../../constants/categories.js';
import { GENDER_LIST } from '../../constants/genders.js';
import { STUDENT_STATUS_LIST } from '../../constants/statuses.js';

// Rules for one student row from the Excel file
export const studentImportRowSchema = Joi.object({
  scholarNo: Joi.string().trim().min(1).max(50).required(),
  enrollmentNo: Joi.string().trim().max(50).allow('', null),
  rollNo: Joi.string().trim().max(50).allow('', null),
  name: Joi.string().trim().min(2).max(100).required(),
  fatherName: Joi.string().trim().min(2).max(100).required(),
  motherName: Joi.string().trim().max(100).allow(''),
  dob: Joi.date().iso().required(),
  gender: Joi.string()
    .valid(...GENDER_LIST)
    .required(),
  category: Joi.string()
    .valid(...CATEGORY_LIST)
    .required(),
  religion: Joi.string().trim().max(50).allow(''),
  address: Joi.string().trim().max(500).allow(''),
  mobile: mobile().allow(''),
  admissionDate: Joi.date().iso().required(),
  courseId: objectId().required(),
  branch: Joi.string().trim().max(100).allow(''),
  batch: Joi.string().trim().max(30).allow(''),
  previousSchool: Joi.string().trim().max(150).allow(''),
  status: Joi.string()
    .valid(...STUDENT_STATUS_LIST)
    .optional(),
}).unknown(false);
