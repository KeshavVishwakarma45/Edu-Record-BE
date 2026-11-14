import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_LIST } from '../../constants/statuses.js';

export const INWARD_DOCUMENT_TYPES = Object.freeze([
  'Marksheet',
  'Provisional',
  'Degree',
  'Migration',
]);

export const MISSING_REASONS = Object.freeze([
  'RESULT_WITHHELD',
  'UNIVERSITY_FEES_DUE',
  'ENROLLMENT_PROBLEM',
  'ABSENT',
  'NAME_DETAIL_MISMATCH',
  'NOT_PRINTED',
  'OTHER',
]);

// Inward Batch Model
const inwardBatchSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Tenant',
    },

    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Institute',
    },

    universityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'University',
    },

    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Course',
    },

    examTerm: {
      type: String,
      required: true,
      trim: true,
    },

    examSession: {
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        required: true,
      },
    },

    documentType: {
      type: String,
      required: true,
      enum: INWARD_DOCUMENT_TYPES,
    },

    receivedDate: {
      type: Date,
      required: true,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },

    coveringLetterFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

inwardBatchSchema.index({
  tenantId: 1,
  instituteId: 1,
  createdAt: -1,
});

inwardBatchSchema.plugin(tenantGuard);
inwardBatchSchema.plugin(actorFields);

export const InwardBatch = mongoose.model('InwardBatch', inwardBatchSchema);

// Inward Document Model
const inwardDocumentSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Tenant',
    },

    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Institute',
    },

    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InwardBatch',
      required: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },

    documentType: {
      type: String,
      required: true,
      enum: INWARD_DOCUMENT_TYPES,
    },

    status: {
      type: String,
      enum: DOCUMENT_STATUS_LIST,
      default: DOCUMENT_STATUSES.EXPECTED,
      required: true,
    },

    documentSerialNo: {
      type: String,
      trim: true,
      default: '',
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    custodyDate: {
      type: Date,
      default: null,
    },

    storageLocation: {
      almirah: {
        type: String,
        trim: true,
        default: '',
      },
      fileNo: {
        type: String,
        trim: true,
        default: '',
      },
    },

    missingDetails: {
      reason: {
        type: String,
        enum: MISSING_REASONS,
      },
      otherReason: {
        type: String,
        trim: true,
        default: '',
      },
      followUpDate: {
        type: Date,
        default: null,
      },
    },

    receivedInBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InwardBatch',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

inwardDocumentSchema.index({
  tenantId: 1,
  instituteId: 1,
  batchId: 1,
  status: 1,
});

inwardDocumentSchema.index({
  tenantId: 1,
  instituteId: 1,
  studentId: 1,
});

inwardDocumentSchema.plugin(tenantGuard);
inwardDocumentSchema.plugin(actorFields);

export const InwardDocument = mongoose.model('InwardDocument', inwardDocumentSchema);
