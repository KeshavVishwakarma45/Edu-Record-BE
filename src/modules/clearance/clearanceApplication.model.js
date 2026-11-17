import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

const documentsEnclosedSchema = new mongoose.Schema(
  {
    tenthMarksheet: { type: Boolean, default: false },
    twelfthMarksheet: { type: Boolean, default: false },
    yearSemesterMarksheets: { type: Boolean, default: false },
  },
  { _id: false },
);

const declarationsSchema = new mongoose.Schema(
  {
    feesPaid: { type: Boolean, default: false },
    duesCleared: { type: Boolean, default: false },
    booksReturned: { type: Boolean, default: false },
  },
  { _id: false },
);

const clearanceApplicationSchema = new mongoose.Schema(
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

    lastClassAttended: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    leavingReason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    documentsEnclosed: {
      type: documentsEnclosedSchema,
      default: () => ({}),
    },

    declarations: {
      type: declarationsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

clearanceApplicationSchema.index({
  tenantId: 1,
  instituteId: 1,
  studentId: 1,
  createdAt: -1,
});

clearanceApplicationSchema.index({
  tenantId: 1,
  instituteId: 1,
  createdAt: -1,
});

clearanceApplicationSchema.plugin(tenantGuard);
clearanceApplicationSchema.plugin(actorFields);

export const ClearanceApplication = mongoose.model(
  'ClearanceApplication',
  clearanceApplicationSchema,
);
