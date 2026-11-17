import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { CATEGORY_LIST } from '../../constants/categories.js';
import { GENDER_LIST } from '../../constants/genders.js';
import { STUDENT_STATUSES, STUDENT_STATUS_LIST } from '../../constants/statuses.js';

const { ObjectId } = mongoose.Schema.Types;

const studentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: ObjectId,
      ref: 'Tenant',
      required: true,
    },

    instituteId: {
      type: ObjectId,
      ref: 'Institute',
      required: true,
    },

    // Identity numbers
    scholarNo: {
      type: String,
      required: true,
      trim: true,
    },

    enrollmentNo: {
      type: String,
      trim: true,
      default: null,
    },

    universityId: {
      type: ObjectId,
      ref: 'University',
      required: true,
    },

    rollNo: {
      type: String,
      trim: true,
      default: '',
    },

    // Personal details
    name: {
      type: String,
      required: true,
      trim: true,
    },

    fatherName: {
      type: String,
      required: true,
      trim: true,
    },

    motherName: {
      type: String,
      trim: true,
      default: '',
    },

    dob: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: GENDER_LIST,
      required: true,
    },

    category: {
      type: String,
      enum: CATEGORY_LIST,
      required: true,
    },

    religion: {
      type: String,
      trim: true,
      default: '',
    },

    address: {
      type: String,
      trim: true,
      default: '',
    },

    mobile: {
      type: String,
      trim: true,
      default: '',
    },

    // Admission details
    admissionDate: {
      type: Date,
      required: true,
    },

    courseId: {
      type: ObjectId,
      ref: 'Course',
      required: true,
    },

    branch: {
      type: String,
      trim: true,
      default: '',
    },

    batch: {
      type: String,
      trim: true,
      default: '',
    },

    previousSchool: {
      type: String,
      trim: true,
      default: '',
    },

    photo: {
      type: ObjectId,
      ref: 'File',
      default: null,
    },

    // Student status
    status: {
      type: String,
      enum: STUDENT_STATUS_LIST,
      default: STUDENT_STATUSES.STUDYING,
    },

    // TC details - updated after final TC handover
    tcRefNo: {
      type: String,
      trim: true,
      default: null,
    },

    tcBookSerial: {
      type: String,
      trim: true,
      default: null,
    },

    tcIssuedAt: {
      type: Date,
      default: null,
    },

    // Legacy student record
    isLegacy: {
      type: Boolean,
      default: false,
    },

    // Soft delete fields
    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique numbers
studentSchema.index({ tenantId: 1, instituteId: 1, scholarNo: 1 }, { unique: true });

studentSchema.index(
  { tenantId: 1, universityId: 1, enrollmentNo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      enrollmentNo: { $type: 'string' },
    },
  },
);

// Search indexes
studentSchema.index({
  tenantId: 1,
  instituteId: 1,
  name: 1,
});

studentSchema.index({
  tenantId: 1,
  instituteId: 1,
  fatherName: 1,
});

studentSchema.index({
  tenantId: 1,
  instituteId: 1,
  mobile: 1,
});

studentSchema.index({
  tenantId: 1,
  instituteId: 1,
  rollNo: 1,
});

// Plugins
studentSchema.plugin(tenantGuard);
studentSchema.plugin(actorFields);

export const Student = mongoose.model('Student', studentSchema);
