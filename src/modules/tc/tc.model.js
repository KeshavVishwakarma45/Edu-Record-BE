import mongoose from 'mongoose';

import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const tcSchema = new mongoose.Schema(
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

    clearanceApplicationId: {
      type: ObjectId,
      ref: 'ClearanceApplication',
      required: true,
    },

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

    status: {
      type: String,
      enum: ['draft', 'submitted', 'pending_approval', 'approved', 'rejected', 'issued'],
      default: 'draft',
      required: true,
    },

    refNo: {
      type: String,
      default: null,
    },

    bookSerial: {
      type: String,
      default: null,
    },

    submittedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    approvedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

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

    snapshot: {
      type: Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast institute-wise active TC uniqueness
tcSchema.index(
  { tenantId: 1, instituteId: 1, studentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['draft', 'submitted', 'pending_approval', 'approved'] },
    },
  },
);

// Fast institute-wise status queues
tcSchema.index({
  tenantId: 1,
  instituteId: 1,
  status: 1,
  createdAt: -1,
});

tcSchema.plugin(tenantGuard);
tcSchema.plugin(actorFields);

export const TC = mongoose.model('TC', tcSchema);
