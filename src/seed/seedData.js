// The starting data used by seed.js. Change values here, then run `npm run seed` again.
// SSISM and SSEC are combined into one unit that shares roles and staff (ADR-016).
import { COURSE_PATTERNS } from '../constants/coursePatterns.js';

const yearCourse = (name, shortCode, branch = '') => ({
  name,
  shortCode,
  branch,
  pattern: COURSE_PATTERNS.YEAR,
  duration: 3,
});

export const seedData = {
  tenant: {
    name: 'Sant Singaji Education Society',
    address: 'Gram Sandalpur, Tehsil Khategaon, District Dewas (M.P.)',
    contact: '',
    plan: 'standard',
    status: 'active',
  },

  universities: [
    {
      name: 'Vikram University, Ujjain',
      shortCode: 'VIKRAM',
      enrollmentLabel: 'Vikram Univ. Enrollment No.',
    },
    {
      name: 'Rajiv Gandhi Proudyogiki Vishwavidyalaya, Bhopal',
      shortCode: 'RGPV',
      enrollmentLabel: 'RGPV Enrollment No.',
    },
  ],

  // Addresses are copied from each TC book header. Which highway is correct is open question Q9.
  // affiliatedFrom years are placeholders until the Society confirms them.
  institutes: [
    {
      name: 'Sant Singaji Institute of Science and Management',
      shortCode: 'SSISM',
      address: 'Campus: NH-59A, Gram Sandalpur, Tehsil Khategaon, District Dewas (M.P.) 455337',
      website: 'www.ssism.org',
      principalName: '',
      affiliatedTo: 'VIKRAM',
      affiliatedFrom: 2010,
      courses: [
        yearCourse('Bachelor of Business Administration', 'BBA'),
        yearCourse('Bachelor of Computer Applications', 'BCA'),
        yearCourse('Bachelor of Commerce', 'B.Com'),
        yearCourse('Bachelor of Science (Biology)', 'B.Sc', 'Bio'),
        yearCourse('Bachelor of Science (Microbiology)', 'B.Sc', 'Micro'),
      ],
    },
    {
      name: 'Sant Singaji Engineering College',
      shortCode: 'SSEC',
      address: 'Campus: NH-47, Gram Sandalpur, Tehsil Khategaon, District Dewas (M.P.)',
      website: '', // SSEC has no website (SRS ORG-02)
      principalName: '',
      affiliatedTo: 'RGPV',
      affiliatedFrom: 2010,
      courses: [
        {
          name: 'Bachelor of Technology',
          shortCode: 'BTech',
          branch: 'AI & ML',
          pattern: COURSE_PATTERNS.SEMESTER,
          duration: 8,
        },
      ],
    },
  ],

  // Clearance departments: constants/defaultDepartments.js (the same list a new institute gets)

  // SSISM and SSEC run combined: one shared set of roles (the default templates) and staff.
  // The Super Admin can separate them again on the Organisation page.
  unit: { name: 'Sant Singaji Education Society', institutes: ['SSISM', 'SSEC'] },

  // Login is by email. `role` is a role name of the unit; the Super Admin needs no role.
  users: [
    { email: 'superadmin@singaji.in', name: 'Super Admin', isSuperAdmin: true },
    { email: 'admin@singaji.in', name: 'Admin', role: 'Admin' },
  ],
};
