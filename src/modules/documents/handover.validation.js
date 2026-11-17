import Joi from 'joi';
import { objectId, mobile } from '../../utils/validators.js';

export const studentIdParams = Joi.object({
  studentId: objectId().required(),
});

export const signatureUploadSchema = Joi.object({
  studentId: objectId().required(),
}).unknown(false);

// Submit handover request validation
export const submitHandoverSchema = Joi.object({
  studentId: objectId().required(),

  documentIds: Joi.array().items(objectId()).min(1).unique().required(),

  receiverType: Joi.string().valid('SELF').required(),

  receiverName: Joi.string().trim().min(2).max(100).required(),

  receiverMobile: mobile().required(),

  receiverPhotoId: objectId().required(),

  signedReceiptId: objectId().required(),
}).unknown(false);
export const handoverHistoryQuerySchema = Joi.object({
  studentId: objectId(),

  search: Joi.string().trim().max(100).allow(''),

  fromDate: Joi.date().iso(),

  toDate: Joi.date().iso(),

  page: Joi.number().integer().min(1).default(1),

  limit: Joi.number().integer().min(1).max(100).default(20),

  instituteId: objectId().allow(''),
})
  .custom((value, helpers) => {
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      return helpers.error('date.range');
    }

    return value;
  })
  .messages({
    'date.range': 'fromDate cannot be later than toDate',
  });
export const receiverPhotoUploadSchema = Joi.object({
  studentId: objectId().required(),
}).unknown(false);
