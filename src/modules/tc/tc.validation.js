import Joi from 'joi';
import { objectId } from '../../utils/validators.js';

// TC submission does not accept editable fields.
export const submitTcSchema = Joi.object({});

// Rejection requires a mandatory reason.
export const rejectTcSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(3).max(500).required().label('Rejection reason'),
});

// Handover details
export const issueTcSchema = Joi.object({
  receivedBy: Joi.string().trim().min(2).max(100).required().label('Received by'),
});

// Every TC API uses this ID validation.
export const tcIdParams = Joi.object({
  id: objectId().required(),
});
