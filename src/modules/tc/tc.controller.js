import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as tcService from './tc.service.js';

// Eligibility and preview
export const checkEligibility = asyncHandler(async (req, res) => {
  const result = await tcService.checkEligibility(req, req.params.studentId);
  sendSuccess(res, result);
});

export const getTCData = asyncHandler(async (req, res) => {
  const result = await tcService.getTCData(req, req.params.studentId);
  sendSuccess(res, result);
});

// Draft APIs
export const createTC = asyncHandler(async (req, res) => {
  const result = await tcService.createTC(req, req.body);
  sendSuccess(res, result, 201);
});

export const listTCs = asyncHandler(async (req, res) => {
  const result = await tcService.listTCs(req);
  sendList(res, result.rows, result.meta);
});

export const getTCById = asyncHandler(async (req, res) => {
  const result = await tcService.getTCById(req, req.params.id);
  sendSuccess(res, result);
});

export const updateTC = asyncHandler(async (req, res) => {
  const result = await tcService.updateTC(req, req.params.id, req.body);
  sendSuccess(res, result);
});

// Six TC workflow APIs
export const submit = asyncHandler(async (req, res) => {
  const result = await tcService.submit(req, req.params.id);
  sendSuccess(res, result);
});

export const approve = asyncHandler(async (req, res) => {
  const result = await tcService.approve(req, req.params.id);
  sendSuccess(res, result);
});

export const reject = asyncHandler(async (req, res) => {
  const result = await tcService.reject(req, req.params.id);
  sendSuccess(res, result);
});

export const pdf = asyncHandler(async (req, res) => {
  const pdfBuffer = await tcService.generatePdf(req, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="TC-${req.params.id}.pdf"`);
  res.status(200).send(pdfBuffer);
});

export const issue = asyncHandler(async (req, res) => {
  const result = await tcService.issue(req, req.params.id);
  sendSuccess(res, result);
});

export const history = asyncHandler(async (req, res) => {
  const result = await tcService.history(req, req.params.id);
  sendSuccess(res, result);
});
