import { InwardBatch, InwardDocument } from './inward.model.js';
import { Student } from '../students/student.model.js';
import { Course } from '../courses/course.model.js';
import { Affiliation } from '../institutes/affiliation.model.js';
import { File } from '../files/file.model.js';

import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { DOCUMENT_STATUSES } from '../../constants/statuses.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';
import { withTransaction } from '../../utils/transaction.js';

const ENTITY = 'inward document';

const DOCUMENT_ENTITY = 'inward document';

// API 5: Get all students and their current document status
export async function getStudents(req, id) {
  const batch = await findScopedOr404(req, InwardBatch, id, 'inward batch');

  return InwardDocument.find({
    ...scoped(req),
    batchId: batch._id,
  })
    .populate({
      path: 'studentId',
      select: 'scholarNo enrollmentNo rollNo name fatherName courseId branch batch status',
      match: scoped(req),
    })
    .sort({ createdAt: 1 })
    .lean();
}

// API 6: Receive an expected document
export async function createReceipt(req, batchId, data) {
  const batch = await findScopedOr404(req, InwardBatch, batchId, 'inward batch');

  const updateFields = {
    status: DOCUMENT_STATUSES.IN_CUSTODY,
    receivedBy: req.user.id,
    custodyDate: new Date(),
    updatedBy: req.user.id,
  };

  if (data.documentSerialNo !== undefined) {
    updateFields.documentSerialNo = data.documentSerialNo;
  }

  if (data.storageLocation) {
    updateFields.storageLocation = {
      almirah: data.storageLocation.almirah ?? '',
      fileNo: data.storageLocation.fileNo ?? '',
    };
  }

  // Atomic status check and update to prevent race conditions (INW-4 / SEC-17)
  const document = await InwardDocument.findOneAndUpdate(
    {
      ...scoped(req),
      batchId: batch._id,
      studentId: data.studentId,
      documentType: batch.documentType,
      status: DOCUMENT_STATUSES.EXPECTED,
    },
    {
      $set: updateFields,
    },
    {
      returnDocument: 'before',
    },
  );

  if (!document) {
    const existing = await InwardDocument.findOne({
      ...scoped(req),
      batchId: batch._id,
      studentId: data.studentId,
      documentType: batch.documentType,
    });
    if (!existing) {
      throw ApiError.notFound('Expected student document not found');
    }
    throw ApiError.conflict('This document is not in Expected status');
  }

  const before = document.toObject();
  const after = {
    ...before,
    ...updateFields,
  };

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, document._id, before, after);

  return InwardDocument.findOne({
    ...scoped(req),
    _id: document._id,
  }).lean();
}

// API 7: Update received document details
export async function updateReceipt(req, batchId, receiptId, changes) {
  const batch = await findScopedOr404(req, InwardBatch, batchId, 'inward batch');

  const receipt = await InwardDocument.findOne({
    ...scoped(req),
    _id: receiptId,
    batchId: batch._id,
  });

  if (!receipt) {
    throw ApiError.notFound('Receipt not found');
  }

  if (receipt.status !== DOCUMENT_STATUSES.IN_CUSTODY) {
    throw ApiError.conflict('Only received documents can be updated');
  }

  const before = receipt.toObject();

  if (changes.documentSerialNo !== undefined) {
    receipt.documentSerialNo = changes.documentSerialNo;
  }

  if (changes.storageLocation) {
    receipt.storageLocation = {
      almirah: changes.storageLocation.almirah ?? receipt.storageLocation?.almirah ?? '',
      fileNo: changes.storageLocation.fileNo ?? receipt.storageLocation?.fileNo ?? '',
    };
  }

  receipt.updatedBy = req.user.id;
  await receipt.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, receipt._id, before, receipt);

  return receipt;
}

