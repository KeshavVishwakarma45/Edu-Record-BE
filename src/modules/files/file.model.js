import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

// Information about one uploaded file (photo, signature, scan).
// The bytes live in the private UPLOAD_DIR folder; utils/storage.js is the only code that touches them.
const fileSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    instituteId: { type: ObjectId, ref: 'Institute', required: true },
    storageKey: { type: String, required: true }, // path inside UPLOAD_DIR, made by the server
    originalName: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true },
);

fileSchema.index({ tenantId: 1, instituteId: 1, createdAt: -1 });
fileSchema.plugin(tenantGuard);
fileSchema.plugin(actorFields);

export const File = mongoose.model('File', fileSchema);
