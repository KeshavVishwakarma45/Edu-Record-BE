# ADR-005: Login with short access tokens and an httpOnly refresh cookie

- Status: Accepted
- Date: 2026-11-01

## Context

Staff log in with mobile number and password (SRS screen 1). OTP and 2FA are P3.

## Decision

- Access token: JWT, 15 minutes, returned in the response body, kept **in memory only** on the
  client (never localStorage).
- Refresh token: JWT, 7 days, in an `httpOnly`, `Secure`, `SameSite=Strict` cookie limited to the
  path `/api/v1/auth`.
- Logout increases `tokenVersion` on the user, which cancels every refresh token issued before.
- Passwords hashed with bcrypt (12 rounds); an unknown mobile is compared against a dummy hash so
  "wrong mobile" and "wrong password" look and take the same.
- Login is limited to 5 **failed** attempts per mobile per 15 minutes (429 after that).
- The client refreshes once on a 401, sharing one refresh request between parallel calls.

## Consequences

- Good: a stolen access token expires quickly; JavaScript cannot read the refresh token.
- Bad: Safari (and sometimes Firefox) refuses the `Secure` cookie on `http://localhost`, so
  development requires Chrome or Edge.
- Bad: the refresh cookie is not renewed on each refresh, so users log in again after 7 days.
- Bad: one expected 401 appears in the browser console when the app starts logged out.
