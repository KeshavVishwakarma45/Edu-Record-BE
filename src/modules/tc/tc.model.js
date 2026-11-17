import mongoose from 'mongoose';

import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const tcSchema = new mongoose.Schema(
  {
    // Institute and student
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

    // Link this TC to the exact clearance application
    clearanceApplicationId: {
      type: ObjectId,
      ref: 'ClearanceApplication',
      required: true,
    },

    // TC draft details
    reasonForLeaving: {
      type: String,
      trim: true,
      default: '',
    },

    conduct: {
      type: String,
      trim: true,
      default: '',
    },

    // TC workflow
    status: {
      type: String,
      enum: [
        'draft',
        'submitted', // legacy status
        'pending_approval',
        'approved',
        'rejected',
        'issued',
      ],
      default: 'draft',
      required: true,
    },

    // TC numbering
    refNo: {
      type: String,
      default: null,
    },

    bookSerial: {
      type: String,
      default: null,
    },

    // Submission
    submittedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    // Principal approval
    approvedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    // Rejection
    rejectedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    // Handover / issue
    handoverPhoto: {
      type: ObjectId,
      ref: 'File',
      default: null,
    },

    receiverSignature: {
      type: ObjectId,
      ref: 'File',
      default: null,
    },

    receivedBy: {
      type: String,
      trim: true,
      default: null,
      maxlength: 150,
    },

    issuedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    issuedAt: {
      type: Date,
      default: null,
    },

    // Immutable student and TC data captured at approval
    snapshot: {
      type: Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast institute-wise status queues
tcSchema.index({
  tenantId: 1,
  instituteId: 1,
  status: 1,
  createdAt: -1,
});

// Tenant-level isolation
tcSchema.plugin(tenantGuard);

// Automatically manages createdBy and updatedBy
tcSchema.plugin(actorFields);

export const TC = mongoose.model('TC', tcSchema);
