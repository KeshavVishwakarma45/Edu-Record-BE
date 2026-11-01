import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as organisationService from './organisation.service.js';

export const overview = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.overview(req));
});

export const universities = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.universities());
});

export const createInstitute = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.createInstitute(req, req.body), 201);
});

export const updateInstitute = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.updateInstitute(req, req.params.id, req.body));
});

export const previewCombine = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.previewCombine(req, req.body));
});

export const combine = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.combine(req, req.body), 201);
});

export const renameUnit = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.renameUnit(req, req.params.id, req.body));
});

export const previewJoin = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.previewJoin(req, req.params.id, req.body));
});

export const joinUnit = asyncHandler(async (req, res) => {
  await organisationService.joinUnit(req, req.params.id, req.body);
  sendSuccess(res, { id: req.params.id });
});

export const removeFromUnit = asyncHandler(async (req, res) => {
  sendSuccess(res, await organisationService.removeFromUnit(req, req.params.id, req.body));
});

export const separate = asyncHandler(async (req, res) => {
  await organisationService.separate(req, req.params.id);
  sendSuccess(res, { id: req.params.id });
});
