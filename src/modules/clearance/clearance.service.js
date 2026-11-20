import { Student } from '../students/student.model.js';
import { Department } from '../institutes/department.model.js';

import { ClearanceApplication } from './clearanceApplication.model.js';
import { ClearanceItem } from './clearanceItem.model.js';
import { AuditLog } from '../audit/auditLog.model.js';

import { CLEARANCE_STATUSES } from '../../constants/clearanceStatuses.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { PERMISSIONS } from '../../constants/permissions.js';

import { ApiError } from '../../utils/ApiError.js';
import { scoped } from '../../utils/scoped.js';
import { withTransaction } from '../../utils/transaction.js';
import { audit } from '../../utils/audit.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
const ENTITY = 'clearance_application';

// CLR-01 and CLR-02: Create TC application and department-wise clearance items.
export async function createApplication(req, data) {
  ensureSuperAdminReadOnly(req);
  return withTransaction(async (session) => {
    const scope = scoped(req);

    // Check that the student belongs to the selected institute.
    const student = await Student.findOne({
      ...scope,
      _id: data.studentId,
    })
      .session(session)
      .lean();

    if (!student) {
      throw ApiError.notFound('Student not found in the selected institute');
    }

    // Get every department configured for this institute.
    const departments = await Department.find(scope)
      .sort({ order: 1, name: 1 })
      .session(session)
      .lean();

    if (departments.length === 0) {
      throw ApiError.conflict(
        'No departments are configured for this institute. Please configure departments first.',
      );
    }

    // Create the TC clearance application.
    const [application] = await ClearanceApplication.create(
      [
        {
          ...data,
          ...scope,
          studentId: student._id,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      ],
      { session, ordered: true },
    );

    // Create one PENDING clearance item for every department.
    const itemData = departments.map((department) => ({
      tenantId: req.scope.tenantId,
      instituteId: req.scope.instituteId,
      applicationId: application._id,
      studentId: student._id,
      departmentId: department._id,
      status: CLEARANCE_STATUSES.PENDING,
      remark: '',
      amountDue: 0,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    }));

    const items = await ClearanceItem.create(itemData, {
      session,
      ordered: true,
    });

    // Record the application and generated clearance items in the audit log.
    await audit(
      req,
      AUDIT_ACTIONS.CREATE,
      ENTITY,
      application._id,
      null,
      {
        application: application.toObject(),
        clearanceItems: items.map((item) => item.toObject()),
      },
      session,
    );

    // Record the initial PENDING state for every department item.
    for (const item of items) {
      await audit(req, AUDIT_ACTIONS.CREATE, 'clearance_item', item._id, null, item, session);
    }

    // Return application and department-wise initial status.
    return {
      application: application.toObject(),
      overallStatus: CLEARANCE_STATUSES.PENDING,
      clearanceItems: items.map((item, index) => ({
        ...item.toObject(),
        departmentName: departments[index].name,
      })),
    };
  });
}

// CLR-02: List clearance applications with student and department-wise status.
export async function listApplications(req) {
  ensureNotDepartmentQueueOnly(req);
  const { search, sort, page, limit, studentId, fromDate, toDate } = req.query;

  const scope = scoped(req);
  const filter = { ...scope };

  // Search student records by name, scholar number or roll number.
  if (search) {
    const matchingStudents = await Student.find({
      ...scope,
      ...searchFilter(search, ['name', 'scholarNo', 'rollNo']),
    })
      .select('_id')
      .lean();

    const matchingStudentIds = matchingStudents.map((student) => student._id);

    if (matchingStudentIds.length === 0) {
      return {
        rows: [],
        meta: { page, limit, total: 0 },
      };
    }

    if (studentId) {
      const studentMatches = matchingStudentIds.some((id) => String(id) === String(studentId));

      if (!studentMatches) {
        return {
          rows: [],
          meta: { page, limit, total: 0 },
        };
      }

      filter.studentId = studentId;
    } else {
      filter.studentId = { $in: matchingStudentIds };
    }
  } else if (studentId) {
    filter.studentId = studentId;
  }

  // Application creation date filters.
  const createdAt = {};

  if (fromDate) {
    createdAt.$gte = new Date(fromDate);
  }

  if (toDate) {
    const endDate = new Date(toDate);

    // Include the complete day when the client sends YYYY-MM-DD.
    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      endDate.setUTCHours(23, 59, 59, 999);
    }

    createdAt.$lte = endDate;
  }

  if (Object.keys(createdAt).length > 0) {
    filter.createdAt = createdAt;
  }

  const { skip } = pageOptions(req.query);

  // Fetch applications and total count using the same scoped filter.
  const [applications, total] = await Promise.all([
    ClearanceApplication.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),

    ClearanceApplication.countDocuments(filter),
  ]);

  if (applications.length === 0) {
    return {
      rows: [],
      meta: { page, limit, total },
    };
  }

  const applicationIds = applications.map((application) => application._id);
  const studentIds = [...new Set(applications.map((application) => String(application.studentId)))];

  // Fetch student details only for the current page.
  const students = await Student.find({
    ...scope,
    _id: { $in: studentIds },
  })
    .select('name scholarNo rollNo')
    .lean();

  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  // Fetch department-wise clearance items for the current page.
  const clearanceItems = await ClearanceItem.find({
    ...scope,
    applicationId: { $in: applicationIds },
  })
    .populate({
      path: 'departmentId',
      match: { tenantId: req.scope.tenantId },
      select: 'name order mandatory',
    })
    .lean();

  const itemsByApplication = new Map();

  for (const item of clearanceItems) {
    const applicationKey = String(item.applicationId);

    if (!itemsByApplication.has(applicationKey)) {
      itemsByApplication.set(applicationKey, []);
    }

    itemsByApplication.get(applicationKey).push(item);
  }

  const rows = applications.map((application) => {
    const student = studentMap.get(String(application.studentId)) ?? null;

    const items = itemsByApplication.get(String(application._id)) ?? [];

    // Overall status is calculated by the backend.
    let overallStatus = CLEARANCE_STATUSES.CLEAR;

    if (items.length === 0 || items.some((item) => item.status === CLEARANCE_STATUSES.PENDING)) {
      overallStatus = CLEARANCE_STATUSES.PENDING;
    }

    if (items.some((item) => item.status === CLEARANCE_STATUSES.NOT_CLEAR)) {
      overallStatus = CLEARANCE_STATUSES.NOT_CLEAR;
    }

    return {
      ...application,

      student: student
        ? {
            _id: student._id,
            name: student.name,
            scholarNo: student.scholarNo,
            rollNo: student.rollNo,
          }
        : null,

      overallStatus,

      departmentWiseStatus: items.map((item) => ({
        itemId: item._id,
        departmentId: item.departmentId?._id ?? item.departmentId,
        departmentName: item.departmentId?.name ?? 'Unknown department',
        status: item.status,
        remark: item.remark,
        amountDue: item.amountDue,
        statusUpdatedAt: item.statusUpdatedAt,
      })),
    };
  });

  return {
    rows,
    meta: { page, limit, total },
  };
}

