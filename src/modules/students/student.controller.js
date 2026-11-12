import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as studentService from './student.service.js';

export const downloadImportTemplate = asyncHandler(async (req, res) => {
  const buffer = await studentService.downloadImportTemplate();

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  res.setHeader('Content-Disposition', 'attachment; filename="students-import-template.xlsx"');

  res.send(buffer);
});

export const importStudents = asyncHandler(async (req, res) => {
  const result = await studentService.importStudents(req);

  sendSuccess(res, result);
});
