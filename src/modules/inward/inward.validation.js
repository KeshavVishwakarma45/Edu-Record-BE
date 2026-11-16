import Joi from 'joi';
import { objectId, listQuery } from '../../utils/validators.js';
import { INWARD_DOCUMENT_TYPES, MISSING_REASONS } from './inward.model.js';

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

// Create a new inward batch
export const createInwardBatchSchema = Joi.object({
  universityId: objectId().required().label('University'),
  instituteId: objectId().required().label('Institute'),
  courseId: objectId().required().label('Course'),
  examTerm: Joi.string().trim().min(1).max(30).required(),
  examSession: Joi.object({
    month: Joi.number().integer().min(1).max(12).required(),
    year: Joi.number().integer().min(2000).max(2100).required(),
  })
    .required()
    .unknown(false),
  documentType: Joi.string()
    .valid(...INWARD_DOCUMENT_TYPES)
    .required(),
  receivedDate: Joi.date().iso().required(),
  referenceNumber: Joi.string().trim().max(100).allow(''),
  coveringLetterFileId: objectId().allow(null),
}).unknown(false);

// List inward batches
export const listInwardBatchesQuery = listQuery(['createdAt', 'receivedDate', 'examTerm']);

// Mark a document as missing
export const markMissingDocumentSchema = Joi.object({
  studentId: objectId().required().label('Student ID'),
  reason: Joi.string()
    .valid(...MISSING_REASONS)
    .required(),
  otherReason: Joi.string()
    .trim()
    .max(200)
    .when('reason', {
      is: 'OTHER',
      then: Joi.string().required().min(1),
      otherwise: Joi.string().allow(''),
    }),
  followUpDate: Joi.date().iso().required(),
}).unknown(false);
