import mongoose from 'mongoose';

// Runs fn(session) inside a MongoDB transaction: either every write in fn is saved, or none is.
// Pass the session to every query inside fn, for example:
//
//   await withTransaction(async (session) => {
//     await Handover.create([data], { session });
//     await Document.updateMany({ ...scoped(req), _id: { $in: ids } }, { status }, { session });
//     await audit(req, AUDIT_ACTIONS.CREATE, 'handover', id, null, data, session);
//   });
//
// MongoDB retries fn automatically on temporary conflicts, so fn must not have side effects
// outside the database (no file writes, no emails) unless they are safe to repeat.
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
