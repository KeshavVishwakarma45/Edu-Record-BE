import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { COURSE_PATTERN_LIST } from '../../constants/coursePatterns.js';

const { ObjectId } = mongoose.Schema.Types;

// A course offered by an institute, e.g. BCA or B.Tech (AI & ML) (SRS ORG-05).
const courseSchema = new mongoose.Schema(
  {
    // Every institute-level collection starts with these two fields
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    instituteId: { type: ObjectId, ref: 'Institute', required: true },

    affiliationId: { type: ObjectId, ref: 'Affiliation', required: true },
    name: { type: String, required: true, trim: true },
    // Printed in the TC Ref no., e.g. SSISM/TC/2026/B.Com/495
    shortCode: { type: String, required: true, trim: true },
    branch: { type: String, trim: true, default: '' }, // empty when the course has no branches
    pattern: { type: String, enum: COURSE_PATTERN_LIST, required: true },
    duration: { type: Number, required: true, min: 1, max: 12 }, // number of semesters or years
    examTerms: { type: [String], default: [] }, // e.g. ['Sem I', 'Sem II', ...]
  },
  { timestamps: true },
);

// tenantId and instituteId come first in every compound index (tenant isolation + speed)
courseSchema.index({ tenantId: 1, instituteId: 1, shortCode: 1, branch: 1 }, { unique: true });
courseSchema.index({ tenantId: 1, instituteId: 1, name: 1 });

courseSchema.plugin(tenantGuard);
courseSchema.plugin(actorFields);

export const Course = mongoose.model('Course', courseSchema);
