import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as dashboardService from './dashboard.service.js';

export const getSummary = asyncHandler(async (req, res) => {
  const result = await dashboardService.getSummary(req);
  sendSuccess(res, result);
});

export const getAttention = asyncHandler(async (req, res) => {
  const result = await dashboardService.getAttention(req);
  sendSuccess(res, result);
});

export const getRecentInwardBatches = asyncHandler(async (req, res) => {
  const { rows, meta } = await dashboardService.getRecentInwardBatches(req);
  sendList(res, rows, meta);
});

export const getRecentIssuedTcs = asyncHandler(async (req, res) => {
  const { rows, meta } = await dashboardService.getRecentIssuedTcs(req);
  sendList(res, rows, meta);
});
