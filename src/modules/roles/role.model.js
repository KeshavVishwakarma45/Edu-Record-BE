import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';
import { actorFields } from '../../utils/actorFields.js';
import { PERMISSION_LIST } from '../../constants/permissions.js';
import { OWNER_TYPE_LIST } from '../../constants/ownerTypes.js';

const { ObjectId } = mongoose.Schema.Types;

// A role is a name plus a list of permissions, made by an admin (ADR-016).
// It belongs to its "owner": a separate institute, or a unit of combined institutes.
const roleSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    ownerType: { type: String, enum: OWNER_TYPE_LIST, required: true },
    ownerId: { type: ObjectId, required: true }, // an Institute or a Unit id
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    permissions: { type: [{ type: String, enum: PERMISSION_LIST }], default: [] },
    // Only for a unit's roles: the member institutes that use this role. Empty = every member.
    // A user with this role can open only those institutes (e.g. SSISM uses 2 roles, SSEC 4).
    instituteIds: { type: [ObjectId], default: [] },
  },
  { timestamps: true },
);

roleSchema.index({ tenantId: 1, ownerType: 1, ownerId: 1, name: 1 }, { unique: true });
roleSchema.plugin(tenantGuard);
roleSchema.plugin(actorFields);

export const Role = mongoose.model('Role', roleSchema);
