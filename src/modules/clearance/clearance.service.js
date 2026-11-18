import { Student } from '../students/student.model.js';
import { Department } from '../institutes/department.model.js';

import { ClearanceApplication } from './clearanceApplication.model.js';
import { ClearanceItem } from './clearanceItem.model.js';

import { CLEARANCE_STATUSES } from '../../constants/clearanceStatuses.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';

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

  if (departmentIds.length === 0) {
    throw ApiError.forbidden('You are not assigned to any clearance department');
  }

  return departmentIds;
}

// Accounts users are not assigned department queues.
function ensureAccountsAccess(req) {
  if ((req.scope.departmentIds ?? []).length > 0) {
    throw ApiError.forbidden('Department in-charge cannot manage accounts dues');
  }
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
  const { search, sort, page, limit, status, departmentId, fromDate, toDate } = req.query;

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

// CLR-03: Department in-charge updates their own clearance item.
export async function updateClearanceItem(req, itemId, changes) {
  ensureSuperAdminReadOnly(req);
  const assignedIds = getAssignedDepartmentIds(req);

  const item = await ClearanceItem.findOne({
    ...scoped(req),
    _id: itemId,
    departmentId: { $in: assignedIds },
  });

  if (!item) {
    throw ApiError.notFound('Clearance item not found in your assigned departments');
  }

  const before = item.toObject();

  item.status = changes.status;

  if (changes.remark !== undefined) {
    item.remark = changes.remark;
  }

  if (changes.amountDue !== undefined) {
    item.amountDue = changes.amountDue;
  }

  item.statusUpdatedBy = req.user.id;
  item.statusUpdatedAt = new Date();
  item.updatedBy = req.user.id;

  await item.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, 'clearance_item', item._id, before, item);

  return item;
}

// CLR-04: Get one student's clearance profile and all applications.
export async function getStudentClearance(req, studentId) {
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

// CLR-05: Accounts can view all clearance items with an outstanding amount.
export async function listPendingDues(req) {
  ensureAccountsAccess(req);

  const { search, sort, page, limit, departmentId, fromDate, toDate } = req.query;
  const scope = scoped(req);
  const filter = {
    ...scope,
    amountDue: { $gt: 0 },
  };

  if (departmentId) {
    const departmentExists = await Department.exists({
      ...scope,
      _id: departmentId,
    });

    if (!departmentExists) {
      throw ApiError.badRequest('Choose a department of the selected institute');
    }

    filter.departmentId = departmentId;
  }

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
// Super Admin can monitor clearance data but cannot perform operational updates.
function ensureSuperAdminReadOnly(req) {
  if (req.user?.isSuperAdmin) {
    throw ApiError.forbidden('Super Admin has view-only access to clearance');
  }
}
// CLR-05: Accounts manually updates the outstanding amount and remark.
export async function updateClearanceDues(req, itemId, changes) {
  ensureSuperAdminReadOnly(req);
  ensureAccountsAccess(req);

  const item = await ClearanceItem.findOne({
    ...scoped(req),
    _id: itemId,
  });

  if (!item) {
    throw ApiError.notFound('Clearance item not found');
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
