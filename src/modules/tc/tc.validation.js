import Joi from 'joi';
import { objectId, listQuery } from '../../utils/validators.js';

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
    .valid('draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'issued', 'cancelled')
    .allow(''),
});

export const updateTcSchema = Joi.object({
  reasonForLeaving: Joi.string().trim().allow(''),
  conduct: Joi.string().trim().allow(''),
}).min(1);

// TC submission does not accept editable fields.
export const submitTcSchema = Joi.object({});

// Rejection requires a mandatory reason.
export const rejectTcSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(3).max(500).required().label('Rejection reason'),
});

// Handover details.
export const issueTcSchema = Joi.object({
  receivedBy: Joi.string().trim().min(2).max(100).required().label('Received by'),
});

export const tcIdParams = Joi.object({
  id: objectId().required(),
});
