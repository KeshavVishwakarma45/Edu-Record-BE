import { InwardBatch, InwardDocument } from '../inward/inward.model.js';
import { TC } from '../tc/tc.model.js';
import { ClearanceItem } from '../clearance/clearanceItem.model.js';

import { DOCUMENT_STATUSES } from '../../constants/statuses.js';
import { CLEARANCE_STATUSES } from '../../constants/clearanceStatuses.js';
import { scoped } from '../../utils/scoped.js';

const hasPermission = (req, ...permissions) =>
  permissions.some((permission) => req.scope.permissions.includes(permission));

const canReadInward = (req) => hasPermission(req, 'inward.read', 'report.view', 'handover.issue');

const canReadClearance = (req) =>
  hasPermission(req, 'clearance.view', 'clearance.act', 'tc.apply', 'report.view');

const canReadTc = (req) => hasPermission(req, 'tc.read', 'tc.approve', 'tc.issue', 'report.view');

const studentPopulate = (req) => ({
  path: 'studentId',
  select: 'name scholarNo enrollmentNo rollNo courseId',
  match: scoped(req),
  populate: {
    path: 'courseId',
    select: 'name shortCode',
    match: scoped(req),
  },
});

const studentDetails = (student) => {
  if (!student) return null;

  const course = student.courseId;

  return {
    id: String(student._id),
    name: student.name,
    scholarNo: student.scholarNo,
    enrollmentNo: student.enrollmentNo,
    rollNo: student.rollNo,
    course: course
      ? {
          id: String(course._id),
          name: course.name,
          shortCode: course.shortCode,
        }
      : null,
  };
};

// --------------------------------------------------
// 1. DASHBOARD SUMMARY
// GET /api/v1/dashboard/summary
// --------------------------------------------------

export async function getSummary(req) {
  const filter = scoped(req);

  const summary = {
    documentsNotReceived: 0,
    documentsInCustody: 0,
    clearancePending: 0,
    tcsAwaitingPrincipalApproval: 0,
    approvedTcsNotHandedOver: 0,
  };

  const tasks = [];

  if (canReadInward(req)) {
    tasks.push(
      Promise.all([
        InwardDocument.countDocuments({
          ...filter,
          status: DOCUMENT_STATUSES.NOT_RECEIVED,
        }),
        InwardDocument.countDocuments({
          ...filter,
          status: DOCUMENT_STATUSES.IN_CUSTODY,
        }),
      ]).then(([notReceived, inCustody]) => {
        summary.documentsNotReceived = notReceived;
        summary.documentsInCustody = inCustody;
      }),
    );
  }

  if (canReadClearance(req)) {
    tasks.push(
      ClearanceItem.distinct('applicationId', {
        ...filter,
        status: {
          $in: [CLEARANCE_STATUSES.PENDING, CLEARANCE_STATUSES.NOT_CLEAR],
        },
      }).then((applicationIds) => {
        summary.clearancePending = applicationIds.length;
      }),
    );
  }

  if (canReadTc(req)) {
    tasks.push(
      Promise.all([
        TC.countDocuments({
          ...filter,
          status: 'pending_approval',
        }),
        TC.countDocuments({
          ...filter,
          status: 'approved',
        }),
      ]).then(([pendingApproval, approved]) => {
        summary.tcsAwaitingPrincipalApproval = pendingApproval;
        summary.approvedTcsNotHandedOver = approved;
      }),
    );
  }

  await Promise.all(tasks);

  return summary;
}

// --------------------------------------------------
// 2. NEEDS YOUR ATTENTION
// GET /api/v1/dashboard/attention
// --------------------------------------------------

