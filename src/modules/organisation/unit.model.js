import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

// A unit is 2 or more institutes of one tenant that SHARE their roles and staff (ADR-016).
// Records (students, documents, TCs, numbering) always stay with their own institute.
// Only the Super Admin creates or dissolves units (organisation.service.js).
const unitSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    instituteIds: { type: [{ type: ObjectId, ref: 'Institute' }], default: [] },
  },
  { timestamps: true },
);

unitSchema.index({ tenantId: 1, name: 1 }, { unique: true });
unitSchema.plugin(tenantGuard);
unitSchema.plugin(actorFields);

export const Unit = mongoose.model('Unit', unitSchema);
