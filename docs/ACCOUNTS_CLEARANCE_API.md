# Accounts Role – Clearance API Documentation

**Module:** Clearance
**Version:** P1
**Audience:** Frontend Development Team
**Base URL:** `/api/v1/clearance`

---

## 1. Overview

This document describes the backend APIs available for the Accounts role.

The Accounts role is responsible for:

- Viewing pending dues for the Accounts Department.
- Viewing the total pending dues count.
- Updating pending dues amounts and remarks.
- Processing Accounts Department clearance.
- Viewing Accounts Department clearance history.

Accounts users can process only the Accounts Department clearance items.

Department In-charge users can process only their assigned departments. They cannot access Accounts Department operations.

## 2. Authentication and Headers

All APIs require authentication.

| Header         | Required  | Description                         |
| -------------- | --------- | ----------------------------------- |
| Authorization  | Yes       | Bearer access token                 |
| X-Institute-Id | Yes       | Selected institute MongoDB ObjectId |
| Content-Type   | For PATCH | application/json                    |

Example:

```http
Authorization: Bearer <access_token>
X-Institute-Id: <institute_object_id>
Content-Type: application/json
```

The backend validates the selected institute against the authenticated user's tenant and institute access.

The frontend must not use a department ID supplied by the client to establish authorization.

## 3. API Endpoints

