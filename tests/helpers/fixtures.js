import bcrypt from 'bcrypt';
import request from 'supertest';
import { ROLES } from '../../src/constants/roles.js';
import { COURSE_PATTERNS } from '../../src/constants/coursePatterns.js';
import { Tenant } from '../../src/modules/institutes/tenant.model.js';
import { Institute } from '../../src/modules/institutes/institute.model.js';
import { University } from '../../src/modules/institutes/university.model.js';
import { Affiliation } from '../../src/modules/institutes/affiliation.model.js';
import { Course } from '../../src/modules/courses/course.model.js';
import { User } from '../../src/modules/users/user.model.js';

export const PASSWORD = 'Test@12345';

// A small world for tests: one tenant, SSISM and SSEC, one course in each,
// and users with different access.
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
  for (const institute of [ssism, ssec]) {
    const scope = { tenantId, instituteId: institute._id };
    affiliations[institute.shortCode] = await Affiliation.create({
      ...scope,
      universityId: university._id,
      fromYear: 2010,
    });
    courses[institute.shortCode] = await Course.create({
      ...scope,
      affiliationId: affiliations[institute.shortCode]._id,
      name: `${institute.shortCode} course`,
      shortCode: 'BCA',
      pattern: COURSE_PATTERNS.YEAR,
      duration: 3,
    });
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 4); // low cost keeps tests fast
  const makeUser = (mobile, access) =>
    User.create({ tenantId, name: `User ${mobile}`, mobile, passwordHash, access });

  const users = {
    ssismPrincipal: await makeUser('9100000001', [
      { instituteId: ssism._id, role: ROLES.PRINCIPAL },
    ]),
    ssismTcClerk: await makeUser('9100000003', [{ instituteId: ssism._id, role: ROLES.TC_CLERK }]),
    societyAdmin: await makeUser('9000000001', [
      { instituteId: ssism._id, role: ROLES.SOCIETY_ADMIN },
      { instituteId: ssec._id, role: ROLES.SOCIETY_ADMIN },
    ]),
  };

  return { tenantId, institutes: { ssism, ssec }, affiliations, courses, users };
}

// Logs in through the real API and returns the access token
export async function loginAs(app, user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ mobile: user.mobile, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${user.mobile}: ${res.status}`);
  return res.body.data.accessToken;
}
