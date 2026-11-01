import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { CATEGORY_LIST } from '../../constants/categories.js';
import { GENDER_LIST } from '../../constants/genders.js';
import { STUDENT_STATUSES, STUDENT_STATUS_LIST } from '../../constants/statuses.js';

const { ObjectId } = mongoose.Schema.Types;

// The student master (SRS STU-01, STU-03, STU-06). The MODEL is part of the skeleton;
// Module A builds the validation, service, controller, routes, Excel import and screens.
const studentSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    instituteId: { type: ObjectId, ref: 'Institute', required: true },

    // Identity numbers
    scholarNo: { type: String, required: true, trim: true }, // unique per institute (STU-03)
    // null (not '') when unknown, so the unique index below skips it
    enrollmentNo: { type: String, trim: true, default: null }, // unique per university (STU-03)
    universityId: { type: ObjectId, ref: 'University', required: true }, // label on the TC (BR-12)
    rollNo: { type: String, trim: true, default: '' },

    // Personal details printed on the TC
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    motherName: { type: String, trim: true, default: '' },
    // Calendar dates: the client sends 'YYYY-MM-DD', stored as midnight UTC
    dob: { type: Date, required: true },
    gender: { type: String, enum: GENDER_LIST, required: true },
    category: { type: String, enum: CATEGORY_LIST, required: true },
    religion: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    mobile: { type: String, trim: true, default: '' },

    // Admission
    admissionDate: { type: Date, required: true },
    courseId: { type: ObjectId, ref: 'Course', required: true },
    branch: { type: String, trim: true, default: '' },
    batch: { type: String, trim: true, default: '' }, // e.g. '2024-27'
    previousSchool: { type: String, trim: true, default: '' },
    photo: { type: ObjectId, ref: 'File', default: null },

    status: { type: String, enum: STUDENT_STATUS_LIST, default: STUDENT_STATUSES.STUDYING },
    isLegacy: { type: Boolean, default: false }, // imported from old records (MIG-06)
  },
  { timestamps: true },
);

// Unique numbers (STU-03). tenantId always comes first.
studentSchema.index({ tenantId: 1, instituteId: 1, scholarNo: 1 }, { unique: true });
studentSchema.index(
  { tenantId: 1, universityId: 1, enrollmentNo: 1 },
  // Only students that have an enrollment number take part in this rule
  { unique: true, partialFilterExpression: { enrollmentNo: { $type: 'string' } } },
);

// Search (STU-07, NFR-08): one index per searchable field, inside the institute
studentSchema.index({ tenantId: 1, instituteId: 1, name: 1 });
studentSchema.index({ tenantId: 1, instituteId: 1, fatherName: 1 });
studentSchema.index({ tenantId: 1, instituteId: 1, mobile: 1 });
studentSchema.index({ tenantId: 1, instituteId: 1, rollNo: 1 });

studentSchema.plugin(tenantGuard);
studentSchema.plugin(actorFields);

export const Student = mongoose.model('Student', studentSchema);
