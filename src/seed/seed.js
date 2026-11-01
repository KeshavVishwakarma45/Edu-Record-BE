// Fills the database with starting data for development:  npm run seed
//
// Safe to run again: every record is found by its natural key (name, short code, email...)
// and updated in place, so re-running resets the seed records and touches nothing else.
// Records you created yourself (e.g. a new course) are never deleted. The organisation is reset to
// the seed setup (SSISM + SSEC combined in one unit with the default roles).
// The data itself is listed in seedData.js (setup and users) and seedStudents.js.
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import '../config/models.js';
import { ROLE_TEMPLATES } from '../constants/roleTemplates.js';
import { DEFAULT_DEPARTMENTS } from '../constants/defaultDepartments.js';
import { OWNER_TYPES } from '../constants/ownerTypes.js';
import { USER_STATUSES } from '../constants/statuses.js';
import { buildExamTerms } from '../constants/coursePatterns.js';
import { BCRYPT_ROUNDS } from '../modules/auth/auth.service.js';
import { Tenant } from '../modules/institutes/tenant.model.js';
import { Institute } from '../modules/institutes/institute.model.js';
import { University } from '../modules/institutes/university.model.js';
import { Affiliation } from '../modules/institutes/affiliation.model.js';
import { Department } from '../modules/institutes/department.model.js';
import { Course } from '../modules/courses/course.model.js';
import { User } from '../modules/users/user.model.js';
import { Unit } from '../modules/organisation/unit.model.js';
import { Role } from '../modules/roles/role.model.js';
import { Student } from '../modules/students/student.model.js';
import { seedData } from './seedData.js';
import { seedStudents } from './seedStudents.js';

// Find by `filter`; update it with `values`, or create it if missing. Returns the saved record.
function upsert(Model, filter, values) {
  return Model.findOneAndUpdate(
    filter,
    { $set: values },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
}

async function seed() {
  if (!env.SEED_PASSWORD) {
    console.error('Set SEED_PASSWORD in .env before seeding.');
    process.exit(1);
  }
  await connectDB();

  const tenant = await upsert(Tenant, { name: seedData.tenant.name }, seedData.tenant);
  const tenantId = tenant._id;

  // Seed users from before email login (no email) are removed first, so the unique email
  // index below can be built
  await User.deleteMany({ tenantId, email: { $exists: false } });
  // Make the indexes match the models (also drops old ones, e.g. the former unique mobile index)
  for (const model of Object.values(mongoose.models)) await model.syncIndexes();

  const universities = {};
  for (const university of seedData.universities) {
    universities[university.shortCode] = await upsert(
      University,
      { shortCode: university.shortCode },
      university,
    );
  }

  const institutes = {};
  for (const { courses, affiliatedTo, affiliatedFrom, ...institute } of seedData.institutes) {
    const saved = await upsert(Institute, { tenantId, shortCode: institute.shortCode }, institute);
    const scope = { tenantId, instituteId: saved._id };

    const affiliation = await upsert(
      Affiliation,
      { ...scope, universityId: universities[affiliatedTo]._id },
      { fromYear: affiliatedFrom, toYear: null },
    );

    const departments = {};
    for (const [index, name] of DEFAULT_DEPARTMENTS.entries()) {
      departments[name] = await upsert(
        Department,
        { ...scope, name },
        { order: index + 1, mandatory: true },
      );
    }

    const savedCourses = {};
    for (const course of courses) {
      savedCourses[`${course.shortCode}|${course.branch}`] = await upsert(
        Course,
        { ...scope, shortCode: course.shortCode, branch: course.branch },
        {
          ...course,
          affiliationId: affiliation._id,
          examTerms: buildExamTerms(course.pattern, course.duration),
        },
      );
    }

    // Sample students: university from the affiliation, course by short code + branch
    for (const { course, ...student } of seedStudents[institute.shortCode]) {
      const savedCourse = savedCourses[`${course.shortCode}|${course.branch}`];
      await upsert(
        Student,
        { ...scope, scholarNo: student.scholarNo },
        {
          ...student,
          universityId: affiliation.universityId,
          courseId: savedCourse._id,
          branch: savedCourse.branch,
        },
      );
    }

    institutes[institute.shortCode] = { ...saved.toObject(), departments };
  }

  // The unit: SSISM + SSEC share one set of roles and staff
  const memberIds = seedData.unit.institutes.map((code) => institutes[code]._id);
  const unit = await upsert(
    Unit,
    { tenantId, name: seedData.unit.name },
    { instituteIds: memberIds },
  );
  await Institute.updateMany({ tenantId, _id: { $in: memberIds } }, { $set: { unitId: unit._id } });
  // Roles and access of the institutes as separate owners no longer apply once combined
  await Role.deleteMany({
    tenantId,
    ownerType: OWNER_TYPES.INSTITUTE,
    ownerId: { $in: memberIds },
  });
  await User.updateMany({ tenantId }, { $pull: { access: { ownerId: { $in: memberIds } } } });

  const unitOwner = { ownerType: OWNER_TYPES.UNIT, ownerId: unit._id };
  const roles = {};
  for (const template of ROLE_TEMPLATES) {
    roles[template.name] = await upsert(
      Role,
      { tenantId, ...unitOwner, name: template.name },
      { description: template.description, permissions: template.permissions },
    );
  }

  // Users log in by email
  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, BCRYPT_ROUNDS);
  const loginTable = [];
  for (const user of seedData.users) {
    const access = user.role
      ? [{ ...unitOwner, roleId: roles[user.role]._id, departmentIds: [] }]
      : [];
    await upsert(
      User,
      { tenantId, email: user.email },
      {
        name: user.name,
        passwordHash,
        status: USER_STATUSES.ACTIVE,
        isSuperAdmin: Boolean(user.isSuperAdmin),
        access,
        tokenVersion: 0,
      },
    );
    loginTable.push({
      Email: user.email,
      Password: env.SEED_PASSWORD,
      Role: user.isSuperAdmin ? 'Super Admin' : user.role,
      Institutes: seedData.unit.institutes.join(' + '),
    });
  }

  const studentCount = Object.values(seedStudents).flat().length;
  console.info(
    `\nSeed complete: ${loginTable.length} users, ${ROLE_TEMPLATES.length} shared roles, ${studentCount} sample students.`,
  );
  console.info('Log in with the email and password below (password = SEED_PASSWORD in .env).\n');
  console.table(loginTable);
}

try {
  await seed();
} catch (error) {
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
