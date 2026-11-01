import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import { STAFF_ROLES, COURSE_WRITE_ROLES } from '../../constants/roles.js';
import { createCourseSchema, updateCourseSchema, listCoursesQuery } from './course.validation.js';
import * as controller from './course.controller.js';

// Every route runs the same chain, in the same order:
//   auth -> tenantScope -> requireRole(...) -> validate(...) -> controller
const router = Router();

router.get(
  '/',
  auth,
  tenantScope,
  requireRole(...STAFF_ROLES),
  validate({ query: listCoursesQuery }),
  controller.list,
);

// Must be above '/:id', otherwise Express would treat "options" as an id.
// validate({}) has nothing to check, but keeps the chain identical on every route.
router.get(
  '/options',
  auth,
  tenantScope,
  requireRole(...COURSE_WRITE_ROLES),
  validate({}),
  controller.options,
);

router.get(
  '/:id',
  auth,
  tenantScope,
  requireRole(...STAFF_ROLES),
  validate({ params: idParams }),
  controller.getById,
);

router.post(
  '/',
  auth,
  tenantScope,
  requireRole(...COURSE_WRITE_ROLES),
  validate({ body: createCourseSchema }),
  controller.create,
);

router.patch(
  '/:id',
  auth,
  tenantScope,
  requireRole(...COURSE_WRITE_ROLES),
  validate({ params: idParams, body: updateCourseSchema }),
  controller.update,
);

router.delete(
  '/:id',
  auth,
  tenantScope,
  requireRole(...COURSE_WRITE_ROLES),
  validate({ params: idParams }),
  controller.remove,
);

export default router;
