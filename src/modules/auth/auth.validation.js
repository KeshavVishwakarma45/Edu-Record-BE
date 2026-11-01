import Joi from 'joi';
import { mobile } from '../../utils/validators.js';

export const loginSchema = Joi.object({
  mobile: mobile().required(),
  password: Joi.string().min(1).max(200).required(),
});
