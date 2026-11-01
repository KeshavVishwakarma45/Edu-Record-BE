// Fills the database with starting data for development:  npm run seed
//
// Safe to run again: every record is found by its natural key (name, short code, mobile...)
// and updated in place, so re-running resets the seed records and touches nothing else.
// Records you created yourself (e.g. a new course) are never deleted.
// The data itself is listed in seedData.js (setup and users) and seedStudents.js.
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import '../config/models.js';
import { ROLE_LABELS } from '../constants/roles.js';
import { buildExamTerms } from '../constants/coursePatterns.js';
import { BCRYPT_ROUNDS } from '../modules/auth/auth.service.js';
import { Tenant } from '../modules/institutes/tenant.model.js';
import { Institute } from '../modules/institutes/institute.model.js';
import { University } from '../modules/institutes/university.model.js';
import { Affiliation } from '../modules/institutes/affiliation.model.js';
import { Department } from '../modules/institutes/department.model.js';
import { Course } from '../modules/courses/course.model.js';
import { User } from '../modules/users/user.model.js';
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
  // Make sure unique indexes exist before writing, so duplicates are rejected
  for (const model of Object.values(mongoose.models)) await model.init();

  const tenant = await upsert(Tenant, { name: seedData.tenant.name }, seedData.tenant);
  const tenantId = tenant._id;

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
    for (const [index, name] of seedData.departments.entries()) {
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

  // One login per institute-level role per institute, plus tenant-wide admins
  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, BCRYPT_ROUNDS);
  const loginTable = [];
  for (const user of seedData.users) {
    const access = user.access.map(({ institute, role, department }) => ({
      instituteId: institutes[institute]._id,
      role,
      departmentId: department ? institutes[institute].departments[department]._id : null,
    }));
    await upsert(
      User,
      { tenantId, mobile: user.mobile },
      { name: user.name, passwordHash, isActive: true, access, tokenVersion: 0 },
    );
    loginTable.push({
      Mobile: user.mobile,
      Name: user.name,
      Institutes: user.access.map((a) => a.institute).join(' + '),
      Role: ROLE_LABELS[user.access[0].role],
      Department: user.access[0].department ?? '',
    });
  }

  const studentCount = Object.values(seedStudents).flat().length;
  console.info(`\nSeed complete: ${loginTable.length} users, ${studentCount} sample students.`);
  console.info(
    `Every user below logs in with the password "${env.SEED_PASSWORD}" (SEED_PASSWORD).\n`,
  );
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
