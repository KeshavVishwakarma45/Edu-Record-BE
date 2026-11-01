import mongoose from 'mongoose';
import { actorFields } from '../../utils/actorFields.js';

// A tenant is one customer organisation (society, trust, school group, university).
// This is the only collection, together with universities, that has no tenantId (SRS ORG-01).
const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, trim: true, default: '' },
    contact: { type: String, trim: true, default: '' },
    plan: { type: String, trim: true, default: 'standard' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  },
  { timestamps: true },
);

tenantSchema.plugin(actorFields);

export const Tenant = mongoose.model('Tenant', tenantSchema);
