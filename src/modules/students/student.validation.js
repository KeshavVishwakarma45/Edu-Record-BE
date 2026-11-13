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