| Method | Endpoint                  | Purpose                              |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/accounts/pending-dues`  | Get Accounts Department pending dues |
| GET    | `/accounts/pending-count` | Get pending dues count               |
| GET    | `/accounts/history`       | Get Accounts clearance history       |
| PATCH  | `/items/:itemId/dues`     | Update pending dues                  |
| PATCH  | `/items/:itemId`          | Update Accounts Department clearance |

All endpoints are relative to `/api/v1/clearance`.

---

## 4. GET – Accounts Pending Dues

**Endpoint:**

```http
GET /api/v1/clearance/accounts/pending-dues
```

**Purpose:**

Returns clearance records belonging to the Accounts Department where `amountDue > 0`.

The API is institute-scoped and supports pagination and filtering.

### Query Parameters

| Parameter    | Type     | Required | Description                         |
| ------------ | -------- | -------- | ----------------------------------- |
| page         | Integer  | No       | Page number                         |
| limit        | Integer  | No       | Records per page; maximum 100       |
| search       | String   | No       | Search student information          |
| sort         | String   | No       | Sort by supported fields            |
| departmentId | ObjectId | No       | Optional Accounts Department filter |
| fromDate     | ISO date | No       | Start date filter                   |
| toDate       | ISO date | No       | End date filter                     |

**Important:**

- The API returns only Accounts Department dues.
- If `departmentId` is supplied, it must identify the Accounts Department.
- Other department records are not included.
- Only records with a positive `amountDue` are returned.

### Example Request

```http
GET /api/v1/clearance/accounts/pending-dues?page=1&limit=20&search=Rahul
```

### Success Response

The list API uses the standard list response format:

```json
{
  "success": true,
  "data": [
    {
      "_id": "<clearance_item_id>",
      "applicationId": "<application_id>",
      "studentId": "<student_id>",
      "departmentId": "<accounts_department_id>",
      "status": "PENDING",
      "remark": "",
      "amountDue": 2500
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

The example shows the core clearance item fields. Use the actual returned student and department fields when rendering the UI.

---

## 5. GET – Accounts Pending Count

**Endpoint:**

```http
GET /api/v1/clearance/accounts/pending-count
```

**Purpose:**

Returns the count of Accounts Department clearance records with pending dues (`amountDue > 0`).

### Query Parameters

None.

### Success Response

```json
{
  "success": true,
  "data": {
    "pendingCount": 12
  }
}
```

**Frontend Usage:**

Use `pendingCount` for the Accounts dashboard pending-dues counter.

This is separate from:

```http
GET /api/v1/clearance/queue/pending-count
```

The queue pending count belongs to the Department In-charge workflow and should not be used for the Accounts dashboard.

---

## 6. PATCH – Update Accounts Pending Dues

**Endpoint:**

```http
PATCH /api/v1/clearance/items/:itemId/dues
```

**Purpose:**

Allows Accounts users to update the pending dues amount and remark for an Accounts Department clearance item.

### Path Parameters

| Parameter | Type             | Required |
| --------- | ---------------- | -------- |
| itemId    | MongoDB ObjectId | Yes      |

### Request Body

| Field     | Type   | Required | Validation                          |
| --------- | ------ | -------- | ----------------------------------- |
| amountDue | Number | Yes      | Minimum 0, maximum 2 decimal places |
| remark    | String | No       | Maximum 500 characters              |

### Example Request

```json
{
  "amountDue": 2500,
  "remark": "Pending semester fees"
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "_id": "<clearance_item_id>",
    "amountDue": 2500,
    "remark": "Pending semester fees"
  }
}
```

**Important Rules:**

- Only Accounts Department clearance items can be updated through this endpoint.
- The amount cannot be negative.
- The amount supports up to two decimal places.
- Changes are recorded in the audit log.
- The backend validates institute scope and record ownership.

---

## 7. PATCH – Update Accounts Department Clearance

**Endpoint:**

```http
PATCH /api/v1/clearance/items/:itemId
```

**Purpose:**

Allows Accounts users to process the Accounts Department clearance decision.

### Path Parameters

| Parameter | Type             | Required |
| --------- | ---------------- | -------- |
| itemId    | MongoDB ObjectId | Yes      |

### Request Body

| Field     | Type   | Required | Validation                          |
| --------- | ------ | -------- | ----------------------------------- |
| status    | String | No       | CLEAR or NOT_CLEAR                  |
| remark    | String | No       | Maximum 500 characters              |
| amountDue | Number | No       | Minimum 0, maximum 2 decimal places |

At least one field must be provided.

When status is `NOT_CLEAR`, a non-empty remark is mandatory.

### Example 1 – Mark as CLEAR

```json
{
  "status": "CLEAR",
  "remark": "Accounts dues verified"
}
```

### Example 2 – Mark as NOT_CLEAR

```json
{
  "status": "NOT_CLEAR",
  "remark": "Pending fees need to be cleared"
}
```

### Example 3 – Update Remark

```json
{
  "remark": "Rechecked by Accounts Department"
}
```

### Example 4 – Update Amount

```json
{
  "amountDue": 0
}
```

### Success Response

```json
{
  "success": true,
  "data": {
    "_id": "<clearance_item_id>",
    "status": "CLEAR",
    "remark": "Accounts dues verified",
    "amountDue": 0,
    "statusUpdatedBy": "<user_id>",
    "statusUpdatedAt": "<ISO_DATE>"
  }
}
```

**Important Rules:**

- Accounts users can update only Accounts Department clearance items.
- Department In-charge users cannot update Accounts Department items.
- `PENDING` is not accepted as a PATCH decision status.
- `NOT_CLEAR` requires a reason.
- Changes are recorded in the audit log.

---

## 8. GET – Accounts Clearance History

**Endpoint:**

```http
GET /api/v1/clearance/accounts/history
```

**Purpose:**

Returns Accounts Department clearance activity from the existing append-only AuditLog collection.

### Query Parameters

| Parameter | Type     | Required | Description                               |
| --------- | -------- | -------- | ----------------------------------------- |
| page      | Integer  | No       | Page number; default 1                    |
| limit     | Integer  | No       | Records per page; default 20, maximum 100 |
| search    | String   | No       | Search student information                |
| studentId | ObjectId | No       | Filter by student                         |
| status    | String   | No       | PENDING, CLEAR or NOT_CLEAR               |
| dateFrom  | ISO date | No       | History date lower bound                  |
| dateTo    | ISO date | No       | History date upper bound                  |

### Example Request

```http
GET /api/v1/clearance/accounts/history?page=1&limit=20&status=CLEAR
```

### Success Response

```json
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
        "name": "Accounts Department"
      },
      "previous": {
        "status": "PENDING",
        "remarks": "",
        "amountDue": 2500
      },
      "current": {
        "status": "CLEAR",
        "remarks": "Accounts dues verified",
        "amountDue": 0
      },
      "performedBy": {
        "id": "<user_id>",
        "name": "Accounts User",
        "email": "accounts@example.com"
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
```

**History Notes:**

- History is retrieved from AuditLog.
- Records are restricted to Accounts Department.
- History supports pagination and filters.
- The frontend should treat history as read-only.
- Audit history is append-only; it is not a payment transaction history.

---

## 9. Permissions and Role Access

The Accounts endpoints use the backend `clearance.act` permission.

The Accounts service additionally checks the user's clearance and course-read capabilities and requires no assigned department IDs.

| Role                 | Accounts APIs                                                                      |
| -------------------- | ---------------------------------------------------------------------------------- |
| Accounts             | Allowed when configured with the required permissions and no department assignment |
| Department In-charge | Forbidden                                                                          |
| Principal            | Forbidden by default role permissions                                              |
| TC Clerk             | Forbidden by default role permissions                                              |
| Admin                | Allowed with configured permissions                                                |
| Super Admin          | Operational clearance updates are restricted                                       |

The backend determines authorization from the authenticated user's permissions and institute scope.

Frontend role checks are only for UI visibility. Backend authorization remains authoritative.

---

## 10. Clearance Status Rules

Allowed stored statuses:

- `PENDING`
- `CLEAR`
- `NOT_CLEAR`

Allowed PATCH decision statuses:

- `CLEAR`
- `NOT_CLEAR`

Rules:

- New clearance items start with `PENDING`.
- `NOT_CLEAR` requires a non-empty remark.
- The API does not accept `PENDING` as a PATCH decision.
- An existing decision can be updated to `CLEAR` or `NOT_CLEAR`.

---

## 11. Standard Error Response

Example:

```json
{
  "success": false,
  "error": {
    "code": "<ERROR_CODE>",
    "message": "A reason is required when clearance is marked NOT_CLEAR"
  }
}
```

Expected HTTP status codes:

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| 400    | Invalid request, ID, query parameter or body  |
| 401    | Missing or invalid authentication             |
| 403    | Permission or institute access denied         |
| 404    | Clearance item not found in the allowed scope |
| 500    | Unexpected server error                       |

The frontend should display the backend-provided error message where appropriate.

---

## 12. Frontend Integration Flow

Suggested Accounts dashboard integration:

1. Call `GET /accounts/pending-count` to display the pending dues counter.
2. Call `GET /accounts/pending-dues` to display the Accounts pending dues table.
3. Use pagination and search query parameters when required.
4. Call `PATCH /items/:itemId/dues` when updating the pending amount or remark.
5. Call `PATCH /items/:itemId` when processing the Accounts clearance decision.
6. Refresh the pending dues list and count after a successful update.
7. Call `GET /accounts/history` to display Accounts clearance activity.

The frontend should use the returned `meta` object for pagination.

---

## 13. Not Included in Current Implementation

The following functionality is not part of the currently implemented Accounts APIs:

### Student Fee Details and Payment History

The current clearance model does not provide a complete fee ledger containing:

- Total course fees
- Total paid fees
- Individual payment transactions
- Last payment date
- Receipt number and payment details

The source of this information (existing institute fee-management software/API or an approved manual workflow) must be confirmed before implementing this functionality.

Do not display hardcoded or dummy payment information.

### Duplicate TC Fee Receipt

The duplicate TC fee receipt workflow is not implemented in this Accounts API scope. It is identified as a P2 requirement.

---

## 14. Implementation and Verification

Implemented files:

- `src/modules/clearance/clearance.service.js`
- `src/modules/clearance/clearance.controller.js`
- `src/modules/clearance/clearance.routes.js`
- `src/modules/clearance/clearance.validation.js`
- `tests/clearanceApplication.test.js`

Verification:

- Full backend test suite: 201 passed, 6 skipped.
- ESLint: Passed.
- Git whitespace check: Passed.

Git details:

- Feature branch: `feature/ACC-01-accounts-clearance`
- Feature commit: `3163a45`
- Pull Request: #7
- Merge commit on dev: `e7fb652`

---

**Frontend Team Note:** Please integrate only the APIs and fields documented as currently implemented. Student fee payment details and duplicate TC fee receipt should remain out of the frontend integration until their requirements and data source are confirmed.
