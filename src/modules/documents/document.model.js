import mongoose from 'mongoose';

import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

import { DOCUMENT_STATUS_LIST, DOCUMENT_STATUSES } from '../../constants/statuses.js';

const { ObjectId } = mongoose.Schema.Types;

// Physical storage location of the document
const locationSchema = new mongoose.Schema(
  {
    almirah: { type: String, trim: true, default: '' },
    fileNo: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const documentSchema = new mongoose.Schema(
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

    studentId: {
      type: ObjectId,
      ref: 'Student',
      required: true,
    },

    courseId: {
      type: ObjectId,
      ref: 'Course',
      required: true,
    },

    inwardBatchId: {
      type: ObjectId,
      ref: 'InwardBatch',
      default: null,
    },

    documentName: {
      type: String,
      required: true,
      trim: true,
    },

    documentType: {
      type: String,
      required: true,
      trim: true,
    },

    documentNumber: {
      type: String,
      trim: true,
      default: '',
    },

    issueDate: {
      type: Date,
      default: null,
    },

    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },

    status: {
      type: String,
      enum: DOCUMENT_STATUS_LIST,
      default: DOCUMENT_STATUSES.EXPECTED,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    receivedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    custodyDate: {
      type: Date,
      default: null,
    },

    location: {
      type: locationSchema,
      default: () => ({}),
    },

    issuedAt: {
      type: Date,
      default: null,
    },

    issuedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

// Student document lookup
documentSchema.index({
  tenantId: 1,
  instituteId: 1,
  studentId: 1,
  status: 1,
});

// Inward batch lookup
documentSchema.index({
  tenantId: 1,
  instituteId: 1,
  inwardBatchId: 1,
});

documentSchema.plugin(tenantGuard);
documentSchema.plugin(actorFields);

export const Document = mongoose.model('Document', documentSchema);
