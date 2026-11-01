import mongoose from 'mongoose';

// Mongoose plugin: adds createdBy / updatedBy (the user who made the change) to a schema.
// createdAt / updatedAt come from the schema option { timestamps: true }.
// Services set them, e.g. Course.create({ ...data, createdBy: req.user.id }).
export function actorFields(schema) {
  schema.add({
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  });
}
