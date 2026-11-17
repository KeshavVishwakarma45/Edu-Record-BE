import { Student } from '../students/student.model.js';
import { Document } from './document.model.js';

import { ApiError } from '../../utils/ApiError.js';
import { scoped } from '../../utils/scoped.js';

import { DOCUMENT_STATUSES } from '../../constants/statuses.js';
import { save } from '../../utils/storage.js';
import { File } from '../files/file.model.js';
import { Handover } from './handover.model.js';

import { withTransaction } from '../../utils/transaction.js';
import { audit } from '../../utils/audit.js';

import { AUDIT_ACTIONS } from '../../constants/auditActions.js';

import { User } from '../users/user.model.js';

import { searchFilter, pageOptions } from '../../utils/listQuery.js';
export async function listStudentDocuments(req, studentId) {
  const filter = scoped(req);

  // Check whether student belongs to selected institute
  const student = await Student.findOne({
    ...filter,
    _id: studentId,
  })
    .select('_id')
    .lean();

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  // Fetch all documents belonging to this student
  const documents = await Document.find({
    ...filter,
    studentId: student._id,
  })
    .select('_id documentName documentType documentNumber issueDate status')
    .sort({ documentName: 1, _id: 1 })
    .lean();

  return {
    documents: documents.map((document) => ({
      documentId: String(document._id),
      documentName: document.documentName,
      documentType: document.documentType,
      documentNumber: document.documentNumber || null,
      issueDate: document.issueDate ? document.issueDate.toISOString().slice(0, 10) : null,
      status: document.status,
      isEligibleForHandover: document.status === DOCUMENT_STATUSES.IN_CUSTODY,
    })),
  };
}
export async function uploadSignature(req, studentId) {
  // Verify student belongs to selected institute
  const student = await Student.findOne({
    ...scoped(req),
    _id: studentId,
  })
    .select('_id')
    .lean();

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  // Save uploaded signature or receipt
  const file = await save(req, req.file);

  return {
    fileId: String(file._id),
    fileUrl: `/api/v1/files/${file._id}`,
    uploadedAt: file.createdAt.toISOString(),
  };
}
export async function uploadReceiverPhoto(req, studentId) {
  // Verify student belongs to selected institute
  const student = await Student.findOne({
    ...scoped(req),
    _id: studentId,
  })
    .select('_id')
    .lean();

  if (!student) {
    throw ApiError.notFound('Student not found');
  }

  // Save receiver photo
  const file = await save(req, req.file);

  return {
    fileId: String(file._id),
    fileUrl: `/api/v1/files/${file._id}`,
    uploadedAt: file.createdAt.toISOString(),
  };
}
export async function submitHandover(req, data) {
  const filter = scoped(req);

  return withTransaction(async (session) => {
    // 1. Verify student
    const student = await Student.findOne({
      ...filter,
      _id: data.studentId,
    })
      .select('_id')
      .session(session)
      .lean();

    if (!student) {
      throw ApiError.notFound('Student not found');
    }

    // 2. Verify receiver photo belongs to this institute
    const photo = await File.findOne({
      ...filter,
      _id: data.receiverPhotoId,
      mimeType: {
        $in: ['image/jpeg', 'image/png'],
      },
    })
      .select('_id')
      .session(session)
      .lean();

    if (!photo) {
      throw ApiError.badRequest('Receiver photo is invalid or does not belong to this institute');
    }

    // 3. Verify signed receipt belongs to this institute
    const receipt = await File.findOne({
      ...filter,
      _id: data.signedReceiptId,
      mimeType: {
        $in: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      },
    })
      .select('_id')
      .session(session)
      .lean();

    if (!receipt) {
      throw ApiError.badRequest('Signed receipt is invalid or does not belong to this institute');
    }

    // 4. Verify all selected documents
    const documents = await Document.find({
      ...filter,
      studentId: student._id,
      _id: { $in: data.documentIds },
      status: DOCUMENT_STATUSES.IN_CUSTODY,
    })
      .select('_id')
      .session(session)
      .lean();

    if (documents.length !== data.documentIds.length) {
      throw ApiError.conflict(
        'One or more selected documents are not in custody, do not belong to this student, or have already been issued',
      );
    }

    // 5. Generate handover timestamp on backend
    const handoverAt = new Date();

    // 6. Create handover record
    const [handover] = await Handover.create(
      [
        {
          ...data,
          ...filter,
          issuedBy: req.user.id,
          handoverAt,
          createdBy: req.user.id,
          updatedBy: req.user.id,
        },
      ],
      { session, ordered: true },
    );

    // 7. Automatically change document status to Issued
    const updateResult = await Document.updateMany(
      {
        ...filter,
        studentId: student._id,
        _id: { $in: data.documentIds },
        status: DOCUMENT_STATUSES.IN_CUSTODY,
      },
      {
        $set: {
          status: DOCUMENT_STATUSES.ISSUED,
          issuedAt: handoverAt,
          issuedBy: req.user.id,
          updatedBy: req.user.id,
        },
      },
      { session },
    );

    // Prevent partial or concurrent duplicate issuance
    if (updateResult.modifiedCount !== data.documentIds.length) {
      throw ApiError.conflict('Some documents are no longer available for handover');
    }

    // 8. Create audit entry in the same transaction
    await audit(req, AUDIT_ACTIONS.HANDOVER, 'handover', handover._id, null, handover, session);

    // 9. Prepare frontend response
    const timestamp = handoverAt.toISOString();

    return {
      handoverId: String(handover._id),
      studentId: String(student._id),
      documentIds: data.documentIds.map(String),
      receiverName: handover.receiverName,
      receiverType: handover.receiverType,
      handoverAt: timestamp,
      handoverDate: timestamp.slice(0, 10),
      handoverTime: timestamp.slice(11, 19),
      status: handover.status,
      message: 'Handover completed successfully',
    };
  });
}
export async function listHandoverHistory(req) {
  const { studentId, search, fromDate, toDate, page, limit } = req.query;

  const filter = { ...scoped(req) };

  // Filter by student ID
  if (studentId) {
    filter.studentId = studentId;
  }

  // Filter by date range
  const dateFilter = {};

  if (fromDate) {
    dateFilter.$gte = new Date(fromDate);
  }

  if (toDate) {
    const endDate = new Date(toDate);
    endDate.setUTCHours(23, 59, 59, 999);
    dateFilter.$lte = endDate;
  }

  if (Object.keys(dateFilter).length > 0) {
    filter.handoverAt = dateFilter;
  }

  // Search student name, enrollment number and receiver name
  if (search) {
    const matchingStudents = await Student.find({
      ...scoped(req),
      ...searchFilter(search, ['name', 'enrollmentNo']),
    })
      .select('_id')
      .lean();

    filter.$or = [
      {
        studentId: {
          $in: matchingStudents.map((student) => student._id),
        },
      },
      {
        receiverName: searchFilter(search, ['receiverName']).$or[0].receiverName,
      },
    ];
  }

  // Pagination
  const { skip } = pageOptions({ page, limit });

  const [handovers, total] = await Promise.all([
    Handover.find(filter)
      .select('_id studentId documentIds receiverName receiverType issuedBy handoverAt status')
      .sort({ handoverAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Handover.countDocuments(filter),
  ]);

  // Collect related IDs
  const studentIds = [...new Set(handovers.map((item) => String(item.studentId)))];

  const documentIds = [...new Set(handovers.flatMap((item) => item.documentIds.map(String)))];

  const staffIds = [...new Set(handovers.map((item) => String(item.issuedBy)))];

  // Fetch related information
  const [students, documents, staff] = await Promise.all([
    Student.find({
      ...scoped(req),
      _id: { $in: studentIds },
    })
      .select('name enrollmentNo')
      .lean(),

    Document.find({
      ...scoped(req),
      _id: { $in: documentIds },
    })
      .select('documentName')
      .lean(),

    User.find({
      tenantId: req.scope.tenantId,
      _id: { $in: staffIds },
    })
      .select('name')
      .lean(),
  ]);

  const studentMap = new Map(students.map((item) => [String(item._id), item]));

  const documentMap = new Map(documents.map((item) => [String(item._id), item]));

  const staffMap = new Map(staff.map((item) => [String(item._id), item]));

  // Prepare response
  const rows = handovers.map((handover) => {
    const student = studentMap.get(String(handover.studentId));
    const issuer = staffMap.get(String(handover.issuedBy));

    const timestamp = handover.handoverAt.toISOString();

    return {
      handoverId: String(handover._id),
      studentId: String(handover.studentId),
      studentName: student?.name ?? null,
      enrollmentNumber: student?.enrollmentNo ?? null,

      documents: handover.documentIds.map((id) => ({
        documentId: String(id),
        documentName: documentMap.get(String(id))?.documentName ?? null,
      })),

      receiverName: handover.receiverName,
      receiverType: handover.receiverType,

      issuingStaffId: String(handover.issuedBy),
      issuingStaffName: issuer?.name ?? null,

      handoverAt: timestamp,
      handoverDate: timestamp.slice(0, 10),
      handoverTime: timestamp.slice(11, 19),

      status: handover.status,
    };
  });

  return {
    rows,
    meta: {
      page,
      limit,
      total,
    },
  };
}
