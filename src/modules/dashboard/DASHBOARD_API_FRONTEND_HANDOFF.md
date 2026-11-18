# Dashboard API — Frontend Handoff

Base path: `/api/v1/dashboard`

All endpoints require authentication.

## 1. Authentication and institute selection

Send these headers with every request:

```http
Authorization: Bearer <accessToken>
X-Institute-Id: <instituteId>
```

For a Super Admin viewing all institutes, use:

```http
X-Institute-Id: all
```

A Super Admin can optionally filter dashboard data to one institute by passing `instituteId` as a query parameter where supported.

## 2. Endpoints

| Method | Endpoint         | Purpose                               |
| ------ | ---------------- | ------------------------------------- |
| GET    | `/summary`       | Dashboard summary counts              |
| GET    | `/attention`     | Records requiring attention           |
| GET    | `/recent-inward` | Recent inward batches                 |
| GET    | `/recent-tcs`    | Recently issued Transfer Certificates |

## 3. GET /summary

Example:

```http
GET /api/v1/dashboard/summary
```

Success response:

```json
{
  "success": true,
  "data": {
    "documentsNotReceived": 0,
    "documentsInCustody": 0,
    "clearancePending": 0,
    "tcsAwaitingPrincipalApproval": 0,
    "approvedTcsNotHandedOver": 0
  }
}
```

Fields:

| Field                          | Meaning                                                                     |
| ------------------------------ | --------------------------------------------------------------------------- |
| `documentsNotReceived`         | Documents marked Not received                                               |
| `documentsInCustody`           | Documents currently in custody                                              |
| `clearancePending`             | Distinct clearance applications with at least one PENDING or NOT_CLEAR item |
| `tcsAwaitingPrincipalApproval` | TCs with `pending_approval` status                                          |
| `approvedTcsNotHandedOver`     | TCs with `approved` status                                                  |

Counts for sections the logged-in user cannot access are returned as `0`.

## 4. GET /attention

Example:

```http
GET /api/v1/dashboard/attention?limit=5
```

Query parameters:

| Parameter     | Type   | Default | Rules                                     |
| ------------- | ------ | ------: | ----------------------------------------- |
| `limit`       | number |       5 | Integer from 1 to 20                      |
| `instituteId` | string |       — | Optional institute filter for Super Admin |

Success response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "recordId": "RECORD_ID",
        "type": "TC_PENDING_APPROVAL",
        "title": "TC waiting for Principal approval",
        "description": "Transfer Certificate is awaiting approval.",
        "status": "pending_approval",
        "student": {
          "id": "STUDENT_ID",
          "name": "Student Name",
          "scholarNo": "SCHOLAR_NUMBER",
          "enrollmentNo": "ENROLLMENT_NUMBER",
          "rollNo": "ROLL_NUMBER",
          "course": {
            "id": "COURSE_ID",
            "name": "BCA",
            "shortCode": "BCA"
          }
        },
        "createdAt": "2026-11-18T08:00:00.000Z"
      }
    ],
    "total": 4,
    "limit": 5
  }
}
```

Possible `type` values:

| Type                          | Meaning                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `TC_PENDING_APPROVAL`         | TC waiting for Principal approval                               |
| `DOCUMENT_NOT_RECEIVED`       | University document not received                                |
| `CLEARANCE_BLOCKED`           | Clearance application has pending or not-clear department items |
| `TC_APPROVED_NOT_HANDED_OVER` | Approved TC waiting to be handed over                           |

Additional fields:

- `DOCUMENT_NOT_RECEIVED` can include `documentType`.
- `CLEARANCE_BLOCKED` can include `pendingDepartments`, an array of department IDs, statuses and remarks.
- Student details are included when the student belongs to the selected institute.

Important: `total` is the total count across the permitted attention categories. `items` contains only the latest records up to `limit`, sorted by activity date.

## 5. GET /recent-inward

Example:

```http
GET /api/v1/dashboard/recent-inward?page=1&limit=10
```

Query parameters:

| Parameter     | Type   | Default | Rules                                     |
| ------------- | ------ | ------: | ----------------------------------------- |
| `page`        | number |       1 | Integer, minimum 1                        |
| `limit`       | number |      10 | Integer from 1 to 100                     |
| `instituteId` | string |       — | Optional institute filter for Super Admin |

Success response:

```json
{
  "success": true,
  "data": [
    {
      "batchId": "BATCH_ID",
      "course": {
        "id": "COURSE_ID",
        "name": "BCA",
        "shortCode": "BCA"
      },
      "examTerm": "Semester 1",
      "examSession": {
        "month": 6,
        "year": 2026
      },
      "documentType": "Marksheet",
      "receivedCount": 25,
      "totalExpected": 30,
      "missingCount": 5,
      "receivedDate": "2026-11-18T08:00:00.000Z",
      "referenceNumber": "INWARD-001"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1
  }
}
```

`receivedCount` counts documents with status `In custody`.
`missingCount` counts documents with status `Not received`.
`totalExpected` counts all documents associated with the batch.

## 6. GET /recent-tcs

Example:

```http
GET /api/v1/dashboard/recent-tcs?page=1&limit=10
```

Query parameters are the same as `/recent-inward`.

Success response:

```json
{
  "success": true,
  "data": [
    {
      "tcId": "TC_ID",
      "referenceNumber": "TC-2026-001",
      "bookSerial": "BOOK-001",
      "studentId": "STUDENT_ID",
      "studentName": "Student Name",
      "scholarNo": "SCHOLAR_NUMBER",
      "course": {
        "name": "BCA",
        "shortCode": "BCA"
      },
      "issueDate": "2026-11-18T08:00:00.000Z",
      "collectedBy": "Student Name"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1
  }
}
```

Only TCs with status `issued` are returned.

## 7. Permission behavior

Dashboard summary and attention are available when the user has at least one dashboard-readable permission.

| Dashboard section              | Required permission (any one)                                |
| ------------------------------ | ------------------------------------------------------------ |
| Inward counts and attention    | `inward.read`, `report.view`, `handover.issue`               |
| Clearance counts and attention | `clearance.view`, `clearance.act`, `tc.apply`, `report.view` |
| TC counts and attention        | `tc.read`, `tc.approve`, `tc.issue`, `report.view`           |
| Recent inward endpoint         | `inward.read`, `report.view`, `handover.issue`               |
| Recent TCs endpoint            | `tc.read`, `tc.approve`, `tc.issue`, `report.view`           |

The summary and attention endpoints return only the sections permitted for the logged-in user. Inaccessible summary counts remain `0`; inaccessible attention categories are omitted.

The recent-inward and recent-tcs endpoints require their respective route permissions. A user without the required permission receives a forbidden response.

## 8. Error handling

The frontend should handle these common HTTP statuses:

| Status | Meaning                                    |
| ------ | ------------------------------------------ |
| `200`  | Request successful                         |
| `400`  | Invalid query parameter                    |
| `401`  | Missing or invalid authentication          |
| `403`  | User does not have the required permission |
| `500`  | Unexpected server error                    |

Use the standard API error response returned by the backend.

## 9. Frontend integration notes

1. Fetch `/summary` when loading the dashboard cards.
2. Fetch `/attention?limit=5` for the attention panel.
3. Fetch `/recent-inward?page=1&limit=10` for the inward table.
4. Fetch `/recent-tcs?page=1&limit=10` for the issued-TC table.
5. Use `meta.total` for pagination controls on list endpoints.
6. Do not assume every dashboard section is visible to every role.
7. Refresh dashboard data after relevant inward, clearance or TC actions.
8. Use the selected institute's ID in `X-Institute-Id` when switching institute context.
