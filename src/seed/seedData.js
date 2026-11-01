// The starting data used by seed.js. Change values here, then run `npm run seed` again.
// Mobile numbers are fake: 90... tenant-wide, 91... SSISM, 92... SSEC.
import { ROLES } from '../constants/roles.js';
import { COURSE_PATTERNS } from '../constants/coursePatterns.js';

const yearCourse = (name, shortCode, branch = '') => ({
  name,
  shortCode,
  branch,
  pattern: COURSE_PATTERNS.YEAR,
  duration: 3,
});

// The institute-level roles: each institute gets one user per role
const instituteUsers = (institute, prefix) =>
  [
    { mobile: `${prefix}00000001`, name: `${institute} Principal`, role: ROLES.PRINCIPAL },
    { mobile: `${prefix}00000002`, name: `${institute} Exam Clerk`, role: ROLES.EXAM_CLERK },
    { mobile: `${prefix}00000003`, name: `${institute} TC Clerk`, role: ROLES.TC_CLERK },
    { mobile: `${prefix}00000004`, name: `${institute} Accounts`, role: ROLES.ACCOUNTS },
    // One department in-charge per clearance department (Account Dept is the Accounts user)
    {
      mobile: `${prefix}00000005`,
      name: `${institute} Library In-charge`,
      role: ROLES.DEPT_INCHARGE,
      department: 'Library',
    },
    {
      mobile: `${prefix}00000006`,
      name: `${institute} Sports In-charge`,
      role: ROLES.DEPT_INCHARGE,
      department: 'Sports',
    },
    {
      mobile: `${prefix}00000007`,
      name: `${institute} Computer Dept In-charge`,
      role: ROLES.DEPT_INCHARGE,
      department: 'Computer Dept',
    },
  ].map(({ role, department, ...user }) => ({
    ...user,
    access: [{ institute, role, department }],
  }));

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

  // Clearance departments, in order, all mandatory (open question Q5 may add more)
  departments: ['Sports', 'Library', 'Computer Dept', 'Account Dept'],

  users: [
    {
      mobile: '9000000000',
      name: 'Platform Admin',
      access: [
        { institute: 'SSISM', role: ROLES.PLATFORM_ADMIN },
        { institute: 'SSEC', role: ROLES.PLATFORM_ADMIN },
      ],
    },
    {
      mobile: '9000000001',
      name: 'Society Admin',
      access: [
        { institute: 'SSISM', role: ROLES.SOCIETY_ADMIN },
        { institute: 'SSEC', role: ROLES.SOCIETY_ADMIN },
      ],
    },
    ...instituteUsers('SSISM', '91'),
    ...instituteUsers('SSEC', '92'),
  ],
};
