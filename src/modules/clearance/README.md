# clearance: TC application and department clearance (Module B)

**Owner:** Module B, Phase 2. Empty until built. Copy `modules/courses`.

| SRS ID | Requirement                                                                                                              | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------------ | ----- |
| CLR-01 | TC application records last class attended, reason for leaving, documents enclosed, declarations on fees, dues and books | P1    |
| CLR-02 | Submitting an application creates a clearance item for every department of the institute                                 | P1    |
| CLR-03 | Each department sees its own queue and marks Clear / Not clear with remark and amount due                                | P1    |
| CLR-04 | Student profile shows each department as green / red / pending                                                           | P1    |
| CLR-05 | Accounts sees the pending fee amount (manual entry for now)                                                              | P1    |

Notes:

- A DEPT_INCHARGE only sees items where `departmentId === req.scope.departmentId` (add it to the filter in the service). A test must prove one department cannot see another department queue.
- Departments come from `modules/institutes/department.model.js`. Acceptance: AC-05.