// Require a department assignment for department-in-charge operations.
function getAssignedDepartmentIds(req) {
  const departmentIds = req.scope.departmentIds ?? [];

  if (departmentIds.length !== 1) {
    throw ApiError.forbidden(
      'Department In-charge must be assigned to exactly one clearance department',
    );
  }

  return departmentIds;
}

// Department in-charge uses department-scoped APIs only.
function ensureNotDepartmentQueueOnly(req) {
  const departmentIds = req.scope.departmentIds ?? [];
  const permissions = req.scope.permissions ?? [];

  const hasTcAccess =
    permissions.includes(PERMISSIONS.TC_READ) || permissions.includes(PERMISSIONS.TC_APPLY);

  if (departmentIds.length > 0 || !hasTcAccess) {
    throw ApiError.forbidden('Your role cannot access institute-wide clearance records');
  }
}

// Accounts users can access institute-level Accounts operations.
// Department In-charge users are restricted to their assigned department.
function ensureAccountsAccess(req) {
  const departmentIds = req.scope.departmentIds ?? [];
  const permissions = req.scope.permissions ?? [];

  const hasAccountsPermissions =
    permissions.includes(PERMISSIONS.CLEARANCE_ACT) &&
    permissions.includes(PERMISSIONS.COURSE_READ);

  if (departmentIds.length > 0 || !hasAccountsPermissions) {
    throw ApiError.forbidden('Your role cannot manage institute-level Accounts operations');
  }
}

