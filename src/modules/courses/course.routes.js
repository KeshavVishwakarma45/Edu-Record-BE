import { Router } from 'express';
import { auth } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { idParams } from '../../utils/validators.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { createCourseSchema, updateCourseSchema, listCoursesQuery } from './course.validation.js';
import * as controller from './course.controller.js';

// Every route runs the same chain, in the same order:
//   auth -> tenantScope -> requirePermission(...) -> validate(...) -> controller
const router = Router();

router.get(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.COURSE_READ),
  validate({ query: listCoursesQuery }),
  controller.list,
);

// Must be above '/:id', otherwise Express would treat "options" as an id.
// validate({}) has nothing to check, but keeps the chain identical on every route.
router.get(
  '/options',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.COURSE_WRITE),
  validate({}),
  controller.options,
);

router.get(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.COURSE_READ),
  validate({ params: idParams }),
  controller.getById,
);

router.post(
  '/',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.COURSE_WRITE),
  validate({ body: createCourseSchema }),
  controller.create,
);

router.patch(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.COURSE_WRITE),
  validate({ params: idParams, body: updateCourseSchema }),
  controller.update,
);

router.delete(
  '/:id',
  auth,
  tenantScope,
  requirePermission(PERMISSIONS.COURSE_WRITE),
  validate({ params: idParams }),
  controller.remove,
);

export default router;
