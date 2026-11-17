import mongoose from 'mongoose';

import { CLEARANCE_STATUSES, CLEARANCE_STATUS_LIST } from '../../constants/clearanceStatuses.js';

import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

const clearanceItemSchema = new mongoose.Schema(
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

    applicationId: {
      type: ObjectId,
      ref: 'ClearanceApplication',
      required: true,
    },

    studentId: {
      type: ObjectId,
      ref: 'Student',
      required: true,
    },

    departmentId: {
      type: ObjectId,
      ref: 'Department',
      required: true,
    },

    status: {
      type: String,
      enum: CLEARANCE_STATUS_LIST,
      default: CLEARANCE_STATUSES.PENDING,
      required: true,
    },

    remark: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    amountDue: {
      type: Number,
      min: 0,
      default: 0,
    },

    statusUpdatedBy: {
      type: ObjectId,
      ref: 'User',
      default: null,
    },

    statusUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Prevent duplicate clearance entries for one department.
clearanceItemSchema.index(
  {
    tenantId: 1,
    instituteId: 1,
    applicationId: 1,
    departmentId: 1,
  },
  { unique: true },
);

// Department-wise queue.
clearanceItemSchema.index({
  tenantId: 1,
  instituteId: 1,
  departmentId: 1,
  status: 1,
  createdAt: -1,
});

// Student-wise clearance.
clearanceItemSchema.index({
  tenantId: 1,
  instituteId: 1,
  studentId: 1,
});

clearanceItemSchema.plugin(tenantGuard);
clearanceItemSchema.plugin(actorFields);

export const ClearanceItem = mongoose.model('ClearanceItem', clearanceItemSchema);
