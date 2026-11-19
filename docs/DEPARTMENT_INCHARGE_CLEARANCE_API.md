# Department In-charge – Clearance API Documentation

Version: P1
Module: Clearance
Base URL: /api/v1/clearance

## 1. Authentication and department scope

All endpoints require:

- Authorization: Bearer <access_token>
- X-Institute-Id: <institute_object_id>

The department assignment is obtained from the authenticated user's
institute role and stored in req.scope.departmentIds.

The frontend must not use a department ID from the request body or
header to establish authorization.

An optional departmentId query parameter on the queue endpoint can
only narrow the result to an already assigned department.

The P1 Department In-charge role should be configured with one
department assignment.

Permissions:

- GET endpoints: clearance.view
- PATCH department clearance: clearance.act

## 2. GET APIs

### 2.1 Department clearance queue

GET /api/v1/clearance/queue

Query parameters:

| Parameter    | Type     | Required | Description                                                               |
| ------------ | -------- | -------- | ------------------------------------------------------------------------- |
| page         | integer  | No       | Page number, default 1                                                    |
| limit        | integer  | No       | Records per page, default 20, maximum 100                                 |
| search       | string   | No       | Student name, scholar number or roll number                               |
| sort         | string   | No       | createdAt, -createdAt, status, -status, statusUpdatedAt, -statusUpdatedAt |
| status       | string   | No       | PENDING, CLEAR, NOT_CLEAR                                                 |
| departmentId | ObjectId | No       | Optional assigned-department filter                                       |
| dateFrom     | ISO date | No       | Application creation date lower bound                                     |
| dateTo       | ISO date | No       | Application creation date upper bound                                     |

Legacy aliases fromDate and toDate are also supported.

departmentId is never trusted for access control. The service checks
it against the authenticated user's department assignments.

Success response:

{
"success": true,
"data": [
{
"_id": "<clearance_item_id>",
"applicationId": "<application_id>",
"studentId": "<student_id>",
"departmentId": "<department_id>",
"status": "PENDING",
"remark": "",
"amountDue": 0,
"student": {
"_id": "<student_id>",
"name": "Rahul Sharma",
"scholarNo": "CLR001",
"rollNo": "101"
},
"application": {
"applicationId": "<application_id>",
"lastClassAttended": "B.Com Final Year",
"leavingReason": "Higher studies",
"applicationDate": "<ISO_DATE>"
},
"departmentName": "Library",
"departmentOrder": 1
}
],
"meta": {
"page": 1,
"limit": 20,
"total": 1
}
}

### 2.2 Pending clearance count

GET /api/v1/clearance/queue/pending-count

No query parameters.

Counts PENDING clearance items belonging to assigned departments.

Success response:

{
"success": true,
"data": {
"pendingCount": 12
}
}

### 2.3 Clearance application details

GET /api/v1/clearance/applications/:clearanceApplicationId

Path parameter:

| Parameter              | Type             | Required |
| ---------------------- | ---------------- | -------- |
| clearanceApplicationId | MongoDB ObjectId | Yes      |

Returns the application only when it has a clearance item in
the authenticated user's assigned department.

Success response:

{
"success": true,
"data": {
"application": {
"_id": "<application_id>",
"studentId": "<student_id>",
"lastClassAttended": "B.Com Final Year",
"leavingReason": "Higher studies",
"documentsEnclosed": {
"tenthMarksheet": true,
"twelfthMarksheet": true,
"yearSemesterMarksheets": true
},
"submittedDocuments": [
"tenthMarksheet",
"twelfthMarksheet",
"yearSemesterMarksheets"
],
"declarations": {
"feesPaid": true,
"duesCleared": true,
"booksReturned": true
},
"submittedAt": "<ISO_DATE>"
},
"student": {
"_id": "<student_id>",
"name": "Rahul Sharma",
"scholarNo": "CLR001"
},
"departmentClearances": [
{
"clearanceItemId": "<clearance_item_id>",
"department": {
"_id": "<department_id>",
"name": "Library",
"order": 1,
"mandatory": true
},
"verificationStatus": "PENDING",
"remarks": "",
"amountDue": 0,
"verifiedBy": null,
"verifiedAt": null
}
]
}
}

Important: submittedDocuments represents the application checkboxes.
It does not represent separate document-level verification records.

### 2.4 Department clearance history

GET /api/v1/clearance/history

Query parameters:

| Parameter | Type     | Required | Description               |
| --------- | -------- | -------- | ------------------------- |
| page      | integer  | No       | Default 1                 |
| limit     | integer  | No       | Default 20, maximum 100   |
| studentId | ObjectId | No       | Filter by student         |
| status    | string   | No       | PENDING, CLEAR, NOT_CLEAR |
| dateFrom  | ISO date | No       | History date lower bound  |
| dateTo    | ISO date | No       | History date upper bound  |

History is read from the existing append-only AuditLog collection.
Records are restricted to assigned department IDs.

Success response:

