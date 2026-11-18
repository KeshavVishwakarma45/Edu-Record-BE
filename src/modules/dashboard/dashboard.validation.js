import Joi from 'joi';
import { objectId } from '../../utils/validators.js';

const instituteFilter = {
  // Super Admin can optionally filter by one institute.
  instituteId: objectId().allow(''),
};

export const dashboardSummaryQuery = Joi.object({
  ...instituteFilter,
});

export const dashboardAttentionQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(5),
  ...instituteFilter,
});

export const dashboardListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  ...instituteFilter,
});
