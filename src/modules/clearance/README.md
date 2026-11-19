# Clearance Module

Implements TC application clearance and department-wise no-dues
workflow for P1.

## Requirements

| SRS ID | Requirement                                                                               | Phase |
| ------ | ----------------------------------------------------------------------------------------- | ----- |
| CLR-01 | TC application records class, leaving reason, documents and declarations                  | P1    |
| CLR-02 | Application creates one clearance item per configured department                          | P1    |
| CLR-03 | Each department sees its own queue and marks Clear / Not clear with remark and amount due | P1    |
| CLR-04 | Student profile shows department-wise status                                              | P1    |
| CLR-05 | Accounts manages pending fee amount                                                       | P1    |

## Department In-charge access

Department assignments are obtained from the authenticated institute
role through `req.scope.departmentIds`.

The Department In-charge uses:

- GET /api/v1/clearance/queue
- GET /api/v1/clearance/queue/pending-count
- GET /api/v1/clearance/applications/:clearanceApplicationId
- GET /api/v1/clearance/history
- PATCH /api/v1/clearance/items/:itemId

Read operations require `clearance.view`.
Department decisions require `clearance.act`.

Department In-charge cannot access institute-wide application lists,
all-department student clearance profiles or Accounts dues.

## Data model

- `ClearanceApplication`: one TC clearance application per submission.
- `ClearanceItem`: one department-wise decision for an application.
- `AuditLog`: append-only history of item creation and updates.

The current P1 model stores documents enclosed as application
checkboxes. It does not store separately verifiable document records.

## Validation and testing

Run:

```bash
npm test -- --runTestsByPath tests/clearanceApplication.test.js
npm run lint
```

See `docs/DEPARTMENT_INCHARGE_CLEARANCE_API.md` for the frontend
API contract, query parameters, request bodies and sample responses.
