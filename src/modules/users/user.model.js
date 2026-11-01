import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { ALL_ROLES } from '../../constants/roles.js';

const { ObjectId } = mongoose.Schema.Types;

// One entry per institute the user may work in. A user can hold different roles
// in different institutes (SRS section 3).
const accessSchema = new mongoose.Schema(
  {
    instituteId: { type: ObjectId, ref: 'Institute', required: true },
    role: { type: String, enum: ALL_ROLES, required: true },
    departmentId: { type: ObjectId, ref: 'Department', default: null }, // DEPT_INCHARGE only
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    // Login id. Unique across all tenants because login happens before the tenant is known.
    mobile: { type: String, required: true, trim: true, unique: true },
    // select: false keeps the hash out of every query unless asked for with .select('+passwordHash')
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true },
    signatureImage: { type: ObjectId, ref: 'File', default: null },
    access: { type: [accessSchema], default: [] },
    // Increased on logout; refresh tokens carrying an older version stop working
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.plugin(tenantGuard);
userSchema.plugin(actorFields);

export const User = mongoose.model('User', userSchema);
