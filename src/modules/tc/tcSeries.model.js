import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';

const { ObjectId } = mongoose.Schema.Types;

const tcSeriesSchema = new mongoose.Schema(
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

    kind: {
      type: String,
      enum: ['ref', 'serial'],
      required: true,
    },

    courseShortCode: {
      type: String,
      trim: true,
      default: null,
      required: function () {
        return this.kind === 'ref';
      },
      validate: {
        validator(value) {
          if (this.kind === 'ref') {
            return typeof value === 'string' && value.length > 0;
          }

          return value === null;
        },
        message: 'Ref series needs a short code; serial series must not have one',
      },
    },

    year: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          return value === null || Number.isInteger(value);
        },
        message: 'Year must be an integer or null',
      },
    },

    nextNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Next number must be an integer',
      },
    },
  },
  {
    timestamps: true,
    collection: 'tcSeries',
  },
);

// Ref number series: institute + course short code + year
tcSeriesSchema.index(
  {
    tenantId: 1,
    instituteId: 1,
    kind: 1,
    courseShortCode: 1,
    year: 1,
  },
  {
    unique: true,
    partialFilterExpression: { kind: 'ref' },
  },
);

// Book serial series: institute + year
tcSeriesSchema.index(
  {
    tenantId: 1,
    instituteId: 1,
    kind: 1,
    year: 1,
  },
  {
    unique: true,
    partialFilterExpression: { kind: 'serial' },
  },
);

tcSeriesSchema.plugin(tenantGuard);
tcSeriesSchema.plugin(actorFields);

export const TcSeries = mongoose.model('TcSeries', tcSeriesSchema);
