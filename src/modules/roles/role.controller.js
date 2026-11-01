import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as roleService from './role.service.js';

export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await roleService.list(req);
  sendList(res, rows, meta);
});

export const templates = (req, res) => {
  sendSuccess(res, roleService.templates());
};

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, await roleService.create(req, req.body), 201);
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await roleService.update(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await roleService.remove(req, req.params.id);
  sendSuccess(res, { id: req.params.id });
});
