import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { File } from '../modules/files/file.model.js';

// All file handling goes through these three functions (save, getStream, remove).
// Today files sit in a private local folder (UPLOAD_DIR) that is never served directly;
// they are only reachable through GET /api/v1/files/:id, which checks tenant and institute.
// Later (P3) these functions switch to cloud storage without any module code changing.

// The storage key is made by the server, never from the user's file name, so nobody can
// write outside UPLOAD_DIR with a name like "../../server.js".
function absolutePath(storageKey) {
  return path.join(env.UPLOAD_DIR, storageKey);
}

// Save an uploaded file (from middleware/upload.js, so req.file.buffer) and record it.
// Returns the File document; store its _id on your record (e.g. student.photo = file._id).
export async function save(req, uploaded, session) {
  const { tenantId, instituteId } = req.scope;
  // Forward slashes on every OS, so a record saved on Windows still works on the Linux server
  const storageKey = `${tenantId}/${instituteId}/${crypto.randomUUID()}`;

  await fsp.mkdir(path.dirname(absolutePath(storageKey)), { recursive: true });
  await fsp.writeFile(absolutePath(storageKey), uploaded.buffer);

  const [file] = await File.create(
    [
      {
        tenantId,
        instituteId,
        storageKey,
        originalName: uploaded.originalname || '',
        mimeType: uploaded.mimetype,
        size: uploaded.size,
        createdBy: req.user.id,
      },
    ],
    session ? { session } : undefined,
  );
  return file;
}

// Open a saved file for reading. Look the File up with scoped(req) first.
export function getStream(file) {
  return fs.createReadStream(absolutePath(file.storageKey));
}

// Delete the bytes and the record. Look the File up with scoped(req) first.
export async function remove(file) {
  await fsp.rm(absolutePath(file.storageKey), { force: true });
  await File.deleteOne({ tenantId: file.tenantId, instituteId: file.instituteId, _id: file._id });
}
