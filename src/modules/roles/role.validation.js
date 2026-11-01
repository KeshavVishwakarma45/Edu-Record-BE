import Joi from 'joi';
import { listQuery, objectId } from '../../utils/validators.js';
import { PERMISSION_LIST } from '../../constants/permissions.js';

const roleFields = {
  name: Joi.string().trim().min(2).max(60).label('Name'),
  description: Joi.string().trim().max(200).allow('').label('Description'),
  permissions: Joi.array()
    .items(Joi.string().valid(...PERMISSION_LIST))
    .unique()
    .label('Permissions'),
  // Unit roles only: the member institutes that use the role (empty = all of them)
  instituteIds: Joi.array().items(objectId()).unique().label('Used in'),
};

export const createRoleSchema = Joi.object({
  ...roleFields,
  name: roleFields.name.required(),
  permissions: roleFields.permissions.required(),
});

export const updateRoleSchema = Joi.object(roleFields).min(1);

export const listRolesQuery = listQuery(['name', 'createdAt']);
