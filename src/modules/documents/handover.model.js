import mongoose from 'mongoose';

import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

const handoverSchema = new mongoose.Schema(
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

    documentIds: {
      type: [
        {
          type: ObjectId,
          ref: 'Document',
        },
      ],
      required: true,
      validate: [
        {
          validator: (ids) => Array.isArray(ids) && ids.length > 0,
          message: 'At least one document is required',
        },
        {
          validator: (ids) => new Set(ids.map((id) => String(id))).size === ids.length,
          message: 'Duplicate document IDs are not allowed',
        },
      ],
    },

    receiverType: {
      type: String,
      enum: ['SELF'],
      required: true,
      default: 'SELF',
    },

    receiverName: {
      type: String,
      required: true,
      trim: true,
    },

    receiverMobile: {
      type: String,
      required: true,
      trim: true,
    },

    receiverPhotoId: {
      type: ObjectId,
      ref: 'File',
      required: true,
    },

    signedReceiptId: {
      type: ObjectId,
      ref: 'File',
      required: true,
    },

    issuedBy: {
      type: ObjectId,
      ref: 'User',
      required: true,
    },

    handoverAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ['Completed'],
      default: 'Completed',
      required: true,
    },
  },
  { timestamps: true },
);

// Student handover history
handoverSchema.index({
  tenantId: 1,
  instituteId: 1,
  studentId: 1,
  handoverAt: -1,
});

// Find handovers containing a particular document
handoverSchema.index({
  tenantId: 1,
  instituteId: 1,
  documentIds: 1,
});

handoverSchema.plugin(tenantGuard);
handoverSchema.plugin(actorFields);

export const Handover = mongoose.model('Handover', handoverSchema);
