import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as handoverService from './handover.service.js';

export const listStudentDocuments = asyncHandler(async (req, res) => {
  const result = await handoverService.listStudentDocuments(req, req.params.studentId);

  sendSuccess(res, result);
});
export const uploadSignature = asyncHandler(async (req, res) => {
  const result = await handoverService.uploadSignature(req, req.body.studentId);

  sendSuccess(res, result, 201);
});
export const uploadReceiverPhoto = asyncHandler(async (req, res) => {
  const result = await handoverService.uploadReceiverPhoto(req, req.body.studentId);

  sendSuccess(res, result, 201);
});
export const submitHandover = asyncHandler(async (req, res) => {
  const result = await handoverService.submitHandover(req, req.body);

  sendSuccess(res, result, 201);
});
export const listHandoverHistory = asyncHandler(async (req, res) => {
  const result = await handoverService.listHandoverHistory(req);

  sendList(res, result.rows, result.meta);
});
