import { asyncHandler } from '../../utils/asyncHandler.js';
import * as fileService from './file.service.js';

// Sends the file bytes instead of JSON. The client fetches it with the access token
// (an <img src> cannot send the token) and shows it with URL.createObjectURL(blob).
export const download = asyncHandler(async (req, res, next) => {
  const { file, stream } = await fileService.open(req, req.params.id);
  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': file.size,
    'Content-Disposition': 'inline',
    // Personal documents: never keep a copy in shared caches
    'Cache-Control': 'private, no-store',
  });
  stream.on('error', next);
  stream.pipe(res);
});
