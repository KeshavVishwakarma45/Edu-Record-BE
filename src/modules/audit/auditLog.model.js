import mongoose from 'mongoose';
import { tenantGuard } from '../../utils/tenantGuard.js';

const { ObjectId } = mongoose.Schema.Types;

// Append-only record of who changed what and when (SRS BR-14).
// Write entries only through utils/audit.js. Updates and deletes are blocked below.
const auditLogSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjectId, ref: 'Tenant', required: true },
    instituteId: { type: ObjectId, ref: 'Institute', default: null },
    userId: { type: ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    entity: { type: String, required: true }, // e.g. 'course'
    entityId: { type: ObjectId, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
  },
  // The entry time is stored as `at`. There is no updatedAt because entries never change.
  { timestamps: { createdAt: 'at', updatedAt: false }, collection: 'auditLogs' },
);

auditLogSchema.index({ tenantId: 1, entity: 1, entityId: 1 });
auditLogSchema.plugin(tenantGuard);

const BLOCKED = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];
auditLogSchema.pre(BLOCKED, function blockChanges() {
  throw new Error('Audit log entries cannot be changed or deleted');
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
