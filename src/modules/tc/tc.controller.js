import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as tcService from './tc.service.js';

// Check student eligibility for Transfer Certificate
export const checkEligibility = asyncHandler(async (req, res) => {
  const result = await tcService.checkEligibility(req, req.params.studentId);

  sendSuccess(res, result);
});

// Get Transfer Certificate data for preview
export const getTCData = asyncHandler(async (req, res) => {
  const result = await tcService.getTCData(req, req.params.studentId);

  sendSuccess(res, result);
});

// Create a new TC draft
export const createTC = asyncHandler(async (req, res) => {
  const result = await tcService.createTC(req, req.body);
  sendSuccess(res, result, 201);
});

// Get list of Transfer Certificates
export const listTCs = asyncHandler(async (req, res) => {
  const result = await tcService.listTCs(req);

  sendList(res, result.rows, result.meta);
});

// Get individual Transfer Certificate details
export const getTCById = asyncHandler(async (req, res) => {
  const result = await tcService.getTCById(req, req.params.id);

  sendSuccess(res, result);
});