// Recognize the Accounts department using its configured department name.
const ACCOUNTS_DEPARTMENT_NAME = /^accounts?(?:[\s._-]*(?:department|dept))?[\s.]*$/i;

function isAccountsDepartmentName(name) {
  return ACCOUNTS_DEPARTMENT_NAME.test(String(name ?? '').trim());
}

async function findAccountsDepartment(req) {
  return Department.findOne({
    ...scoped(req),
    name: ACCOUNTS_DEPARTMENT_NAME,
  })
    .select('_id name')
    .lean();
}

// Build a date range for list filters.
function buildDateRange(fromDate, toDate) {
  const range = {};

  if (fromDate) {
    range.$gte = new Date(fromDate);
  }

  if (toDate) {
    const endDate = new Date(toDate);

    if (typeof toDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      endDate.setUTCHours(23, 59, 59, 999);
    }

    range.$lte = endDate;
  }

  return Object.keys(range).length ? range : null;
}

// Add student, application and department details to clearance item rows.
async function enrichClearanceItems(req, items) {
  if (items.length === 0) return [];

  const scope = scoped(req);

  const studentIds = [...new Set(items.map((item) => String(item.studentId)))];
  const applicationIds = [...new Set(items.map((item) => String(item.applicationId)))];
  const departmentIds = [...new Set(items.map((item) => String(item.departmentId)))];

  const [students, applications, departments] = await Promise.all([
    Student.find({ ...scope, _id: { $in: studentIds } })
      .select('name scholarNo rollNo enrollmentNo')
      .lean(),

    ClearanceApplication.find({ ...scope, _id: { $in: applicationIds } })
      .select('lastClassAttended leavingReason createdAt')
      .lean(),

    Department.find({ ...scope, _id: { $in: departmentIds } })
      .select('name order mandatory')
      .lean(),
  ]);

  const studentMap = new Map(students.map((student) => [String(student._id), student]));
  const applicationMap = new Map(
    applications.map((application) => [String(application._id), application]),
  );
  const departmentMap = new Map(
    departments.map((department) => [String(department._id), department]),
  );

  return items.map((item) => {
    const application = applicationMap.get(String(item.applicationId));
    const department = departmentMap.get(String(item.departmentId));

    return {
      ...item,
      student: studentMap.get(String(item.studentId)) ?? null,
      application: application
        ? {
            applicationId: application._id,
            lastClassAttended: application.lastClassAttended,
            leavingReason: application.leavingReason,
            applicationDate: application.createdAt,
          }
        : null,
      departmentName: department?.name ?? 'Unknown department',
      departmentOrder: department?.order ?? 0,
    };
  });
}

// CLR-03: Department in-charge sees only their assigned department queue.
export async function listDepartmentQueue(req) {
  const { search, sort, page, limit, status, departmentId, dateFrom, dateTo, fromDate, toDate } =
    req.query;

  const assignedIds = getAssignedDepartmentIds(req);
  const scope = scoped(req);
  const filter = { ...scope };

  if (
    departmentId &&
    !assignedIds.some((assignedId) => String(assignedId) === String(departmentId))
  ) {
    throw ApiError.forbidden('You are not assigned to this department');
  }

  filter.departmentId = departmentId || { $in: assignedIds };
  if (status) {
    filter.status = status;
  }

  const dateRange = buildDateRange(dateFrom ?? fromDate, dateTo ?? toDate);
  if (dateRange) {
    filter.createdAt = dateRange;
  }

  if (search) {
    const matchingStudents = await Student.find({
      ...scope,
      ...searchFilter(search, ['name', 'scholarNo', 'rollNo']),
    })
      .select('_id')
      .lean();

    if (matchingStudents.length === 0) {
      return { rows: [], meta: { page, limit, total: 0 } };
    }

    filter.studentId = { $in: matchingStudents.map((student) => student._id) };
  }

  const { skip } = pageOptions(req.query);

  const [items, total] = await Promise.all([
    ClearanceItem.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),
    ClearanceItem.countDocuments(filter),
  ]);

  const rows = await enrichClearanceItems(req, items);

  return { rows, meta: { page, limit, total } };
}

