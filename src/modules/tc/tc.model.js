import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

const tcSchema = new mongoose.Schema(
  {
    // Tenant and Institute references
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

    // Student for whom the TC is created
    studentId: {
      type: ObjectId,
      ref: 'Student',
      required: true,
    },

    // Editable draft fields
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

    // Current TC status
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },

    // Generated later in the TC approval workflow
    refNo: {
      type: String,
      default: null,
    },
    bookSerial: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Plugins
tcSchema.plugin(tenantGuard);
tcSchema.plugin(actorFields);

// Model export
export const TC = mongoose.model('TC', tcSchema);