// API 8: Receive a previously missing document in a later batch
export async function receiveMissing(req, newBatchId, missingId, data) {
  const newBatch = await findScopedOr404(req, InwardBatch, newBatchId, 'inward batch');

  const document = await findScopedOr404(req, InwardDocument, missingId, ENTITY);

  if (document.status !== DOCUMENT_STATUSES.NOT_RECEIVED) {
    throw ApiError.conflict('This document is not marked as missing');
  }

  if (document.documentType !== newBatch.documentType) {
    throw ApiError.badRequest('Document type does not match the new inward batch');
  }

  const before = document.toObject();

  document.status = DOCUMENT_STATUSES.IN_CUSTODY;
  document.receivedInBatchId = newBatch._id;
  document.receivedBy = req.user.id;
  document.custodyDate = new Date();

  if (!document.missingDetails) {
    document.missingDetails = {};
  }

  if (data.documentSerialNo !== undefined) {
    document.documentSerialNo = data.documentSerialNo;
  }

  if (data.storageLocation) {
    document.storageLocation = {
      almirah: data.storageLocation.almirah ?? '',
      fileNo: data.storageLocation.fileNo ?? '',
    };
  }

  await document.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, document._id, before, document);

  return document;
}

// API 11: Update missing document details

export async function updateMissing(req, batchId, missingId, changes) {
  const batch = await findScopedOr404(req, InwardBatch, batchId, 'inward batch');

  const document = await InwardDocument.findOne({
    ...scoped(req),
    _id: missingId,
    batchId: batch._id,
  });

  if (!document) {
    throw ApiError.notFound('Document not found in this batch');
  }

  if (
    document.status !== DOCUMENT_STATUSES.EXPECTED &&
    document.status !== DOCUMENT_STATUSES.NOT_RECEIVED
  ) {
    throw ApiError.conflict('Only Expected or already missing documents can be updated');
  }

  const before = document.toObject();

  const reason = changes.reason ?? document.missingDetails?.reason;
  const followUpDate = changes.followUpDate ?? document.missingDetails?.followUpDate;
  const otherReason = changes.otherReason ?? document.missingDetails?.otherReason ?? '';

  if (!reason || !followUpDate) {
    throw ApiError.badRequest('Reason and follow-up date are required');
  }

  if (reason === 'OTHER' && !otherReason.trim()) {
    throw ApiError.badRequest('Please provide otherReason when reason is OTHER');
  }

  document.missingDetails = {
    reason,
    otherReason: reason === 'OTHER' ? otherReason : '',
    followUpDate,
  };

  document.status = DOCUMENT_STATUSES.NOT_RECEIVED;
  document.updatedBy = req.user.id;

  await document.save();

  await audit(req, AUDIT_ACTIONS.UPDATE, ENTITY, document._id, before, document);

  return document;
}

// API 12: Get all pending/missing documents
export async function getPending(req) {
  const { search, sort, page, limit } = req.query;

  const filter = {
    ...scoped(req),
    status: DOCUMENT_STATUSES.NOT_RECEIVED,
    ...searchFilter(search, ['documentType', 'documentSerialNo', 'missingDetails.reason']),
  };

  const { skip } = pageOptions(req.query);

  const [rows, total] = await Promise.all([
    InwardDocument.find(filter)
      .populate({
        path: 'studentId',
        select: 'scholarNo enrollmentNo rollNo name fatherName courseId branch batch',
        match: { tenantId: req.scope.tenantId },
      })
      .populate({
        path: 'batchId',
        select: 'examTerm examSession documentType receivedDate referenceNumber',
        match: { tenantId: req.scope.tenantId },
      })
      .sort(sortOption(sort))
      .skip(skip)
      .limit(limit)
      .lean(),

    InwardDocument.countDocuments(filter),
  ]);

  return {
    rows,
    meta: { page, limit, total },
  };
}
// GET all inward batches
export async function list(req) {
  const { search, sort, page, limit } = req.query;

  const filter = {
    ...scoped(req),
    ...searchFilter(search, ['examTerm', 'referenceNumber']),
  };

  const { skip } = pageOptions(req.query);

  const [rows, total] = await Promise.all([
    InwardBatch.find(filter)
      .populate('universityId', 'name shortCode')
      .populate({
        path: 'receivedBy',
        select: 'name',
        match: { tenantId: req.scope.tenantId },
      })
      .sort(sortOption(sort))
      .skip(skip)
      .limit(limit)
      .lean(),

    InwardBatch.countDocuments(filter),
  ]);

  return {
    rows,
    meta: { page, limit, total },
  };
}

