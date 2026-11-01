import mongoose from 'mongoose';
import { actorFields } from '../../utils/actorFields.js';

// Shared university / board master used by every tenant (SRS ORG-03), so it has no tenantId.
const universitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    // Printed on the TC next to the enrollment number (SRS BR-12), e.g. "RGPV Enrollment No."
    enrollmentLabel: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

universitySchema.plugin(actorFields);

export const University = mongoose.model('University', universitySchema);
