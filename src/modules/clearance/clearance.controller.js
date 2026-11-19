import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';

import * as clearanceService from './clearance.service.js';

// CLR-01: Create TC clearance application.
export const createApplication = asyncHandler(async (req, res) => {
  const result = await clearanceService.createApplication(req, req.body);

  sendSuccess(res, result, 201);
});

// CLR-02: List clearance applications.
export const listApplications = asyncHandler(async (req, res) => {
  const { rows, meta } = await clearanceService.listApplications(req);

  sendList(res, rows, meta);
});

// CLR-03: Department in-charge queue.
export const listDepartmentQueue = asyncHandler(async (req, res) => {
  const { rows, meta } = await clearanceService.listDepartmentQueue(req);

  sendList(res, rows, meta);
});

// CLR-03: Update department clearance item.
export const updateClearanceItem = asyncHandler(async (req, res) => {
  const result = await clearanceService.updateClearanceItem(req, req.params.itemId, req.body);

  sendSuccess(res, result);
});

// CLR-04: Student-wise clearance profile.
export const getStudentClearance = asyncHandler(async (req, res) => {
  const result = await clearanceService.getStudentClearance(req, req.params.studentId);

  sendSuccess(res, result);
});

// CLR-05: Accounts pending dues list.
export const listPendingDues = asyncHandler(async (req, res) => {
  const { rows, meta } = await clearanceService.listPendingDues(req);

  sendList(res, rows, meta);
});

// CLR-05: Update accounts dues.
export const updateClearanceDues = asyncHandler(async (req, res) => {
  const result = await clearanceService.updateClearanceDues(req, req.params.itemId, req.body);

  sendSuccess(res, result);
});

// Department in-charge: get pending clearance count.
export const getDepartmentPendingCount = asyncHandler(async (req, res) => {
  const result = await clearanceService.getDepartmentPendingCount(req);

  sendSuccess(res, result);
});

// Department in-charge: get application details for assigned department only.
export const getDepartmentApplicationDetails = asyncHandler(async (req, res) => {
  const result = await clearanceService.getDepartmentApplicationDetails(
    req,
    req.params.clearanceApplicationId,
  );

  sendSuccess(res, result);
});

// Department in-charge: get clearance history.
export const listDepartmentHistory = asyncHandler(async (req, res) => {
  const { rows, meta } = await clearanceService.listDepartmentHistory(req);

  sendList(res, rows, meta);
});
