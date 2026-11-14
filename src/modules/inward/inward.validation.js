import Joi from 'joi';
import { objectId } from '../../utils/validators.js';

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
