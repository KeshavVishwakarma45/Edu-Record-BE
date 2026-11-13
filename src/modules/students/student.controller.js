import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as studentService from './student.service.js';

// Controller handles HTTP request and response.
// Business logic stays inside student.service.js.

export const create = asyncHandler(async (req, res) => {
  const student = await studentService.create(req, req.body);

  sendSuccess(res, student, 201);
});

// Update student status
export const updateStatus = asyncHandler(async (req, res) => {
  const student = await studentService.updateStatus(req, req.params.studentId, req.body.status);

  sendSuccess(res, student, 200);
});