export async function getAttention(req) {
  const filter = scoped(req);
  const limit = Number(req.query.limit || 5);

  const countTasks = [];
  const fetchTasks = [];

  // TCs waiting for Principal approval
  if (canReadTc(req)) {
    countTasks.push(
      TC.countDocuments({
        ...filter,
        status: 'pending_approval',
      }),
    );

    fetchTasks.push(
      TC.find({
        ...filter,
        status: 'pending_approval',
      })
        .sort({ submittedAt: -1, createdAt: -1 })
        .limit(limit)
        .populate(studentPopulate(req))
        .lean()
        .then((records) =>
          records
            .filter((record) => record.studentId)
            .map((record) => ({
              recordId: String(record._id),
              type: 'TC_PENDING_APPROVAL',
              title: 'TC waiting for Principal approval',
              description: 'Transfer Certificate is awaiting approval.',
              status: record.status,
              student: studentDetails(record.studentId),
              createdAt: record.submittedAt || record.createdAt,
            })),
        ),
    );
  }

  // Documents not received from university
  if (canReadInward(req)) {
    countTasks.push(
      InwardDocument.countDocuments({
        ...filter,
        status: DOCUMENT_STATUSES.NOT_RECEIVED,
      }),
    );

    fetchTasks.push(
      InwardDocument.find({
        ...filter,
        status: DOCUMENT_STATUSES.NOT_RECEIVED,
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(limit)
        .populate(studentPopulate(req))
        .lean()
        .then((records) =>
          records
            .filter((record) => record.studentId)
            .map((record) => ({
              recordId: String(record._id),
              type: 'DOCUMENT_NOT_RECEIVED',
              title: 'Document not received',
              description:
                record.missingDetails?.otherReason ||
                record.missingDetails?.reason ||
                'Document has not been received from the university.',
              status: record.status,
              documentType: record.documentType,
              student: studentDetails(record.studentId),
              createdAt: record.updatedAt || record.createdAt,
            })),
        ),
    );
  }

  // Clearance applications blocked by pending / not-clear items
  if (canReadClearance(req)) {
    countTasks.push(
      ClearanceItem.distinct('applicationId', {
        ...filter,
        status: {
          $in: [CLEARANCE_STATUSES.PENDING, CLEARANCE_STATUSES.NOT_CLEAR],
        },
      }).then((ids) => ids.length),
    );

    fetchTasks.push(
      (async () => {
        const blockedApplications = await ClearanceItem.aggregate([
          {
            $match: {
              ...filter,
              status: {
                $in: [CLEARANCE_STATUSES.PENDING, CLEARANCE_STATUSES.NOT_CLEAR],
              },
            },
          },
          {
            $group: {
              _id: '$applicationId',
              latestActivity: {
                $max: { $ifNull: ['$updatedAt', '$createdAt'] },
              },
            },
          },
          { $sort: { latestActivity: -1, _id: 1 } },
          { $limit: limit },
        ]);

        const applicationIds = blockedApplications.map((item) => item._id);

        if (applicationIds.length === 0) return [];

        const records = await ClearanceItem.find({
          ...filter,
          applicationId: { $in: applicationIds },
          status: {
            $in: [CLEARANCE_STATUSES.PENDING, CLEARANCE_STATUSES.NOT_CLEAR],
          },
        })
          .sort({ updatedAt: -1, createdAt: -1 })
          .populate(studentPopulate(req))
          .lean();

        const grouped = new Map();

        for (const record of records) {
          const applicationId = String(record.applicationId);

          if (!record.studentId) continue;

          if (!grouped.has(applicationId)) {
            grouped.set(applicationId, {
              recordId: applicationId,
              type: 'CLEARANCE_BLOCKED',
              title: 'TC application blocked by clearance',
              description: 'One or more department clearances are incomplete.',
              status: record.status,
              student: studentDetails(record.studentId),
              pendingDepartments: [],
              createdAt: record.updatedAt || record.createdAt,
            });
          }

          const application = grouped.get(applicationId);

          if (record.status === CLEARANCE_STATUSES.NOT_CLEAR) {
            application.status = CLEARANCE_STATUSES.NOT_CLEAR;
          }

          application.pendingDepartments.push({
            departmentId: String(record.departmentId),
            status: record.status,
            remark: record.remark || '',
          });
        }

        return applicationIds.map((id) => grouped.get(String(id))).filter(Boolean);
      })(),
    );
  }

  // Approved TCs not yet handed over
  if (canReadTc(req)) {
    countTasks.push(
      TC.countDocuments({
        ...filter,
        status: 'approved',
      }),
    );

    fetchTasks.push(
      TC.find({
        ...filter,
        status: 'approved',
      })
        .sort({ approvedAt: -1, createdAt: -1 })
        .limit(limit)
        .populate(studentPopulate(req))
        .lean()
        .then((records) =>
          records
            .filter((record) => record.studentId)
            .map((record) => ({
              recordId: String(record._id),
              type: 'TC_APPROVED_NOT_HANDED_OVER',
              title: 'Approved TC not handed over',
              description: 'TC is approved and waiting to be issued to the student.',
              status: record.status,
              student: studentDetails(record.studentId),
              createdAt: record.approvedAt || record.createdAt,
            })),
        ),
    );
  }

  const [counts, sections] = await Promise.all([Promise.all(countTasks), Promise.all(fetchTasks)]);

  const total = counts.reduce((sum, count) => sum + count, 0);

  const allItems = sections
    .flat()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return {
    items: allItems.slice(0, limit),
    total,
    limit,
  };
}

// --------------------------------------------------
// 3. RECENT INWARD BATCHES
// GET /api/v1/dashboard/recent-inward
// --------------------------------------------------

export async function getRecentInwardBatches(req) {
  const filter = scoped(req);
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const skip = (page - 1) * limit;

  if (!canReadInward(req)) {
    return {
      rows: [],
      meta: { page, limit, total: 0 },
    };
  }

  const [batches, total] = await Promise.all([
    InwardBatch.find(filter)
      .populate({
        path: 'courseId',
        select: 'name shortCode',
        match: filter,
      })
      .sort({ receivedDate: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    InwardBatch.countDocuments(filter),
  ]);

  const batchIds = batches.map((batch) => batch._id);

  const documentCounts = batchIds.length
    ? await InwardDocument.aggregate([
        {
          $match: {
            ...filter,
            batchId: { $in: batchIds },
          },
        },
        {
          $group: {
            _id: '$batchId',
            totalExpected: { $sum: 1 },
            receivedCount: {
              $sum: {
                $cond: [{ $eq: ['$status', DOCUMENT_STATUSES.IN_CUSTODY] }, 1, 0],
              },
            },
            missingCount: {
              $sum: {
                $cond: [{ $eq: ['$status', DOCUMENT_STATUSES.NOT_RECEIVED] }, 1, 0],
              },
            },
          },
        },
      ])
    : [];

  const countMap = new Map(documentCounts.map((item) => [String(item._id), item]));

  const rows = batches.map((batch) => {
    const counts = countMap.get(String(batch._id)) || {};

    return {
      batchId: String(batch._id),
      course: batch.courseId
        ? {
            id: String(batch.courseId._id),
            name: batch.courseId.name,
            shortCode: batch.courseId.shortCode,
          }
        : null,
      examTerm: batch.examTerm,
      examSession: batch.examSession,
      documentType: batch.documentType,
      receivedCount: counts.receivedCount || 0,
      totalExpected: counts.totalExpected || 0,
      missingCount: counts.missingCount || 0,
      receivedDate: batch.receivedDate,
      referenceNumber: batch.referenceNumber,
    };
  });

  return {
    rows,
    meta: { page, limit, total },
  };
}

// --------------------------------------------------
// 4. RECENTLY ISSUED TCs
// GET /api/v1/dashboard/recent-tcs
// --------------------------------------------------

export async function getRecentIssuedTcs(req) {
  const filter = scoped(req);
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const skip = (page - 1) * limit;

  if (!canReadTc(req)) {
    return {
      rows: [],
      meta: { page, limit, total: 0 },
    };
  }

  const [records, total] = await Promise.all([
    TC.find({
      ...filter,
      status: 'issued',
    })
      .sort({ issuedAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate(studentPopulate(req))
      .lean(),

    TC.countDocuments({
      ...filter,
      status: 'issued',
    }),
  ]);

  const rows = records
    .filter((record) => record.studentId)
    .map((record) => {
      const student = record.studentId;

      return {
        tcId: String(record._id),
        referenceNumber: record.refNo,
        bookSerial: record.bookSerial,
        studentId: String(student._id),
        studentName: student.name,
        scholarNo: student.scholarNo,
        course: student.courseId
          ? {
              name: student.courseId.name,
              shortCode: student.courseId.shortCode,
            }
          : null,
        issueDate: record.issuedAt,
        collectedBy: record.receivedBy,
      };
    });

  return {
    rows,
    meta: { page, limit, total },
  };
}