{
"success": true,
"data": [
{
"historyId": "<audit_log_id>",
"clearanceItemId": "<clearance_item_id>",
"action": "UPDATE",
"student": {
"_id": "<student_id>",
"name": "Rahul Sharma",
"scholarNo": "CLR001"
},
"department": {
"_id": "<department_id>",
"name": "Library"
},
"previous": {
"status": "PENDING",
"remarks": "",
"amountDue": 0
},
"current": {
"status": "CLEAR",
"remarks": "Books returned",
"amountDue": 0
},
"performedBy": {
"id": "<user_id>",
"name": "Library In-charge",
"email": "library@example.com"
},
"timestamp": "<ISO_DATE>"
}
],
"meta": {
"page": 1,
"limit": 20,
"total": 1
}
}

History is append-only. Initial PENDING creation events are recorded
for new clearance applications. Earlier applications are not
retroactively backfilled.

## 3. PATCH API

### 3.1 Update department clearance item

PATCH /api/v1/clearance/items/:itemId

Permission: clearance.act

Path parameter:

| Parameter | Type             | Required |
| --------- | ---------------- | -------- |
| itemId    | MongoDB ObjectId | Yes      |

Request body:

| Field     | Type   | Required | Validation                          |
| --------- | ------ | -------- | ----------------------------------- |
| status    | string | No       | CLEAR or NOT_CLEAR                  |
| remark    | string | No       | Maximum 500 characters              |
| amountDue | number | No       | Minimum 0, maximum 2 decimal places |

At least one field must be provided.

For NOT_CLEAR, a non-empty remark is mandatory.

Example – clear department:

{
"status": "CLEAR",
"remark": "All library books returned"
}

Example – mark not clear:

{
"status": "NOT_CLEAR",
"remark": "Library book has not been returned"
}

Example – update remarks only:

{
"remark": "Rechecked by Library"
}

Example – update amount:

{
"amountDue": 250
}

Success response:

{
"success": true,
"data": {
"_id": "<clearance_item_id>",
"status": "CLEAR",
"remark": "All library books returned",
"amountDue": 0,
"statusUpdatedBy": "<user_id>",
"statusUpdatedAt": "<ISO_DATE>"
}
}

The system records changes in AuditLog.

## 4. Permissions and access

| Action                                        | Department In-charge      |
| --------------------------------------------- | ------------------------- |
| View assigned department queue                | Allowed                   |
| View assigned application details             | Allowed                   |
| View pending count                            | Allowed                   |
| View assigned department history              | Allowed                   |
| Mark CLEAR                                    | Allowed                   |
| Mark NOT_CLEAR                                | Allowed, reason required  |
| Update remarks                                | Allowed                   |
| Update amountDue                              | Allowed                   |
| View institute-wide clearance applications    | Forbidden                 |
| View all-department student clearance profile | Forbidden                 |
| Update another department item                | Not found                 |
| Manage Accounts dues                          | Forbidden                 |
| Create TC application                         | Not included in this role |

Department authorization is derived from req.scope.departmentIds.
A department ID in a frontend request cannot grant access.

## 5. Status rules

Allowed stored statuses:

- PENDING
- CLEAR
- NOT_CLEAR

PATCH action statuses:

- CLEAR
- NOT_CLEAR

PENDING is assigned when a new clearance item is created.
It is not accepted as a PATCH action status.

The current implementation permits an existing decision to be
updated to CLEAR or NOT_CLEAR. A transition back to PENDING is
not supported through this API.

## 6. Error response format

All known errors use the standard backend response format.

Example:

{
"success": false,
"error": {
"code": "<ERROR_CODE>",
"message": "A reason is required when clearance is marked NOT_CLEAR"
}
}

Expected HTTP errors:

- 400: Invalid ID, query or request body
- 401: Missing or invalid authentication
- 403: Missing permission or department assignment
- 404: Application or clearance item not found in assigned scope
- 500: Unexpected server error

## 7. P1 scope and implementation status

| Requirement                          | Current status                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| CLR-01 TC application                | Existing implementation                                      |
| CLR-02 Generate department items     | Existing implementation                                      |
| CLR-03 Department queue and decision | Existing + updated                                           |
| CLR-04 Student clearance profile     | Existing implementation, not exposed to Department In-charge |
| CLR-05 Accounts dues                 | Existing implementation                                      |

Additional Department In-charge frontend APIs:

- Queue pending count: implemented and integration tested
- Application details: implemented and integration tested
- Department history: implemented and integration tested
- Queue dateFrom/dateTo aliases: implemented and integration tested

Individual document verification and a separate final submission API
are not supported by the current P1 data model.

Document-level verification requires a separate document verification
model and an agreed P1/P2 scope decision.

Latest verification:

- Clearance tests: 12 passed
- Full backend tests: 197 passed, 6 skipped
- Full test suites: 25 passed, 1 skipped
- ESLint: passed
- Prettier: passed
- git diff --check: passed
