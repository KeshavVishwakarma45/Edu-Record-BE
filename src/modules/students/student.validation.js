import Joi from 'joi';
import { objectId, mobile, listQuery } from '../../utils/validators.js';
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

// Student listing: search, filters and pagination
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

// Student ID validation
export const studentIdParam = objectId().label('Student ID');

// Student update validation
export const updateStudentSchema = Joi.object({
  scholarNo: Joi.string().trim().max(30).allow(''),
  enrollmentNo: Joi.string().trim().allow(''),
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
}).min(1);
