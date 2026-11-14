import Joi from 'joi';
import { objectId, listQuery } from '../../utils/validators.js';
import { MISSING_REASONS } from './inward.model.js';

export const inwardBatchIdParams = Joi.object({
  id: objectId().required(),
});

export const receiptParams = Joi.object({
  id: objectId().required(),
  receiptId: objectId().required(),
});

export const missingReceiveParams = Joi.object({
  newBatchId: objectId().required(),
  missingId: objectId().required(),
});

export const missingUpdateParams = Joi.object({
  id: objectId().required(),
  missingId: objectId().required(),
});

const storageLocation = Joi.object({
  almirah: Joi.string().trim().max(100).allow(''),
  fileNo: Joi.string().trim().max(100).allow(''),
});

export const createReceiptSchema = Joi.object({
  studentId: objectId().required(),
  documentSerialNo: Joi.string().trim().max(100).allow(''),
  storageLocation,
});

export const updateReceiptSchema = Joi.object({
  documentSerialNo: Joi.string().trim().max(100).allow(''),
  storageLocation,
}).min(1);

export const receiveMissingSchema = Joi.object({
  documentSerialNo: Joi.string().trim().max(100).allow(''),
  storageLocation,
});

// API 11: Update missing document details
export const updateMissingSchema = Joi.object({
  reason: Joi.string().valid(...MISSING_REASONS),
  otherReason: Joi.string().trim().max(250).allow(''),
  followUpDate: Joi.date().iso(),
}).min(1);

// API 12: Pending documents list query
export const inwardPendingQuery = listQuery(['followUpDate', 'createdAt', 'documentType']);
