import bcrypt from 'bcrypt';
import request from 'supertest';
import { COURSE_PATTERNS } from '../../src/constants/coursePatterns.js';
import { OWNER_TYPES } from '../../src/constants/ownerTypes.js';
import { ROLE_TEMPLATES } from '../../src/constants/roleTemplates.js';
import { USER_STATUSES } from '../../src/constants/statuses.js';
import { Tenant } from '../../src/modules/institutes/tenant.model.js';
import { Institute } from '../../src/modules/institutes/institute.model.js';
import { University } from '../../src/modules/institutes/university.model.js';
import { Affiliation } from '../../src/modules/institutes/affiliation.model.js';
import { Department } from '../../src/modules/institutes/department.model.js';
import { Course } from '../../src/modules/courses/course.model.js';
import { Role } from '../../src/modules/roles/role.model.js';
import { User } from '../../src/modules/users/user.model.js';

export const PASSWORD = 'Test@12345';

// A small world for tests: one tenant, SSISM and SSEC as SEPARATE institutes (each with the
// default roles, a course and a Library department), and users with different access.
export async function createWorld() {
  const tenant = await Tenant.create({ name: 'Test Society' });
  const tenantId = tenant._id;
  const ssism = await Institute.create({ tenantId, name: 'SSISM', shortCode: 'SSISM' });
  const ssec = await Institute.create({ tenantId, name: 'SSEC', shortCode: 'SSEC' });
  const university = await University.create({
    name: 'Vikram University',
    shortCode: 'VIKRAM',
    enrollmentLabel: 'Vikram Univ. Enrollment No.',
  });

  const affiliations = {};
  const courses = {};
  const roles = {}; // roles.SSISM['TC Clerk']
  const departments = {};
  for (const institute of [ssism, ssec]) {
    const code = institute.shortCode;
    const scope = { tenantId, instituteId: institute._id };
    affiliations[code] = await Affiliation.create({
      ...scope,
      universityId: university._id,
      fromYear: 2010,
    });
    courses[code] = await Course.create({
      ...scope,
      affiliationId: affiliations[code]._id,
      name: `${code} course`,
      shortCode: 'BCA',
      pattern: COURSE_PATTERNS.YEAR,
      duration: 3,
    });
    departments[code] = await Department.create({ ...scope, name: 'Library' });
    const created = await Role.create(
      ROLE_TEMPLATES.map((t) => ({
        tenantId,
        ownerType: OWNER_TYPES.INSTITUTE,
        ownerId: institute._id,
        ...t,
      })),
    );
    roles[code] = Object.fromEntries(created.map((r) => [r.name, r]));
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 4); // low cost keeps tests fast
  // access: [['SSISM', 'Principal'], ...] -> one assignment per separate institute
  const makeUser = (email, access, extra = {}) =>
    User.create({
      tenantId,
      name: `User ${email}`,
      email,
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      access: access.map(([code, roleName]) => ({
        ownerType: OWNER_TYPES.INSTITUTE,
        ownerId: code === 'SSISM' ? ssism._id : ssec._id,
        roleId: roles[code][roleName]._id,
      })),
      ...extra,
    });

  const users = {
    ssismPrincipal: await makeUser('principal@ssism.test', [['SSISM', 'Principal']]),
    ssismTcClerk: await makeUser('tcclerk@ssism.test', [['SSISM', 'TC Clerk']]),
    ssismAdmin: await makeUser('admin@ssism.test', [['SSISM', 'Admin']]),
    admin: await makeUser('admin@singaji.test', [
      ['SSISM', 'Admin'],
      ['SSEC', 'Admin'],
    ]),
    superAdmin: await makeUser('superadmin@singaji.test', [], { isSuperAdmin: true }),
  };

  return {
    tenantId,
    institutes: { ssism, ssec },
    affiliations,
    courses,
    roles,
    departments,
    users,
  };
}

// Logs in through the real API and returns the access token
export async function loginAs(app, user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${user.email}: ${res.status}`);
  return res.body.data.accessToken;
}

// Headers for a request as `user` in `institute`
export async function headersFor(app, user, institute) {
  return {
    Authorization: `Bearer ${await loginAs(app, user)}`,
    'X-Institute-Id': String(institute._id),
  };
}
