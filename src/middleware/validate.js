import { ApiError } from '../utils/ApiError.js';

// Step 4 of every protected route: is the input correct?
// Pass Joi schemas for the parts of the request to check:
//   validate({ params: idParams, body: updateCourseSchema })
// Unknown fields are removed, values are converted (e.g. "5" -> 5) and defaults applied,
// so the controller only ever sees clean data.
const PARTS = ['params', 'query', 'body'];

export function validate(schemas) {
  return (req, _res, next) => {
    const details = [];

    for (const part of PARTS) {
      if (!schemas[part]) continue;
      const { value, error } = schemas[part].validate(req[part] ?? {}, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        error.details.forEach((detail) =>
          details.push({ field: detail.path.join('.'), message: detail.message.replace(/"/g, '') }),
        );
      } else if (part === 'query') {
        // In Express 5 req.query is read-only, so the cleaned value is defined in its place
        Object.defineProperty(req, 'query', { value, writable: true, enumerable: true });
      } else {
        req[part] = value;
      }
    }

    if (details.length > 0) {
      return next(ApiError.badRequest('Please correct the highlighted fields', details));
    }
    next();
  };
}
