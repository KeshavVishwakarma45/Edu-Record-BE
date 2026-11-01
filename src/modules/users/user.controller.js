import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as userService from './user.service.js';

// Never send secrets back: only the public fields of a user
const publicFields = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  status: user.status,
});

export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await userService.list(req);
  sendList(res, rows, meta);
});

export const options = asyncHandler(async (req, res) => {
  sendSuccess(res, await userService.options(req));
});

export const invite = asyncHandler(async (req, res) => {
  const { user, inviteLink, expiresAt } = await userService.invite(req, req.body);
  sendSuccess(res, { user: publicFields(user), inviteLink, expiresAt }, 201);
});

export const setAccess = asyncHandler(async (req, res) => {
  sendSuccess(res, publicFields(await userService.setAccess(req, req.params.id, req.body)));
});

export const removeAccess = asyncHandler(async (req, res) => {
  await userService.removeAccess(req, req.params.id);
  sendSuccess(res, { id: req.params.id });
});

export const setupLink = asyncHandler(async (req, res) => {
  sendSuccess(res, await userService.setupLink(req, req.params.id));
});

export const disable = asyncHandler(async (req, res) => {
  sendSuccess(res, publicFields(await userService.setDisabled(req, req.params.id, true)));
});

export const enable = asyncHandler(async (req, res) => {
  sendSuccess(res, publicFields(await userService.setDisabled(req, req.params.id, false)));
});
