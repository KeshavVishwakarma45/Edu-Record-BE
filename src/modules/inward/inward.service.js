import { InwardBatch, InwardDocument } from './inward.model.js';
import { scoped } from '../../utils/scoped.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../../utils/audit.js';
import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { DOCUMENT_STATUSES } from '../../constants/statuses.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';

const ENTITY = 'inward document';

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

  const document = await InwardDocument.findOne({
    ...scoped(req),
    batchId: batch._id,
    studentId: data.studentId,
    documentType: batch.documentType,
  });

  if (!document) {
    throw ApiError.notFound('Expected student document not found');
  }

  if (document.status !== DOCUMENT_STATUSES.EXPECTED) {
    throw ApiError.conflict('This document is not in Expected status');
  }

  const before = document.toObject();

  document.status = DOCUMENT_STATUSES.IN_CUSTODY;
  document.receivedBy = req.user.id;
  document.custodyDate = new Date();

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
