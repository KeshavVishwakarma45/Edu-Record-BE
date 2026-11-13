import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
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

// GET /api/v1/students/import-template
export const downloadImportTemplate = asyncHandler(async (req, res) => {
  const buffer = await studentService.downloadImportTemplate();

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  res.setHeader('Content-Disposition', 'attachment; filename="students-import-template.xlsx"');

  res.send(buffer);
});

// POST /api/v1/students/import
export const importStudents = asyncHandler(async (req, res) => {
  const result = await studentService.importStudents(req);
  sendSuccess(res, result);
});