// Department in-charge: count pending clearance items.
export async function getDepartmentPendingCount(req) {
  const assignedIds = getAssignedDepartmentIds(req);

  const pendingCount = await ClearanceItem.countDocuments({
    ...scoped(req),
    departmentId: { $in: assignedIds },
    status: CLEARANCE_STATUSES.PENDING,
  });

  return { pendingCount };
}

// Department in-charge: fetch application details for assigned departments only.
export async function getDepartmentApplicationDetails(req, clearanceApplicationId) {
  const assignedIds = getAssignedDepartmentIds(req);
  const scope = scoped(req);

  const application = await ClearanceApplication.findOne({
    ...scope,
    _id: clearanceApplicationId,
  }).lean();

  if (!application) {
    throw ApiError.notFound('Clearance application not found');
  }

  const items = await ClearanceItem.find({
    ...scope,
    applicationId: application._id,
    departmentId: { $in: assignedIds },
  })
    .sort({ createdAt: 1 })
    .lean();

  if (items.length === 0) {
    throw ApiError.notFound('Clearance application not found in your assigned department queue');
  }

  const [student, departments] = await Promise.all([
    Student.findOne({
      ...scope,
      _id: application.studentId,
    })
      .select('name scholarNo rollNo enrollmentNo courseId branch batch status')
      .lean(),

    Department.find({
      ...scope,
      _id: { $in: items.map((item) => item.departmentId) },
    })
      .select('name order mandatory')
      .lean(),
  ]);

  const departmentMap = new Map(
    departments.map((department) => [String(department._id), department]),
  );

  const documentsEnclosed = application.documentsEnclosed ?? {};

  return {
    application: {
      _id: application._id,
      studentId: application.studentId,
      lastClassAttended: application.lastClassAttended,
      leavingReason: application.leavingReason,
      documentsEnclosed,
      submittedDocuments: Object.entries(documentsEnclosed)
        .filter(([, submitted]) => submitted === true)
        .map(([documentName]) => documentName),
      declarations: application.declarations ?? {},
      submittedAt: application.createdAt,
    },
    student,
    departmentClearances: items.map((item) => {
      const department = departmentMap.get(String(item.departmentId));

      return {
        clearanceItemId: item._id,
        department: department
          ? {
              _id: department._id,
              name: department.name,
              order: department.order,
              mandatory: department.mandatory,
            }
          : null,
        verificationStatus: item.status,
        remarks: item.remark,
        amountDue: item.amountDue,
        verifiedBy: item.statusUpdatedBy,
        verifiedAt: item.statusUpdatedAt,
      };
    }),
  };
}

