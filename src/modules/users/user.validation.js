import Joi from 'joi';
import { email, objectId, mobile, listQuery } from '../../utils/validators.js';

const accessFields = {
  roleId: objectId().required().label('Role'),
  departmentIds: Joi.array().items(objectId()).unique().default([]).label('Departments'),
};

export const inviteSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().label('Name'),
  email: email().required().label('Email'),
  mobile: mobile().allow('').label('Mobile'),
  ...accessFields,
});

export const accessSchema = Joi.object(accessFields);

export const listUsersQuery = listQuery(['name', 'email', 'createdAt']);
