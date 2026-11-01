import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

// Links an institute to a university for a range of years (SRS ORG-04).
// Every course belongs to one affiliation.
const affiliationSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    instituteId: { type: ObjectId, ref: 'Institute', required: true },
    universityId: { type: ObjectId, ref: 'University', required: true },
    fromYear: { type: Number, required: true },
    toYear: { type: Number, default: null }, // null = still affiliated
  },
  { timestamps: true },
);

affiliationSchema.index({ tenantId: 1, instituteId: 1, universityId: 1 }, { unique: true });
affiliationSchema.plugin(tenantGuard);
affiliationSchema.plugin(actorFields);

export const Affiliation = mongoose.model('Affiliation', affiliationSchema);