// GET one inward batch by ID
export async function getById(req, id) {
  const batch = await findScopedOr404(req, InwardBatch, id, 'inward batch');

  return InwardBatch.populate(batch, [
    { path: 'universityId', select: 'name shortCode' },
    {
      path: 'receivedBy',
      select: 'name',
      match: { tenantId: req.scope.tenantId },
    },
  ]);
}

// POST create a new inward batch
export async function create(req, data) {
  // 1. INW-3: Validate Course belongs to current institute
  const course = await Course.findOne({
    ...scoped(req),
    _id: data.courseId,
  }).lean();

  if (!course) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'courseId', message: 'Choose a course of this institute' },
    ]);
  }

  // 2. INW-3: Validate University is affiliated with this institute
  const affiliation = await Affiliation.findOne({
    ...scoped(req),
    universityId: data.universityId,
  }).lean();

  if (!affiliation) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'universityId', message: 'Choose a university affiliated with this institute' },
    ]);
  }

  // Verify course belongs to this university affiliation
  if (String(course.affiliationId) !== String(affiliation._id)) {
    throw ApiError.badRequest('Please correct the highlighted fields', [
      { field: 'universityId', message: 'Course does not belong to this university' },
    ]);
  }

  // 3. INW-3: If coveringLetterFileId is passed, verify it belongs to this institute
  if (data.coveringLetterFileId) {
    const fileExists = await File.exists({
      ...scoped(req),
      _id: data.coveringLetterFileId,
    });
    if (!fileExists) {
      throw ApiError.badRequest('Please correct the highlighted fields', [
        { field: 'coveringLetterFileId', message: 'Choose a file of this institute' },
      ]);
    }
  }

  // 4. INW-1 & INW-2: Create Batch, Expected Documents and Audit atomically in a transaction
  const createdBatch = await withTransaction(async (session) => {
    // a. Create the inward batch document
    const [batch] = await InwardBatch.create(
      [
        {
          ...data,
          receivedBy: req.user.id,
          createdBy: req.user.id,
          updatedBy: req.user.id,
          ...scoped(req), // scoped spread last so body cannot override tenant/institute
        },
      ],
      { session },
    );

    // b. INW-1: Find eligible students for this batch's course & university
    const students = await Student.find({
      ...scoped(req),
      courseId: data.courseId,
      universityId: data.universityId,
      deletedAt: null,
    })
      .select('_id')
      .session(session)
      .lean();

    // c. INW-1: Create an InwardDocument with status 'Expected' for each student
    if (students.length > 0) {
      const documentRows = students.map((s) => ({
        batchId: batch._id,
        studentId: s._id,
        documentType: batch.documentType,
        status: DOCUMENT_STATUSES.EXPECTED,
        createdBy: req.user.id,
        updatedBy: req.user.id,
        ...scoped(req),
      }));

      // Ordered: true as required by Mongoose inside transaction
      await InwardDocument.create(documentRows, { session, ordered: true });
    }

    // d. INW-2: Audit log for batch creation
    await audit(req, AUDIT_ACTIONS.CREATE, 'inward batch', batch._id, null, batch, session);

    return batch;
  });

  // 5. Return populated batch
  return InwardBatch.findOne({
    _id: createdBatch._id,
    ...scoped(req),
  })
    .populate('universityId', 'name shortCode')
    .populate({
      path: 'receivedBy',
      select: 'name',
      match: { tenantId: req.scope.tenantId },
    })
    .lean();
}

