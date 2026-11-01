import Joi from 'joi';
import { email } from '../../utils/validators.js';

export const loginSchema = Joi.object({
  email: email().required(),
  password: Joi.string().min(1).max(200).required(),
});

// The token in an invite / set-password link: 64 hex characters
export const setupTokenParams = Joi.object({
  token: Joi.string().hex().length(64).required(),
});

export const setPasswordSchema = Joi.object({
  password: Joi.string().min(8).max(200).required().label('Password').messages({
    'string.min': 'Use at least 8 characters',
  }),
});
