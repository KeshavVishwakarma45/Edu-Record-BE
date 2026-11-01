import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { USER_STATUSES, USER_STATUS_LIST } from '../../constants/statuses.js';
import { OWNER_TYPE_LIST } from '../../constants/ownerTypes.js';

const { ObjectId } = mongoose.Schema.Types;

// One entry per role owner the user works in (ADR-016): a separate institute, or a unit of
// combined institutes (then the role works in every institute of the unit).
const accessSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: OWNER_TYPE_LIST, required: true },
    ownerId: { type: ObjectId, required: true }, // an Institute or a Unit id
    roleId: { type: ObjectId, ref: 'Role', required: true },
    // Department In-charge: the clearance departments this user acts for (any institute of the owner)
    departmentIds: { type: [{ type: ObjectId, ref: 'Department' }], default: [] },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    // Login id. Unique across all tenants because login happens before the tenant is known.
    // Stored in lower case, so "Admin@Singaji.in" and "admin@singaji.in" are the same user.
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    mobile: { type: String, trim: true, default: '' }, // contact number only, not used to log in
    // select: false keeps secrets out of every query unless asked for with .select('+field')
    // An invited user has no password until they open their invite link.
    passwordHash: { type: String, default: null, select: false },
    status: { type: String, enum: USER_STATUS_LIST, default: USER_STATUSES.INVITED },
    // The Super Admin manages the whole organisation; it is a flag, not a role, so no admin can grant it
    isSuperAdmin: { type: Boolean, default: false },
    signatureImage: { type: ObjectId, ref: 'File', default: null },
    access: { type: [accessSchema], default: [] },
    // Invite / set-password link: only a hash of the token is stored (the link itself is shown once)
    setupTokenHash: { type: String, default: null, select: false },
    setupTokenExpiresAt: { type: Date, default: null },
    // Increased on logout; refresh tokens carrying an older version stop working
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ tenantId: 1, 'access.ownerId': 1 });
userSchema.index({ setupTokenHash: 1 }, { sparse: true });
userSchema.plugin(tenantGuard);
userSchema.plugin(actorFields);

export const User = mongoose.model('User', userSchema);
