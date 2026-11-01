import Joi from 'joi';
import { objectId } from '../../utils/validators.js';
import { ROLE_TEMPLATES } from '../../constants/roleTemplates.js';

const TEMPLATE_NAMES = ROLE_TEMPLATES.map((t) => t.name);

// keepRolesFrom: the id of one of the institutes (its roles become the unit's roles),
// or 'template' to start the unit with the default roles
export const combineSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().label('Unit name'),
  instituteIds: Joi.array().items(objectId()).unique().min(2).required().label('Institutes'),
  keepRolesFrom: Joi.alternatives()
    .try(objectId(), Joi.string().valid('template'))
    .required()
    .label('Roles to keep'),
});

const instituteFields = {
  name: Joi.string().trim().min(3).max(150).label('Name'),
  address: Joi.string().trim().max(300).allow('').label('Address'),
  website: Joi.string().trim().max(200).allow('').label('Website'),
  principalName: Joi.string().trim().max(100).allow('').label('Principal name'),
};

// A new institute. shortCode is printed in TC numbers (e.g. SSISM/TC/2026/...): letters and digits.
export const createInstituteSchema = Joi.object({
  ...instituteFields,
  name: instituteFields.name.required(),
  shortCode: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9]{2,10}$/)
    .required()
    .label('Short code')
    .messages({ 'string.pattern.base': 'Use 2 to 10 letters or digits, e.g. SSISM' }),
  universityId: objectId().allow(null, '').label('University'),
  affiliatedFrom: Joi.number()
    .integer()
    .min(1950)
    .max(2100)
    // Needed only when a university is chosen (.required() makes an empty university not match)
    .when('universityId', {
      is: Joi.string().hex().length(24).required(),
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .label('Affiliated since'),
  // null / '': a separate institute with its own roles; a unit id: join that unit's roles and staff
  unitId: objectId().allow(null, '').label('Unit'),
  defaultDepartments: Joi.boolean().default(true),
  // Which built-in roles a separate institute starts with (more can be added on the Roles page).
  // Ignored when the institute joins a unit: it uses the unit's roles.
  roleTemplates: Joi.array()
    .items(Joi.string().valid(...TEMPLATE_NAMES))
    .unique()
    .default(TEMPLATE_NAMES)
    .label('Starting roles'),
});

// The short code is not here on purpose: it never changes once TCs may carry it
// roleIds: for an institute in a unit, the unit roles it uses
export const updateInstituteSchema = Joi.object({
  ...instituteFields,
  roleIds: Joi.array().items(objectId()).unique().label('Roles used here'),
}).min(1);

export const renameUnitSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().label('Unit name'),
});

export const instituteIdSchema = Joi.object({
  instituteId: objectId().required().label('Institute'),
});
