import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

// A clearance (no-dues) department such as Library or Sports (SRS ORG-06).
const departmentSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    instituteId: { type: ObjectId, ref: 'Institute', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 }, // position in the clearance list
    mandatory: { type: Boolean, default: true }, // TC waits for mandatory departments only (TC-01)
  },
  { timestamps: true },
);

departmentSchema.index({ tenantId: 1, instituteId: 1, name: 1 }, { unique: true });
departmentSchema.plugin(tenantGuard);
departmentSchema.plugin(actorFields);

export const Department = mongoose.model('Department', departmentSchema);
