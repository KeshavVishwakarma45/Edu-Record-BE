# ADR-017: Log in with email instead of mobile number

- Status: Accepted
- Date: 2026-11-01
- Changes: SRS screen 1 ("mobile + password") and ADR-005 (login id)

## Context

The SRS and the first skeleton used the mobile number as the login id. The project owner decided
that staff log in with their **email address** instead.

## Decision

- `users.email` is the login id: required, unique across all tenants, stored in lower case.
  `users.mobile` stays as an optional contact number and is no longer unique.
- `POST /api/v1/auth/login` takes `{ email, password }`. The email is trimmed and lower-cased, so
  `Admin@Singaji.in` and `admin@singaji.in` are the same user.
- The login rate limit counts failed attempts per email (5 per 15 minutes).
- The seed removes old seed users that have no email and rebuilds the indexes (the old unique
  mobile index is dropped).
- Everything else in ADR-005 (tokens, cookie, logout, bcrypt) is unchanged.

## Consequences

- Good: staff use the institutional email they already know; no clash when two staff share a phone.
- Bad: the SRS text says mobile login; it should be updated in the next SRS version.
- Later: OTP / 2FA (P3) can be sent by email or SMS; the decision is still open.
