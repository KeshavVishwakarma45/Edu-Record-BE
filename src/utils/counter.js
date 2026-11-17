// TC NUMBERING SERVICE: Module C (S5).
//
// Requirements: SRS BR-04, BR-04a, BR-05, TC-04, ORG-08, AC-13.
//
// Every TC gets two numbers at PRINCIPAL APPROVAL:
//   Ref no.      INSTITUTE/TC/YEAR/SHORTCODE/N
//   Book serial  N
//
// Ref series key:
//   (tenantId, instituteId, kind: 'ref', courseShortCode, year)
//
// Book serial series key:
//   (tenantId, instituteId, kind: 'serial', year)
//
// Ref series uses courseShortCode instead of courseId because
// multiple courses may share the same short code.
//
// For continuous series, year must be null.
// For yearly restarting series, year is the academic year.
//
// Number allocation must happen atomically inside withTransaction().
// Missing series must throw an error. Never create a series automatically.
//
// Never read a number and increment it in JavaScript.
// MongoDB $inc ensures atomic allocation.

import { TcSeries } from '../modules/tc/tcSeries.model.js';
import { ApiError } from './ApiError.js';
import { ERROR_CODES } from './errorCodes.js';
import { scoped } from './scoped.js';

// Allocates the next TC number from an already configured series.
// Must always be called inside withTransaction().
export async function nextNumber(req, { kind, courseShortCode = null, year = null, session }) {
  // Number allocation must happen inside a database transaction.
  if (!session) {
    throw new Error('TC number allocation requires a transaction session');
  }

  // Validate the series type.
  if (!['ref', 'serial'].includes(kind)) {
    throw ApiError.badRequest('Invalid TC number series kind');
  }

  // Ref number series must have a course short code.
  if (kind === 'ref' && !courseShortCode) {
    throw ApiError.badRequest('Course short code is required for Ref number');
  }

  // Book serial series must not have a course short code.
  if (kind === 'serial' && courseShortCode !== null) {
    throw ApiError.badRequest('Book serial must not have a course short code');
  }

  // Build an institute-scoped filter.
  const filter = {
    ...scoped(req),
    kind,
    year,
  };

  // Ref series are separated by course short code.
  if (kind === 'ref') {
    filter.courseShortCode = courseShortCode;
  }

  // Atomically increment the counter.
  // returnDocument: 'before' returns the number allocated.
  const series = await TcSeries.findOneAndUpdate(
    filter,
    {
      $inc: {
        nextNumber: 1,
      },
    },
    {
      session,
      returnDocument: 'before',
    },
  );

  // Never create a missing series automatically.
  if (!series) {
    throw new ApiError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      `TC ${kind} number series is not configured`,
    );
  }

  return series.nextNumber;
}
