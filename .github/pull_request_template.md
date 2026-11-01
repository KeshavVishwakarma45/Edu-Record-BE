<!-- PR title: "INW-03: mark document received" (SRS ID first). Branch: feature/INW-03-mark-received -->

## What changed

<!-- Two or three lines, in plain words -->

## SRS IDs

<!-- e.g. INW-03, INW-07 -->

## How to test

<!-- Steps the reviewer can follow: which user to log in as, which institute, what to click,
     what should happen. Include one wrong-input case and one wrong-role case. -->

1.
2.
3.

## Screenshot

<!-- Laptop width and 360 px phone width -->

## Checklist

- [ ] Follows the courses module pattern: model, validation, service, controller, routes
- [ ] Every protected route runs auth → tenantScope → requirePermission → validate → controller
- [ ] Every query starts from `scoped(req)`; one record by id via `findScopedOr404`; every create/update/delete calls `audit()`
- [ ] New model registered in `src/config/models.js`; every index starts with `tenantId`
- [ ] New permissions added to `constants/permissions.js` in both repos; no hard-coded role, status or category strings
- [ ] `npm run lint` and `npm test` pass