// Department in-charge: list append-only clearance audit history.
export async function listDepartmentHistory(req) {
  const assignedIds = getAssignedDepartmentIds(req);

  const { page, limit, studentId, status, dateFrom, dateTo } = req.query;

  const filter = {
    ...scoped(req),
    entity: 'clearance_item',
    action: {
      $in: [AUDIT_ACTIONS.CREATE, AUDIT_ACTIONS.UPDATE],
    },
    'after.departmentId': { $in: assignedIds },
  };

  if (studentId) {
    // Resolve the ID through the scoped Student model.
    // AuditLog.after is Mixed, so nested ObjectId values need explicit resolution.
    const student = await Student.findOne({
      ...scoped(req),
      _id: studentId,
    })
      .select('_id')
      .lean();

    if (!student) {
      return { rows: [], meta: { page, limit, total: 0 } };
    }

    filter['after.studentId'] = student._id;
  }

  if (status) {
    filter['after.status'] = status;
  }

  const dateRange = buildDateRange(dateFrom, dateTo);

  if (dateRange) {
    filter.at = dateRange;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate({
        path: 'userId',
        select: 'name email',
        match: { tenantId: req.scope.tenantId },
      })
      .sort({ at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    AuditLog.countDocuments(filter),
  ]);

  const studentIds = [
    ...new Set(
      logs
        .map((log) => log.after?.studentId ?? log.before?.studentId)
        .filter(Boolean)
        .map(String),
    ),
  ];

  const departmentIds = [
    ...new Set(
      logs
        .map((log) => log.after?.departmentId ?? log.before?.departmentId)
        .filter(Boolean)
        .map(String),
    ),
  ];

  const [students, departments] = await Promise.all([
    Student.find({
      ...scoped(req),
      _id: { $in: studentIds },
    })
      .select('name scholarNo rollNo enrollmentNo')
      .lean(),

    Department.find({
      ...scoped(req),
      _id: { $in: departmentIds },
    })
      .select('name')
      .lean(),
  ]);

  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  const departmentMap = new Map(
    departments.map((department) => [String(department._id), department]),
  );

  const rows = logs.map((log) => {
    const previous = log.before ?? null;
    const current = log.after ?? null;

    const studentIdValue = current?.studentId ?? previous?.studentId;

    const departmentIdValue = current?.departmentId ?? previous?.departmentId;

    const actor = log.userId;

    return {
      historyId: log._id,
      clearanceItemId: log.entityId,
      action: log.action,

      student: studentMap.get(String(studentIdValue)) ?? null,

      department: departmentMap.get(String(departmentIdValue)) ?? null,

      previous: previous
        ? {
            status: previous.status ?? null,
            remarks: previous.remark ?? '',
            amountDue: previous.amountDue ?? 0,
          }
        : null,

      current: current
        ? {
            status: current.status ?? null,
            remarks: current.remark ?? '',
            amountDue: current.amountDue ?? 0,
          }
        : null,

      performedBy: actor
        ? {
            id: actor._id,
            name: actor.name,
            email: actor.email,
          }
        : null,

      timestamp: log.at,
    };
  });

  return {
    rows,
    meta: { page, limit, total },
  };
}

// CLR-05: Accounts can view only Accounts Department audit history.
export async function listAccountsHistory(req) {
  ensureAccountsAccess(req);

  const scope = scoped(req);
  const accountsDepartment = await findAccountsDepartment(req);

  if (!accountsDepartment) {
    throw ApiError.conflict('Accounts department is not configured for this institute');
  }

  const { page, limit, search, studentId, status, dateFrom, dateTo } = req.query;

  const filter = {
    ...scope,
    entity: 'clearance_item',
    action: {
      $in: [AUDIT_ACTIONS.CREATE, AUDIT_ACTIONS.UPDATE],
    },
    'after.departmentId': accountsDepartment._id,
  };

  // Optional student ID filter.
  let matchingStudents = null;

  if (studentId) {
    const student = await Student.findOne({
      ...scope,
      _id: studentId,
    })
      .select('_id')
      .lean();

    if (!student) {
      return { rows: [], meta: { page, limit, total: 0 } };
    }

    matchingStudents = [student];
  }

  // Optional student name, scholar number or roll number search.
  if (search) {
    const searchedStudents = await Student.find({
      ...scope,
      ...searchFilter(search, ['name', 'scholarNo', 'rollNo']),
    })
      .select('_id')
      .lean();

    if (matchingStudents) {
      const searchedIds = new Set(searchedStudents.map((student) => String(student._id)));

      matchingStudents = matchingStudents.filter((student) => searchedIds.has(String(student._id)));
    } else {
      matchingStudents = searchedStudents;
    }
  }

  if (matchingStudents) {
    if (matchingStudents.length === 0) {
      return { rows: [], meta: { page, limit, total: 0 } };
    }

    filter['after.studentId'] = {
      $in: matchingStudents.map((student) => student._id),
    };
  }

  if (status) {
    filter['after.status'] = status;
  }

  const dateRange = buildDateRange(dateFrom, dateTo);

  if (dateRange) {
    filter.at = dateRange;
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate({
        path: 'userId',
        select: 'name email',
        match: { tenantId: req.scope.tenantId },
      })
      .sort({ at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    AuditLog.countDocuments(filter),
  ]);

  const studentIds = [
    ...new Set(
      logs
        .map((log) => log.after?.studentId ?? log.before?.studentId)
        .filter(Boolean)
        .map(String),
    ),
  ];

  const departmentIds = [
    ...new Set(
      logs
        .map((log) => log.after?.departmentId ?? log.before?.departmentId)
        .filter(Boolean)
        .map(String),
    ),
  ];

  const [students, departments] = await Promise.all([
    Student.find({
      ...scope,
      _id: { $in: studentIds },
    })
      .select('name scholarNo rollNo enrollmentNo')
      .lean(),

    Department.find({
      ...scope,
      _id: { $in: departmentIds },
    })
      .select('name')
      .lean(),
  ]);

  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  const departmentMap = new Map(
    departments.map((department) => [String(department._id), department]),
  );

  const rows = logs.map((log) => {
    const previous = log.before ?? null;
    const current = log.after ?? null;

    const studentIdValue = current?.studentId ?? previous?.studentId;
    const departmentIdValue = current?.departmentId ?? previous?.departmentId;
    const actor = log.userId;

    return {
      historyId: log._id,
      clearanceItemId: log.entityId,
      action: log.action,

      student: studentMap.get(String(studentIdValue)) ?? null,

      department: departmentMap.get(String(departmentIdValue)) ?? null,

      previous: previous
        ? {
            status: previous.status ?? null,
            remarks: previous.remark ?? '',
            amountDue: previous.amountDue ?? 0,
          }
        : null,

      current: current
        ? {
            status: current.status ?? null,
            remarks: current.remark ?? '',
            amountDue: current.amountDue ?? 0,
          }
        : null,

      performedBy: actor
        ? {
            id: actor._id,
            name: actor.name,
            email: actor.email,
          }
        : null,

      timestamp: log.at,
    };
  });

  return {
    rows,
    meta: { page, limit, total },
  };
}

// Calculate one overall clearance status from department-wise statuses.
function calculateOverallStatus(items) {
  if (items.some((item) => item.status === CLEARANCE_STATUSES.NOT_CLEAR)) {
    return CLEARANCE_STATUSES.NOT_CLEAR;
  }

  if (items.length === 0 || items.some((item) => item.status === CLEARANCE_STATUSES.PENDING)) {
    return CLEARANCE_STATUSES.PENDING;
  }

  return CLEARANCE_STATUSES.CLEAR;
}

// CLR-03: Department In-charge updates assigned clearance.
// Accounts/Admin updates Accounts Department clearance only.
export async function updateClearanceItem(req, itemId, changes) {
  ensureSuperAdminReadOnly(req);

  const scope = scoped(req);
  const assignedIds = req.scope.departmentIds ?? [];

  let departmentFilter;
  let notFoundMessage;

  // Department In-charge workflow.
  if (assignedIds.length > 0) {
    const departmentIds = getAssignedDepartmentIds(req);

    const assignedDepartment = await Department.findOne({
      ...scope,
      _id: departmentIds[0],
    })
      .select('name')
      .lean();

    if (!assignedDepartment) {
      throw ApiError.forbidden('Your assigned department is not available');
    }

    // Accounts Department must be handled by Accounts only.
    if (isAccountsDepartmentName(assignedDepartment.name)) {
      throw ApiError.forbidden('Accounts Department clearance can only be processed by Accounts');
    }

    departmentFilter = { $in: departmentIds };
    notFoundMessage = 'Clearance item not found in your assigned department';
  } else {
    // Accounts/Admin workflow.
    ensureAccountsAccess(req);

    const accountsDepartment = await findAccountsDepartment(req);

    if (!accountsDepartment) {
      throw ApiError.conflict('Accounts department is not configured for this institute');
    }

    departmentFilter = accountsDepartment._id;
    notFoundMessage = 'Accounts clearance item not found in this institute';
  }

  // Institute-scoped lookup prevents cross-institute updates.
  const item = await ClearanceItem.findOne({
    ...scope,
    _id: itemId,
    departmentId: departmentFilter,
  });

  if (!item) {
    throw ApiError.notFound(notFoundMessage);
  }

  const before = item.toObject();

  const nextStatus = changes.status ?? item.status;
  const nextRemark = changes.remark !== undefined ? changes.remark : item.remark;

  if (nextStatus === CLEARANCE_STATUSES.NOT_CLEAR && !nextRemark?.trim()) {
    throw ApiError.badRequest('A reason is required when clearance is marked NOT_CLEAR');
  }

  if (changes.status !== undefined) {
    item.status = changes.status;
  }

  if (changes.remark !== undefined) {
    item.remark = changes.remark;
  }

  if (changes.amountDue !== undefined) {
    item.amountDue = changes.amountDue;
  }

  if (changes.status !== undefined || changes.remark !== undefined) {
    item.statusUpdatedBy = req.user.id;
    item.statusUpdatedAt = new Date();
  }

  item.updatedBy = req.user.id;

  await item.save();

  // Record status, amount and remark changes in audit history.
  await audit(req, AUDIT_ACTIONS.UPDATE, 'clearance_item', item._id, before, item);

  return item;
}

// CLR-04: Get one student's clearance profile and all applications.
export async function getStudentClearance(req, studentId) {
  ensureNotDepartmentQueueOnly(req);
  const scope = scoped(req);

  const student = await Student.findOne({
    ...scope,
    _id: studentId,
  })
    .select('name scholarNo rollNo enrollmentNo courseId branch batch status')
    .lean();

  if (!student) {
    throw ApiError.notFound('Student not found in the selected institute');
  }

  const applications = await ClearanceApplication.find({
    ...scope,
    studentId: student._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (applications.length === 0) {
    return { student, applications: [] };
  }

  const items = await ClearanceItem.find({
    ...scope,
    applicationId: { $in: applications.map((application) => application._id) },
  }).lean();

  const enrichedItems = await enrichClearanceItems(req, items);
  const itemsByApplication = new Map();

  for (const item of enrichedItems) {
    const key = String(item.applicationId);

    if (!itemsByApplication.has(key)) {
      itemsByApplication.set(key, []);
    }

    itemsByApplication.get(key).push(item);
  }

  const result = applications.map((application) => {
    const departmentItems = itemsByApplication.get(String(application._id)) ?? [];

    departmentItems.sort(
      (a, b) =>
        a.departmentOrder - b.departmentOrder || a.departmentName.localeCompare(b.departmentName),
    );

    return {
      ...application,
      overallStatus: calculateOverallStatus(departmentItems),
      departmentWiseStatus: departmentItems.map((item) => ({
        itemId: item._id,
        departmentId: item.departmentId,
        departmentName: item.departmentName,
        status: item.status,
        remark: item.remark,
        amountDue: item.amountDue,
        statusUpdatedBy: item.statusUpdatedBy,
        statusUpdatedAt: item.statusUpdatedAt,
      })),
    };
  });

  return { student, applications: result };
}

// CLR-05: Accounts can view outstanding dues from Accounts Department only.
export async function listPendingDues(req) {
  ensureAccountsAccess(req);

  const scope = scoped(req);
  const accountsDepartment = await findAccountsDepartment(req);

  if (!accountsDepartment) {
    throw ApiError.conflict('Accounts department is not configured for this institute');
  }

  const { search, sort, page, limit, departmentId, fromDate, toDate } = req.query;

  // Prevent Accounts users from selecting other department dues.
  if (departmentId && String(departmentId) !== String(accountsDepartment._id)) {
    throw ApiError.badRequest('Accounts users can only view Accounts Department dues');
  }

  const filter = {
    ...scope,
    departmentId: accountsDepartment._id,
    amountDue: { $gt: 0 },
  };

  const dateRange = buildDateRange(fromDate, toDate);

  if (dateRange) {
    filter.createdAt = dateRange;
  }

  if (search) {
    const matchingStudents = await Student.find({
      ...scope,
      ...searchFilter(search, ['name', 'scholarNo', 'rollNo']),
    })
      .select('_id')
      .lean();

    if (matchingStudents.length === 0) {
      return { rows: [], meta: { page, limit, total: 0 } };
    }

    filter.studentId = {
      $in: matchingStudents.map((student) => student._id),
    };
  }

  const { skip } = pageOptions(req.query);

  const [items, total] = await Promise.all([
    ClearanceItem.find(filter).sort(sortOption(sort)).skip(skip).limit(limit).lean(),

    ClearanceItem.countDocuments(filter),
  ]);

  const rows = await enrichClearanceItems(req, items);

  return { rows, meta: { page, limit, total } };
}

// CLR-05: Count outstanding dues in Accounts Department only.
export async function getAccountsPendingCount(req) {
  ensureAccountsAccess(req);

  const scope = scoped(req);
  const accountsDepartment = await findAccountsDepartment(req);

  if (!accountsDepartment) {
    throw ApiError.conflict('Accounts department is not configured for this institute');
  }

  const pendingCount = await ClearanceItem.countDocuments({
    ...scope,
    departmentId: accountsDepartment._id,
    amountDue: { $gt: 0 },
  });

  return { pendingCount };
}

// Super Admin can monitor clearance data but cannot perform operational updates.
function ensureSuperAdminReadOnly(req) {
  if (req.user?.isSuperAdmin) {
    throw ApiError.forbidden('Super Admin has view-only access to clearance');
  }
}
// CLR-05: Accounts updates dues for Accounts Department only.
export async function updateClearanceDues(req, itemId, changes) {
  ensureSuperAdminReadOnly(req);
  ensureAccountsAccess(req);

  const scope = scoped(req);
  const accountsDepartment = await findAccountsDepartment(req);

  if (!accountsDepartment) {
    throw ApiError.conflict('Accounts department is not configured for this institute');
  }

  const item = await ClearanceItem.findOne({
    ...scope,
    _id: itemId,
    departmentId: accountsDepartment._id,
  });

  if (!item) {
    throw ApiError.notFound('Accounts clearance item not found in this institute');
  }

  const before = item.toObject();

  item.amountDue = changes.amountDue;

  if (changes.remark !== undefined) {
    item.remark = changes.remark;
  }

  item.updatedBy = req.user.id;

  await item.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, 'clearance_item', item._id, before, item);

  return item;
}

/**
 * Verify mandatory department clearances before TC submission.
 *
 * applicationId is required so that historical clearance applications
 * cannot accidentally be used to approve a new TC application.
 */
export async function validateMandatoryClearances(req, studentId, applicationId) {
  const scope = scoped(req);

  const studentExists = await Student.exists({
    ...scope,
    _id: studentId,
  });

  if (!studentExists) {
    throw ApiError.notFound('Student not found in the selected institute');
  }

  const application = await ClearanceApplication.findOne({
    ...scope,
    _id: applicationId,
    studentId,
  })
    .select('_id studentId')
    .lean();

  if (!application) {
    throw ApiError.notFound('Clearance application not found for this student');
  }

  // Only departments marked mandatory are considered for TC eligibility.
  const departments = await Department.find({
    ...scope,
    mandatory: true,
  })
    .select('name order')
    .sort({ order: 1, name: 1 })
    .lean();

  const departmentIds = departments.map((department) => department._id);

  const items = departmentIds.length
    ? await ClearanceItem.find({
        ...scope,
        applicationId: application._id,
        studentId,
        departmentId: { $in: departmentIds },
      })
        .select('departmentId status remark amountDue statusUpdatedAt')
        .lean()
    : [];

  const itemMap = new Map(items.map((item) => [String(item.departmentId), item]));

  const mandatoryDepartments = departments.map((department) => {
    const item = itemMap.get(String(department._id));

    return {
      departmentId: department._id,
      departmentName: department.name,
      status: item?.status ?? 'MISSING',
      remark: item?.remark ?? '',
      amountDue: item?.amountDue ?? 0,
      isClear: item?.status === CLEARANCE_STATUSES.CLEAR,
    };
  });

  const incompleteDepartments = mandatoryDepartments.filter((department) => !department.isClear);

  return {
    isEligibleForTCSubmission: incompleteDepartments.length === 0,
    studentId,
    clearanceApplicationId: application._id,
    mandatoryDepartmentCount: mandatoryDepartments.length,
    clearedMandatoryDepartmentCount: mandatoryDepartments.length - incompleteDepartments.length,
    mandatoryDepartments,
    incompleteDepartments,
  };
}
