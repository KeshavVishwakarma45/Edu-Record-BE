// Wraps an async controller so a thrown error reaches the error middleware.
// Express 5 already does this, but wrapping makes the flow obvious to every reader
// and keeps controllers working if the code is ever moved to another router.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
