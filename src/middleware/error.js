import mongoose from 'mongoose';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';

// Runs when no route matched the URL
export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// Turns known library errors into an ApiError, so there is one response format.
function toApiError(err) {
  if (err instanceof ApiError) return err;

  // Duplicate value on a unique index, e.g. the same course short code twice
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).filter(
      (field) => field !== 'tenantId' && field !== 'instituteId',
    );
    // 'shortCode' -> 'short code', so the message reads well on screen
    const words = fields.map((field) => field.replace(/([A-Z])/g, ' $1').toLowerCase());
    return ApiError.conflict(
      `A record with the same ${words.join(' and ')} already exists`,
      fields.map((field) => ({ field, message: 'Already exists' })),
    );
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Please correct the highlighted fields', details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`${err.path} is not valid`);
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return new ApiError(400, ERROR_CODES.INVALID_FILE, message);
  }
  // Errors raised by express.json() for bad or oversized bodies
  if (err.type === 'entity.parse.failed')
    return ApiError.badRequest('Request body is not valid JSON');
  if (err.type === 'entity.too.large') {
    return new ApiError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'Request body is too large');
  }
  return null;
}

// The one place that sends error responses:
//   { success: false, error: { code, message, details? } }
// Express recognises error middleware by its 4 arguments, so _next stays even though it is unused
export function errorHandler(err, req, res, _next) {
  const known = toApiError(err);

  if (!known) {
    // An unexpected bug: log everything, but never show internals to the user outside development
    console.error(err);
    return res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: env.isDevelopment ? err.message : 'Something went wrong. Please try again.',
        ...(env.isDevelopment && { stack: err.stack }),
      },
    });
  }

  res.status(known.status).json({
    success: false,
    error: {
      code: known.code,
      message: known.message,
      ...(known.details && { details: known.details }),
    },
  });
}
