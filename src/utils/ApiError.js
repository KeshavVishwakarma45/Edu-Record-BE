import { ERROR_CODES } from './errorCodes.js';

// Services throw ApiError; the error middleware turns it into the standard error response.
// Example: throw ApiError.notFound('Course not found');
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthenticated(message = 'Please log in') {
    return new ApiError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }

  static forbidden(message = 'You do not have access to this') {
    return new ApiError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message, details) {
    return new ApiError(409, ERROR_CODES.CONFLICT, message, details);
  }
}
