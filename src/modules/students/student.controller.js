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
