// Loads every Mongoose model once at start-up.
// populate() looks models up by name ('University', 'Affiliation'...), so a model must be
// registered even when no file in the current request imports it. Add every new model here.
import '../modules/institutes/tenant.model.js';
import '../modules/institutes/institute.model.js';
import '../modules/institutes/university.model.js';
import '../modules/institutes/affiliation.model.js';
import '../modules/institutes/department.model.js';
import '../modules/organisation/unit.model.js';
import '../modules/roles/role.model.js';
import '../modules/users/user.model.js';
import '../modules/audit/auditLog.model.js';
import '../modules/files/file.model.js';
import '../modules/courses/course.model.js';
import '../modules/students/student.model.js';
