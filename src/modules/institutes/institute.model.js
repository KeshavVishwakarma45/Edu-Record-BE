import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

// An institute (college or school) inside a tenant (SRS ORG-02).
// Image fields store the id of a File record (see utils/storage.js), never a public URL.
const instituteSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    // Used in TC numbers, e.g. SSISM/TC/2026/B.Com/495
    shortCode: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' }, // optional: SSEC has none
    logo: { type: ObjectId, ref: 'File', default: null },
    sealImage: { type: ObjectId, ref: 'File', default: null },
    principalName: { type: String, trim: true, default: '' },
    principalSignature: { type: ObjectId, ref: 'File', default: null },
    // The unit this institute is combined into (shares roles and staff), or null when separate
    unitId: { type: ObjectId, ref: 'Unit', default: null },
    // Free-form per-institute settings (e.g. TC layout) until each gets a proper field
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

instituteSchema.index({ tenantId: 1, shortCode: 1 }, { unique: true });
instituteSchema.index({ tenantId: 1, unitId: 1 });
instituteSchema.plugin(tenantGuard);
instituteSchema.plugin(actorFields);

export const Institute = mongoose.model('Institute', instituteSchema);
