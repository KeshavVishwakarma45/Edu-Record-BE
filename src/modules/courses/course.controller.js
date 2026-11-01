import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as courseService from './course.service.js';

// Controllers only read the request, call the service and send the response.
// No business rules here: those belong in course.service.js.

export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await courseService.list(req);
  sendList(res, rows, meta);
});

export const options = asyncHandler(async (req, res) => {
  sendSuccess(res, await courseService.options(req));
});

export const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, await courseService.getById(req, req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, await courseService.create(req, req.body), 201);
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, await courseService.update(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  await courseService.remove(req, req.params.id);
  sendSuccess(res, { id: req.params.id });
});
