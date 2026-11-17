import Joi from 'joi';

import { objectId, listQuery } from '../../utils/validators.js';

import { INWARD_DOCUMENT_TYPES, MISSING_REASONS } from '../inward/inward.model.js';

export const reportDocumentIdParams = Joi.object({
  id: objectId().required(),
});

const reportSortFields = [
  'receivedDate',
  'followUpDate',
  'createdAt',
  'documentType',
  'studentName',
  'scholarNo',
];

export const notReceivedListQuery = listQuery(reportSortFields, {
  courseId: objectId(),
  documentType: Joi.string().valid(...INWARD_DOCUMENT_TYPES),
  fromDate: Joi.date().iso(),
  toDate: Joi.date().iso(),
})
  .custom((value, helpers) => {
    if (value.fromDate && value.toDate && value.fromDate > value.toDate) {
      return helpers.error('any.invalid');
    }

    return value;
  })
  .messages({
    'any.invalid': 'fromDate must be on or before toDate',
  });

export const updateNotReceivedFollowUpSchema = Joi.object({
  reason: Joi.string().valid(...MISSING_REASONS),
  otherReason: Joi.string().trim().max(250).allow(''),
  followUpDate: Joi.date().iso(),
})
  .or('reason', 'followUpDate')
  .custom((value, helpers) => {
    if (value.reason === 'OTHER' && !value.otherReason) {
      return helpers.error('any.invalid');
    }

    if (value.reason !== 'OTHER' && value.otherReason?.trim()) {
      return helpers.error('any.invalid');
    }

    return value;
  })
  .messages({
    'object.missing': 'At least one of reason or followUpDate is required',
    'any.invalid': 'Provide a non-empty otherReason when reason is OTHER',
  });
