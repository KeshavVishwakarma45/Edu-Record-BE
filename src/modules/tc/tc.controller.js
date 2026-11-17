import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as tcService from './tc.service.js';

// 1. Submit TC for Principal Approval
export const submit = asyncHandler(async (req, res) => {
  const result = await tcService.submit(req, req.params.id);
  sendSuccess(res, result);
});

// 2. Principal Approval
export const approve = asyncHandler(async (req, res) => {
  const result = await tcService.approve(req, req.params.id);
  sendSuccess(res, result);
});

// 3. Principal Rejection
export const reject = asyncHandler(async (req, res) => {
  const result = await tcService.reject(req, req.params.id);
  sendSuccess(res, result);
});

// 4. Generate / Download TC PDF
export const pdf = asyncHandler(async (req, res) => {
  const pdfBuffer = await tcService.generatePdf(req, req.params.id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="TC-${req.params.id}.pdf"`);

  res.status(200).send(pdfBuffer);
});

// 5. Final TC Handover / Issue
export const issue = asyncHandler(async (req, res) => {
  const result = await tcService.issue(req, req.params.id);
  sendSuccess(res, result);
});

// 6. TC History
export const history = asyncHandler(async (req, res) => {
  const result = await tcService.history(req, req.params.id);
  sendSuccess(res, result);
});
