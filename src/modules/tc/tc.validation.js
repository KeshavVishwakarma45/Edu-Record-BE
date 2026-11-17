import Joi from 'joi';
import { objectId, listQuery, idParams } from '../../utils/validators.js';

export const studentIdParams = Joi.object({
  studentId: objectId().required().label('Student ID'),
});

export const createTcSchema = Joi.object({
  studentId: objectId().required(),
  reasonForLeaving: Joi.string().trim().allow('').default(''),
  conduct: Joi.string().trim().allow('').default(''),
});

export const listTcsQuery = listQuery(['createdAt', 'status', 'refNo', 'bookSerial'], {
  status: Joi.string()
    .valid('draft', 'submitted', 'approved', 'rejected', 'issued', 'cancelled')
    .allow(''),
});

export const updateTcSchema = Joi.object({
  reasonForLeaving: Joi.string().trim().allow(''),
  conduct: Joi.string().trim().allow(''),
}).min(1);

export const tcIdParams = idParams;
