import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { ERROR_CODES } from '../utils/errorCodes.js';

// File upload rules: images up to 2 MB (jpg, png, webp), PDFs up to 5 MB.
// Files stay in memory (req.file.buffer) until the service saves them with utils/storage.js.
//
// Use in a route, before validate:
//   router.post('/:id/photo', auth, tenantScope, requirePermission(...), uploadImage('photo'),
//               validate({ params: idParams }), controller.uploadPhoto);

const MB = 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF_TYPES = ['application/pdf'];
const MAX_SIZE = { image: 2 * MB, pdf: 5 * MB };

// The browser-sent type can be faked, so the first bytes of the file are checked too
function looksLike(buffer, mimeType) {
  const head = buffer.subarray(0, 12);
  if (mimeType === 'image/jpeg') return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mimeType === 'image/png') return head.subarray(0, 4).toString('hex') === '89504e47';
  if (mimeType === 'image/webp') {
    return head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP';
  }
  if (mimeType === 'application/pdf') return head.subarray(0, 4).toString() === '%PDF';
  return false;
}

function invalidFile(message) {
  return new ApiError(400, ERROR_CODES.INVALID_FILE, message);
}

function makeUpload(fieldName, allowedTypes) {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE.pdf, files: 1 },
    fileFilter: (_req, file, done) => {
      if (allowedTypes.includes(file.mimetype)) return done(null, true);
      done(invalidFile(`Only ${allowedTypes.join(', ')} files are allowed`));
    },
  }).single(fieldName);

  return (req, res, next) => {
    parser(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) return next(invalidFile(`Please attach a file in "${fieldName}"`));

      const isImage = IMAGE_TYPES.includes(req.file.mimetype);
      if (isImage && req.file.size > MAX_SIZE.image) {
        return next(invalidFile('Images must be 2 MB or smaller'));
      }
      if (!looksLike(req.file.buffer, req.file.mimetype)) {
        return next(invalidFile('The file content does not match its type'));
      }
      next();
    });
  };
}

export const uploadImage = (fieldName) => makeUpload(fieldName, IMAGE_TYPES);
export const uploadPdf = (fieldName) => makeUpload(fieldName, PDF_TYPES);
export const uploadImageOrPdf = (fieldName) =>
  makeUpload(fieldName, [...IMAGE_TYPES, ...PDF_TYPES]);
