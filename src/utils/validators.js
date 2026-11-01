import Joi from 'joi';

// Small Joi helpers reused by every module's .validation.js file.

// A MongoDB id: 24 hex characters
export const objectId = () =>
  Joi.string().hex().length(24).messages({
    'string.length': '{{#label}} must be a valid id',
    'string.hex': '{{#label}} must be a valid id',
  });

// Indian mobile number: 10 digits starting with 6-9
export const mobile = () =>
  Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .messages({ 'string.pattern.base': 'Enter a 10-digit mobile number' });

// For routes like /courses/:id
export const idParams = Joi.object({ id: objectId().required() });

// Query for every list route: ?page=1&limit=20&sort=-name&search=bca
// sortFields lists the fields this list may be sorted by.
export function listQuery(sortFields, extra = {}) {
  const sortValues = sortFields.flatMap((field) => [field, `-${field}`]);
  return Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string()
      .valid(...sortValues)
      .default(sortValues[0]),
    search: Joi.string().trim().max(100).allow(''),
    ...extra,
  });
}
