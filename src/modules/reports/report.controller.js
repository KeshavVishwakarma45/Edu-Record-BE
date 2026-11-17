import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';

import * as reportService from './report.service.js';

// GET /api/v1/reports/not-received
export const getNotReceivedDocuments = asyncHandler(async (req, res) => {
  const { rows, meta } = await reportService.getNotReceivedDocuments(req);

  sendList(res, rows, meta);
});

// PATCH /api/v1/reports/not-received/:id/follow-up
export const updateFollowUp = asyncHandler(async (req, res) => {
  const document = await reportService.updateFollowUp(req, req.params.id, req.body);

  sendSuccess(res, {
    _id: document._id,
    status: document.status,
    reason: document.missingDetails?.reason,
    otherReason: document.missingDetails?.otherReason ?? '',
    followUpDate: document.missingDetails?.followUpDate,
  });
});
