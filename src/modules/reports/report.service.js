import mongoose from 'mongoose';

import { InwardBatch, InwardDocument } from '../inward/inward.model.js';
import { Student } from '../students/student.model.js';
import { Course } from '../courses/course.model.js';
import { University } from '../institutes/university.model.js';

import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { DOCUMENT_STATUSES } from '../../constants/statuses.js';

const ENTITY = 'inward document';

function scopedLookupMatch(alias, scope) {
  return Object.fromEntries(
    Object.entries(scope).map(([key, value]) => [`${alias}.${key}`, value]),
  );
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// API 1: GET not-received documents
export async function getNotReceivedDocuments(req) {
  const { page, limit, search, courseId, documentType, fromDate, toDate, sort } = req.query;

  const scope = scoped(req);

  const pipeline = [
    // Every aggregation must start with tenant-scoped match.
    {
      $match: {
        ...scope,
        status: DOCUMENT_STATUSES.NOT_RECEIVED,
      },
    },

    // Join inward batch.
    {
      $lookup: {
        from: InwardBatch.collection.name,
        localField: 'batchId',
        foreignField: '_id',
        as: 'batch',
      },
    },
    { $unwind: '$batch' },
    { $match: scopedLookupMatch('batch', scope) },

    // Join student.
    {
      $lookup: {
        from: Student.collection.name,
        localField: 'studentId',
        foreignField: '_id',
        as: 'student',
      },
    },
    { $unwind: '$student' },
    { $match: scopedLookupMatch('student', scope) },

    // Join course.
    {
      $lookup: {
        from: Course.collection.name,
        localField: 'batch.courseId',
        foreignField: '_id',
        as: 'course',
      },
    },
    { $unwind: '$course' },
    { $match: scopedLookupMatch('course', scope) },

    // University is a shared master collection.
    // It has no tenantId or instituteId, so do not apply scoped matching.
    {
      $lookup: {
        from: University.collection.name,
        localField: 'batch.universityId',
        foreignField: '_id',
        as: 'university',
      },
    },
    {
      $unwind: {
        path: '$university',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  // Filter by course.
  if (courseId) {
    pipeline.push({
      $match: {
        'batch.courseId': new mongoose.Types.ObjectId(courseId),
      },
    });
  }

  // Filter by document type.
  if (documentType) {
    pipeline.push({
      $match: { documentType },
    });
  }

  // Filter by inward batch received date.
  const receivedDateFilter = {};

  if (fromDate) {
    receivedDateFilter.$gte = fromDate;
  }

  if (toDate) {
    const endDate = new Date(toDate);
    endDate.setUTCHours(23, 59, 59, 999);
    receivedDateFilter.$lte = endDate;
  }

  if (Object.keys(receivedDateFilter).length) {
    pipeline.push({
      $match: {
        'batch.receivedDate': receivedDateFilter,
      },
    });
  }

  // Search student, course, university and batch information.
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');

    pipeline.push({
      $match: {
        $or: [
          { 'student.name': pattern },
          { 'student.scholarNo': pattern },
          { 'student.enrollmentNo': pattern },
          { 'student.rollNo': pattern },
          { 'course.name': pattern },
          { 'university.name': pattern },
          { documentType: pattern },
          { 'batch.referenceNumber': pattern },
          { 'batch.examTerm': pattern },
        ],
      },
    });
  }

  // Map allowed sort fields to database fields.
  const sortFields = {
    receivedDate: 'batch.receivedDate',
    followUpDate: 'missingDetails.followUpDate',
    createdAt: 'createdAt',
    documentType: 'documentType',
    studentName: 'student.name',
    scholarNo: 'student.scholarNo',
  };

  const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
  const sortDirection = sort.startsWith('-') ? -1 : 1;

  const sortOption = {
    [sortFields[sortField]]: sortDirection,
    _id: 1,
  };

  // Pagination and total count.
  pipeline.push({
    $facet: {
      rows: [
        { $sort: sortOption },
        { $skip: (page - 1) * limit },
        { $limit: limit },

        {
          $project: {
            _id: 1,
            status: 1,
            documentType: 1,

            reason: '$missingDetails.reason',
            otherReason: '$missingDetails.otherReason',
            followUpDate: '$missingDetails.followUpDate',

            student: {
              _id: '$student._id',
              name: '$student.name',
              scholarNo: '$student.scholarNo',
              enrollmentNo: '$student.enrollmentNo',
              branch: '$student.branch',
            },

            course: {
              _id: '$course._id',
              name: '$course.name',
              shortCode: '$course.shortCode',
              branch: '$course.branch',
            },

            university: {
              _id: '$university._id',
              name: '$university.name',
              shortCode: '$university.shortCode',
            },

            examTerm: '$batch.examTerm',
            examSession: '$batch.examSession',

            inwardBatch: {
              _id: '$batch._id',
              receivedDate: '$batch.receivedDate',
              referenceNumber: '$batch.referenceNumber',
            },
          },
        },
      ],

      metadata: [{ $count: 'total' }],
    },
  });

  const [result] = await InwardDocument.aggregate(pipeline);

  const rows = result?.rows ?? [];
  const total = result?.metadata?.[0]?.total ?? 0;

  return {
    rows,
    meta: {
      page,
      limit,
      total,
    },
  };
}

// API 2: PATCH follow-up details
export async function updateFollowUp(req, documentId, changes) {
  const document = await findScopedOr404(req, InwardDocument, documentId, ENTITY);

  if (document.status !== DOCUMENT_STATUSES.NOT_RECEIVED) {
    throw ApiError.conflict('Follow-up details can only be updated for Not received documents');
  }

  const before = document.toObject();

  if (!document.missingDetails) {
    document.missingDetails = {};
  }

  // Update reason independently.
  if (changes.reason !== undefined) {
    document.missingDetails.reason = changes.reason;

    document.missingDetails.otherReason = changes.reason === 'OTHER' ? changes.otherReason : '';
  }

  // Update follow-up date independently.
  if (changes.followUpDate !== undefined) {
    document.missingDetails.followUpDate = changes.followUpDate;
  }

  document.updatedBy = req.user.id;

  await document.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, document._id, before, document);

  return document;
}