// GET inward batch document counts (INW-7: aggregate + $group by status)
export async function getCounts(req, id) {
  const batch = await findScopedOr404(req, InwardBatch, id, 'inward batch');

  const countsByStatus = await InwardDocument.aggregate([
    {
      $match: {
        ...scoped(req),
        batchId: batch._id,
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const map = Object.fromEntries(countsByStatus.map((c) => [c._id, c.count]));

  const expected = map[DOCUMENT_STATUSES.EXPECTED] || 0;
  const received = map[DOCUMENT_STATUSES.IN_CUSTODY] || 0;
  const missing = map[DOCUMENT_STATUSES.NOT_RECEIVED] || 0;
  const issued = map[DOCUMENT_STATUSES.ISSUED] || 0;
  const returnedToUniversity = map[DOCUMENT_STATUSES.RETURNED_TO_UNIVERSITY] || 0;
  const cancelled = map[DOCUMENT_STATUSES.CANCELLED] || 0;
  const total = expected + received + missing + issued + returnedToUniversity + cancelled;

  return {
    expected,
    received,
    missing,
    issued,
    returnedToUniversity,
    cancelled,
    total,
  };
}

// POST mark an existing Expected document as missing
export async function markDocumentMissing(req, batchId, data) {
  // 1. Find the batch inside the selected institute
  const batch = await findScopedOr404(req, InwardBatch, batchId, 'inward batch');

  // 2. SEC-19: Find the student using findScopedOr404 to ensure access-denied is audited
  const student = await findScopedOr404(req, Student, data.studentId, 'student');

  // 3. Verify student's course and university match the batch
  if (
    student.courseId.toString() !== batch.courseId.toString() ||
    student.universityId.toString() !== batch.universityId.toString()
  ) {
    throw ApiError.badRequest('Student does not belong to this batch');
  }

  const updateFields = {
    status: DOCUMENT_STATUSES.NOT_RECEIVED,
    missingDetails: {
      reason: data.reason,
      otherReason: data.reason === 'OTHER' ? data.otherReason : '',
      followUpDate: data.followUpDate,
    },
    updatedBy: req.user.id,
  };

  // 4. INW-4 / SEC-17: Atomic findOneAndUpdate to prevent status change race condition
  const document = await InwardDocument.findOneAndUpdate(
    {
      ...scoped(req),
      batchId: batch._id,
      studentId: student._id,
      documentType: batch.documentType,
      status: DOCUMENT_STATUSES.EXPECTED,
    },
    {
      $set: updateFields,
    },
    {
      returnDocument: 'before',
    },
  );

  if (!document) {
    const existing = await InwardDocument.findOne({
      ...scoped(req),
      batchId: batch._id,
      studentId: student._id,
      documentType: batch.documentType,
    });
    if (!existing) {
      throw ApiError.notFound('Expected document record not found');
    }
    throw ApiError.conflict(
      `Document cannot be marked missing because its current status is ${existing.status}`,
    );
  }

  const before = document.toObject();
  const after = {
    ...before,
    ...updateFields,
  };

  // 5. Write audit log
  await audit(req, AUDIT_ACTIONS.UPDATE, DOCUMENT_ENTITY, document._id, before, after);

  // 6. Return updated document with student details
  return InwardDocument.findOne({
    ...scoped(req),
    _id: document._id,
  })
    .populate({
      path: 'studentId',
      select: 'name rollNo scholarNo enrollmentNo',
      match: { tenantId: req.scope.tenantId },
    })
    .lean();
}

// GET all missing documents for an inward batch
export async function getMissingDocuments(req, batchId) {
  // 1. Verify batch exists inside the selected institute
  await findScopedOr404(req, InwardBatch, batchId, 'inward batch');

  // 2. Find documents whose status is Not received
  const rows = await InwardDocument.find({
    ...scoped(req),
    batchId,
    status: DOCUMENT_STATUSES.NOT_RECEIVED,
  })
    .populate({
      path: 'studentId',
      select: 'name rollNo scholarNo enrollmentNo',
      match: { tenantId: req.scope.tenantId },
    })
    .sort({ createdAt: -1 })
    .lean();

  return { rows };
}
