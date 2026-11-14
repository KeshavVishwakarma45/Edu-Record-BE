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

// POST /api/v1/students
export const create = asyncHandler(async (req, res) => {
  const student = await studentService.create(req, req.body);
  sendSuccess(res, student, 201);
});

// PATCH /api/v1/students/:studentId/status
export const updateStatus = asyncHandler(async (req, res) => {
  const student = await studentService.updateStatus(req, req.params.studentId, req.body.status);

  sendSuccess(res, student, 200);
});

// PATCH /api/v1/students/:id/photo
export const uploadPhoto = asyncHandler(async (req, res) => {
  const student = await studentService.uploadPhoto(req, req.params.id, req.file);

  sendSuccess(res, student, 200);
});
