import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js'; // sendSuccess fix!
import * as studentService from './student.service.js';

// GET /api/v1/students
export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await studentService.list(req);
  sendList(res, rows, meta);
});

// GET /api/v1/students/:id
export const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, await studentService.getById(req, req.params.id));
});

// PUT /api/v1/students/:id
export const update = asyncHandler(async (req, res) => {
  const updated = await studentService.update(req, req.params.id, req.body);
  sendSuccess(res, updated);
});
// DELETE /api/v1/students/:id
export const remove = asyncHandler(async (req, res) => {
  await studentService.remove(req, req.params.id);
  // No content needed; 200 with empty body or 204 is fine.
  // The utils lib has a helper for 204, but sendSuccess with null works too.
  res.status(204).send(); // or: sendSuccess(res, null);
});
