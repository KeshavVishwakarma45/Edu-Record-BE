import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as inwardService from './inward.service.js';

export const getStudents = asyncHandler(async (req, res) => {
  const students = await inwardService.getStudents(req, req.params.id);
  sendSuccess(res, students);
});

export const createReceipt = asyncHandler(async (req, res) => {
  const receipt = await inwardService.createReceipt(req, req.params.id, req.body);
  sendSuccess(res, receipt);
});

export const updateReceipt = asyncHandler(async (req, res) => {
  const receipt = await inwardService.updateReceipt(
    req,
    req.params.id,
    req.params.receiptId,
    req.body,
  );
  sendSuccess(res, receipt);
});

export const receiveMissing = asyncHandler(async (req, res) => {
  const receipt = await inwardService.receiveMissing(
    req,
    req.params.newBatchId,
    req.params.missingId,
    req.body,
  );
  sendSuccess(res, receipt);
});
