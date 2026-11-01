// TC NUMBERING SERVICE: placeholder. Module C (S5) builds it here. Do not build it anywhere else.
//
// Requirements: SRS BR-04, BR-04a, BR-05, TC-04, ORG-08, AC-13.
//
// What it must do:
//   - Every TC gets two numbers at PRINCIPAL APPROVAL (never at draft, so drafts leave no gaps):
//       Ref no.      INSTITUTE/TC/YEAR/SHORTCODE/N   e.g. SSISM/TC/2026/B.Com/496
//       Book serial  N                               e.g. 1305
//
//   - Each series is one document in the tcSeries collection. The key is:
//       Ref no. series:      (tenantId, instituteId, kind: 'ref',    courseShortCode, year)
//       Book serial series:  (tenantId, instituteId, kind: 'serial',                  year)
//     with a unique index on exactly those fields, tenantId first.
//
//   - WHY the course SHORT CODE and not courseId: the Ref no. prints only the short code.
//     B.Sc Bio and B.Sc Micro are two courses that share the short code "B.Sc". If each
//     course had its own series, both would print SSISM/TC/2026/B.Sc/1 — the same Ref no.
//     on two different TCs. Keyed on the short code, they share ONE series and can never clash.
//
//   - `year` is part of the key only when the series restarts every academic year
//     (restartYearly: true). For a continuous series store year: null. The default is
//     continuous until the Society answers Q1. The starting number of every series is set in
//     setup (BR-04a, MIG-07): SSISM continues from Ref .../B.Com/495 and serial 1304.
//
//   - Take the next number with ONE atomic update inside the approval transaction:
//       TcSeries.findOneAndUpdate(
//         { ...scoped(req), kind: 'ref', courseShortCode: course.shortCode, year },
//         { $inc: { nextNumber: 1 } },
//         { session, returnDocument: 'before' },   // 'before' returns the number we just took
//       )
//     and run it inside withTransaction() from utils/transaction.js, together with saving
//     the TC, its snapshot and the audit entry. If any step fails, everything rolls back
//     and no number is used (BR-05). A missing series is a setup error: throw, do not create it.
//
//   - Never read a number, add 1 in JavaScript and save it back: two clerks approving at the
//     same moment would get the same number. A Jest test approves 20 TCs in parallel (including
//     B.Sc Bio and B.Sc Micro together) and checks the numbers are consecutive with no repeats (AC-13).

import { ApiError } from './ApiError.js';
import { ERROR_CODES } from './errorCodes.js';

export async function nextNumber() {
  throw new ApiError(501, ERROR_CODES.NOT_IMPLEMENTED, 'TC numbering is not built yet');
}
