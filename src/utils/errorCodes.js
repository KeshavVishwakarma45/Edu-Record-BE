// Every error the API sends has one of these codes in error.code.
// The client checks the code, never the message text.
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR', // 400
  INSTITUTE_REQUIRED: 'INSTITUTE_REQUIRED', // 400: X-Institute-Id header missing
  INVALID_FILE: 'INVALID_FILE', // 400: wrong file type or too large
  UNAUTHENTICATED: 'UNAUTHENTICATED', // 401: not logged in or token expired
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS', // 401: wrong mobile or password
  FORBIDDEN: 'FORBIDDEN', // 403: logged in but no access
  NOT_FOUND: 'NOT_FOUND', // 404
  CONFLICT: 'CONFLICT', // 409: duplicate value
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE', // 413
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS', // 429
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED', // 501
  INTERNAL_ERROR: 'INTERNAL_ERROR', // 500
});
