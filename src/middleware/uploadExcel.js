import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';

const MAX_EXCEL_SIZE = 2 * 1024 * 1024;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const uploadExcel = (fieldName = 'file') => {
  const parser = multer({
    storage: multer.memoryStorage(),

    limits: {
      fileSize: MAX_EXCEL_SIZE,
      files: 1,
    },

    fileFilter: (_req, file, done) => {
      const isXlsx = file.originalname.toLowerCase().endsWith('.xlsx');

      if (isXlsx && file.mimetype === XLSX_MIME) {
        return done(null, true);
      }

      return done(
        new ApiError(400, ERROR_CODES.INVALID_FILE, 'Only .xlsx Excel files are allowed'),
      );
    },
  }).single(fieldName);

  return (req, res, next) => {
    parser(req, res, (err) => {
      if (err) {
        return next(err);
      }

      if (!req.file) {
        return next(
          new ApiError(400, ERROR_CODES.INVALID_FILE, `Attach an Excel file in "${fieldName}"`),
        );
      }

      const signature = req.file.buffer.subarray(0, 4).toString('hex');

      if (!['504b0304', '504b0506', '504b0708'].includes(signature)) {
        return next(
          new ApiError(
            400,
            ERROR_CODES.INVALID_FILE,
            'The uploaded file is not a valid .xlsx file',
          ),
        );
      }

      next();
    });
  };
};
