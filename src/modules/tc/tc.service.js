import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { TC } from './tc.model.js';
import { Student } from '../students/student.model.js';
import { Course } from '../courses/course.model.js';
import { Institute } from '../institutes/institute.model.js';
import { Department } from '../institutes/department.model.js';
import { University } from '../institutes/university.model.js';
import { ClearanceApplication } from '../clearance/clearanceApplication.model.js';
import { AuditLog } from '../audit/auditLog.model.js';

import { ApiError } from '../../utils/ApiError.js';
import { scoped } from '../../utils/scoped.js';
import { audit } from '../../utils/audit.js';
import { withTransaction } from '../../utils/transaction.js';
import { nextNumber } from '../../utils/counter.js';
import * as storage from '../../utils/storage.js';
import { searchFilter, sortOption, pageOptions } from '../../utils/listQuery.js';

import { AUDIT_ACTIONS } from '../../constants/auditActions.js';
import { STUDENT_STATUSES } from '../../constants/statuses.js';

import { validateMandatoryClearances } from '../clearance/clearance.service.js';

const ENTITY = 'tc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

function getActorId(req) {
  return req.user?.id;
}

function getClearanceApplicationId(tc) {
  if (!tc.clearanceApplicationId) {
    throw ApiError.badRequest('Clearance application is not linked with this TC');
  }

  return tc.clearanceApplicationId;
}

async function checkMandatoryClearances(req, tc) {
  const result = await validateMandatoryClearances(
    req,
    tc.studentId,
    getClearanceApplicationId(tc),
  );

  if (!result.isEligibleForTCSubmission) {
    throw ApiError.conflict(
      'TC cannot proceed because mandatory department clearances are incomplete',
      {
        incompleteDepartments: result.incompleteDepartments,
      },
    );
  }

  return result;
}

async function findTc(req, id, session = null) {
  // Normal requests use the scoped helper so cross-institute
  // access attempts are recorded in the audit log.
  if (!session) {
    return findScopedOr404(req, TC, id, 'tc');
  }

  // Preserve the existing transaction session for transactional operations.
  const tc = await TC.findOne({
    ...scoped(req),
    _id: id,
  }).session(session);

  if (!tc) {
    // Log cross-institute access using the shared scoped helper.
    // A genuinely non-existent ID will still return 404 without an audit entry.
    await findScopedOr404(req, TC, id, 'tc');
  }

  return tc;
}

function getAuditAction(actionName) {
  const action = AUDIT_ACTIONS[actionName];

  if (!action) {
    throw new Error(`Missing audit action: ${actionName}. Add it to auditActions.js`);
  }

  return action;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function buildPdfData(snapshot) {
  const institute = snapshot.institute ?? {};
  const student = snapshot.student ?? {};
  const course = snapshot.course ?? {};
  const tc = snapshot.tc ?? {};
  const numbering = snapshot.numbering ?? {};

  return {
    instituteName: institute.name,
    instituteAddress: institute.address,
    instituteShortCode: institute.shortCode,
    principalName: institute.principalName,

    studentName: student.name,
    fatherName: student.fatherName,
    motherName: student.motherName,

    enrollmentNo: student.enrollmentNo,
    scholarNo: student.scholarNo,
    rollNo: student.rollNo,

    dob: formatDate(student.dob),
    admissionDate: formatDate(student.admissionDate),

    courseName: course.name,
    branch: student.branch || course.branch,

    reasonForLeaving: tc.reasonForLeaving,
    conduct: tc.conduct,

    refNo: numbering.refNo,
    bookSerial: numbering.bookSerial,

    approvedAt: formatDate(snapshot.approvedAt),
  };
}

function replaceTemplateValues(html, data) {
  let output = html;

  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');

    output = output.replace(placeholder, escapeHtml(value));
  }

  return output;
}

// --------------------------------------------------
// 1. SUBMIT TC FOR PRINCIPAL APPROVAL
// POST /api/v1/tcs/:id/submit
// --------------------------------------------------

export async function submit(req, id) {
  const tc = await findTc(req, id);

  if (tc.status !== 'draft') {
    throw ApiError.conflict('Only draft TC can be submitted for approval');
  }

  if (!tc.reasonForLeaving?.trim()) {
    throw ApiError.badRequest('Reason for leaving is required');
  }

  if (!tc.conduct?.trim()) {
    throw ApiError.badRequest('Conduct is required');
  }

  // Check student exists in the current institute.
  const student = await Student.findOne({
    ...scoped(req),
    _id: tc.studentId,
  });

  if (!student) {
    throw ApiError.notFound('Student associated with this TC was not found');
  }

  // Recheck all mandatory department clearances.
  await checkMandatoryClearances(req, tc);

  const before = tc.toObject();

  tc.status = 'pending_approval';
  tc.submittedBy = getActorId(req);
  tc.submittedAt = new Date();
  tc.updatedBy = getActorId(req);

  await tc.save();

  await audit(req, getAuditAction('TC_SUBMITTED'), ENTITY, tc._id, before, tc);

  return tc;
}

// --------------------------------------------------
// 2. PRINCIPAL APPROVAL
// POST /api/v1/tcs/:id/approve
// --------------------------------------------------

export async function approve(req, id) {
  // Recheck clearance before approval.
  // The validator uses the existing clearance service.
  const tcForClearance = await findTc(req, id);

  if (!['pending_approval', 'submitted'].includes(tcForClearance.status)) {
    throw ApiError.conflict('Only submitted TC can be approved');
  }

  await checkMandatoryClearances(req, tcForClearance);

  return withTransaction(async (session) => {
    const tc = await findTc(req, id, session);

    if (!['pending_approval', 'submitted'].includes(tc.status)) {
      throw ApiError.conflict('TC has already been processed or is not pending approval');
    }

    const student = await Student.findOne({
      ...scoped(req),
      _id: tc.studentId,
    }).session(session);

    if (!student) {
      throw ApiError.notFound('Student associated with this TC was not found');
    }

    const course = await Course.findOne({
      ...scoped(req),
      _id: student.courseId,
    }).session(session);

    if (!course) {
      throw ApiError.notFound('Student course was not found');
    }

    if (!course.shortCode?.trim()) {
      throw ApiError.badRequest('Course short code is missing');
    }

    const institute = await Institute.findOne({
      tenantId: req.scope.tenantId,
      _id: req.scope.instituteId,
    }).session(session);

    if (!institute) {
      throw ApiError.notFound('Institute not found');
    }

    if (!institute.shortCode?.trim()) {
      throw ApiError.badRequest('Institute short code is missing');
    }

    // Allocate course-wise reference number.
    const refNumber = await nextNumber(req, {
      kind: 'ref',
      courseShortCode: course.shortCode,
      year: null,
      session,
    });

    // Allocate institute-wide book serial.
    const serialNumber = await nextNumber(req, {
      kind: 'serial',
      year: null,
      session,
    });

    const currentYear = new Date().getFullYear();

    const refNo = `${institute.shortCode}/TC/${currentYear}/` + `${course.shortCode}/${refNumber}`;

    const bookSerial = String(serialNumber);
    const approvedAt = new Date();

    const snapshot = {
      institute: {
        name: institute.name,
        shortCode: institute.shortCode,
        address: institute.address,
        principalName: institute.principalName,
      },

      student: student.toObject(),

      course: course.toObject(),

      tc: {
        reasonForLeaving: tc.reasonForLeaving,
        conduct: tc.conduct,
      },

      numbering: {
        refNo,
        bookSerial,
      },

      approvedAt,
    };

    const before = tc.toObject();

    // Conditional update prevents duplicate approval.
    const approvedTc = await TC.findOneAndUpdate(
      {
        ...scoped(req),
        _id: id,
        status: tc.status,
      },
      {
        $set: {
          status: 'approved',
          refNo,
          bookSerial,
          snapshot,
          approvedBy: getActorId(req),
          approvedAt,
          updatedBy: getActorId(req),
        },
      },
      {
        session,
        returnDocument: 'after',
        runValidators: true,
      },
    );

    if (!approvedTc) {
      throw ApiError.conflict('TC approval failed because its status changed');
    }

    await audit(
      req,
      getAuditAction('TC_APPROVED'),
      ENTITY,
      approvedTc._id,
      before,
      approvedTc,
      session,
    );

    return approvedTc;
  });
}

// --------------------------------------------------
// 3. PRINCIPAL REJECTION
// POST /api/v1/tcs/:id/reject
// --------------------------------------------------

export async function reject(req, id) {
  const rejectionReason = req.body?.rejectionReason?.trim();

  if (!rejectionReason) {
    throw ApiError.badRequest('Rejection reason is required');
  }

  return withTransaction(async (session) => {
    const tc = await findTc(req, id, session);

    if (!['pending_approval', 'submitted'].includes(tc.status)) {
      throw ApiError.conflict('Only pending TC can be rejected');
    }

    const before = tc.toObject();
    const rejectedAt = new Date();

    const rejectedTc = await TC.findOneAndUpdate(
      {
        ...scoped(req),
        _id: id,
        status: tc.status,
      },
      {
        $set: {
          status: 'rejected',
          rejectionReason,
          rejectedBy: getActorId(req),
          rejectedAt,
          updatedBy: getActorId(req),
        },
      },
      {
        session,
        returnDocument: 'after',
        runValidators: true,
      },
    );

    if (!rejectedTc) {
      throw ApiError.conflict('TC rejection failed because its status changed');
    }

    await audit(
      req,
      getAuditAction('TC_REJECTED'),
      ENTITY,
      rejectedTc._id,
      before,
      rejectedTc,
      session,
    );

    return rejectedTc;
  });
}

// --------------------------------------------------
// 4. GENERATE TC PDF
// GET /api/v1/tcs/:id/pdf
// --------------------------------------------------

export async function generatePdf(req, id) {
  const tc = await findTc(req, id);

  if (!['approved', 'issued'].includes(tc.status)) {
    throw ApiError.conflict('PDF can only be generated for approved or issued TC');
  }

  if (!tc.snapshot) {
    throw ApiError.conflict('Approved TC snapshot is not available');
  }

  const snapshot = tc.snapshot;
  const shortCode = snapshot.institute?.shortCode;

  let templateName;

  if (shortCode === 'SSISM') {
    templateName = 'tc-ssism.html';
  } else if (shortCode === 'SSEC') {
    templateName = 'tc-ssec.html';
  } else {
    throw ApiError.badRequest('No TC PDF template is configured for this institute');
  }

  const templatePath = path.join(__dirname, '../../templates', templateName);

  let html;

  try {
    html = await fs.readFile(templatePath, 'utf8');
  } catch {
    throw ApiError.conflict(`TC PDF template not found: ${templateName}`);
  }

  const pdfData = buildPdfData(snapshot);
  const finalHtml = replaceTemplateValues(html, pdfData);

  // Puppeteer is loaded only when PDF is requested.
  let puppeteer;

  try {
    const module = await import('puppeteer');
    puppeteer = module.default;
  } catch {
    throw ApiError.conflict('Puppeteer is not installed. Install it before generating TC PDF.');
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let pdfBuffer;

  try {
    const page = await browser.newPage();

    await page.setContent(finalHtml, {
      waitUntil: 'networkidle0',
    });

    pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '8mm',
        right: '8mm',
        bottom: '8mm',
        left: '8mm',
      },
    });
  } finally {
    await browser.close();
  }

  await audit(req, getAuditAction('TC_PDF_GENERATED'), ENTITY, tc._id, null, {
    status: tc.status,
    refNo: tc.refNo,
    generatedAt: new Date(),
  });

  return pdfBuffer;
}

// --------------------------------------------------
// 5. FINAL TC HANDOVER / ISSUE
// POST /api/v1/tcs/:id/issue
// --------------------------------------------------

export async function issue(req, id) {
  const handoverPhoto = req.files?.handoverPhoto?.[0];
  const receiverSignature = req.files?.receiverSignature?.[0];

  if (!handoverPhoto || !receiverSignature) {
    throw ApiError.badRequest('Handover photo and receiver signature are required');
  }

  const receivedBy = req.body?.receivedBy?.trim();

  if (!receivedBy) {
    throw ApiError.badRequest('Receiver name is required');
  }

  const existingTc = await findTc(req, id);

  if (existingTc.status !== 'approved') {
    throw ApiError.conflict('Only approved TC can be issued');
  }

  if (!existingTc.refNo || !existingTc.bookSerial) {
    throw ApiError.badRequest('TC reference number or book serial is missing');
  }

  let savedHandoverPhoto = null;
  let savedReceiverSignature = null;

  try {
    // Save files outside the transaction.
    // If DB transaction fails, remove these files in catch.
    savedHandoverPhoto = await storage.save(req, handoverPhoto);

    savedReceiverSignature = await storage.save(req, receiverSignature);

    const result = await withTransaction(async (session) => {
      const tc = await findTc(req, id, session);

      if (tc.status !== 'approved') {
        throw ApiError.conflict('TC has already been issued or is not approved');
      }

      const student = await Student.findOne({
        ...scoped(req),
        _id: tc.studentId,
      }).session(session);

      if (!student) {
        throw ApiError.notFound('Student not found');
      }

      const issuedAt = new Date();
      const before = tc.toObject();

      const issuedTc = await TC.findOneAndUpdate(
        {
          ...scoped(req),
          _id: id,
          status: 'approved',
        },
        {
          $set: {
            status: 'issued',
            handoverPhoto: savedHandoverPhoto._id,
            receiverSignature: savedReceiverSignature._id,
            receivedBy,
            issuedBy: getActorId(req),
            issuedAt,
            updatedBy: getActorId(req),
          },
        },
        {
          session,
          returnDocument: 'after',
          runValidators: true,
        },
      );

      if (!issuedTc) {
        throw ApiError.conflict('TC could not be issued because its status changed');
      }

      const studentBefore = student.toObject();

      // Update Student Master in the same transaction.
      student.status = STUDENT_STATUSES.TC_ISSUED;
      student.tcRefNo = tc.refNo;
      student.tcBookSerial = tc.bookSerial;
      student.tcIssuedAt = issuedAt;
      student.updatedBy = getActorId(req);

      await student.save({ session });

      await audit(
        req,
        getAuditAction('TC_ISSUED'),
        ENTITY,
        issuedTc._id,
        before,
        issuedTc,
        session,
      );

      // Student update audit record.
      await audit(
        req,
        AUDIT_ACTIONS.UPDATE,
        'student',
        student._id,
        studentBefore,
        student,
        session,
      );

      return {
        tc: issuedTc,
        student: {
          _id: student._id,
          name: student.name,
          status: student.status,
          tcRefNo: student.tcRefNo,
          tcBookSerial: student.tcBookSerial,
          tcIssuedAt: student.tcIssuedAt,
        },
      };
    });

    return result;
  } catch (error) {
    // Clean up saved files if the transaction fails.
    if (savedReceiverSignature) {
      await storage.remove(savedReceiverSignature).catch(() => {});
    }

    if (savedHandoverPhoto) {
      await storage.remove(savedHandoverPhoto).catch(() => {});
    }

    throw error;
  }
}

// --------------------------------------------------
// 6. TC HISTORY
// GET /api/v1/tcs/:id/history
// --------------------------------------------------

export async function history(req, id) {
  const tc = await findTc(req, id);

  const logs = await AuditLog.find({
    ...scoped(req),
    entity: ENTITY,
    entityId: tc._id,
  })
    .populate({
      path: 'userId',
      select: 'name email',
      match: { tenantId: req.scope.tenantId },
    })
    .sort({ at: 1 })
    .lean();

  return logs.map((log) => ({
    action: log.action,

    performedBy: log.userId
      ? {
          id: log.userId._id,
          name: log.userId.name,
          email: log.userId.email,
        }
      : null,

    timestamp: log.at,

    details: {
      before: log.before
        ? {
            status: log.before.status ?? null,
          }
        : null,

      after: log.after
        ? {
            status: log.after.status ?? null,
            rejectionReason: log.after.rejectionReason ?? null,
            refNo: log.after.refNo ?? null,
            bookSerial: log.after.bookSerial ?? null,
            receivedBy: log.after.receivedBy ?? null,
          }
        : null,
    },
  }));
}

// -------------------------------------------------------------------
// Draft creation, preview, listing and retrieval APIs
// -------------------------------------------------------------------

export async function checkEligibility(req, studentId) {
  // 1. Fetch student within the current tenant and institute scope.
  const student = await Student.findOne({ ...scoped(req), _id: studentId });
  if (!student) throw ApiError.notFound('Student not found');
  if (student.deletedAt) {
    throw ApiError.notFound('Student not found');
  }

  // 2. Fetch mandatory departments from the database.
  const mandatoryDepartments = await Department.find({
    ...scoped(req),
    mandatory: true,
  })
    .sort({ order: 1, name: 1 })
    .lean();

  // 3. Find latest clearance application for this student.
  const application = await ClearanceApplication.findOne({
    ...scoped(req),
    studentId: student._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!application) {
    return {
      studentId: student._id,
      eligible: false,
      eligibilityStatus: 'no_clearance_application',
      pending: mandatoryDepartments.map((dept) => ({
        departmentId: dept._id,
        departmentName: dept.name,
        status: 'MISSING',
        isClear: false,
      })),
      mandatoryDepartments: mandatoryDepartments.map((dept) => ({
        departmentId: dept._id,
        departmentName: dept.name,
        status: 'MISSING',
        isClear: false,
      })),
      clearanceCheckAvailable: true,
      clearanceApplicationId: null,
    };
  }

  // 4. Validate mandatory clearances via Clearance module.
  const validation = await validateMandatoryClearances(req, student._id, application._id);

  return {
    studentId: student._id,
    eligible: validation.isEligibleForTCSubmission,
    eligibilityStatus: validation.isEligibleForTCSubmission ? 'eligible' : 'pending',
    pending: validation.incompleteDepartments,
    mandatoryDepartments: validation.mandatoryDepartments,
    clearanceCheckAvailable: true,
    clearanceApplicationId: application._id,
  };
}

// -------------------------------------------------------------------
// getTCData(req, studentId)
// Fetches student, course, university and clearance details for TC preview (TC-02, BR-12).
// -------------------------------------------------------------------

export async function getTCData(req, studentId) {
  // 1. Fetch student within current institute scope.
  const student = await Student.findOne({ ...scoped(req), _id: studentId });
  if (!student) throw ApiError.notFound('Student not found');
  if (student.deletedAt) {
    throw ApiError.notFound('Student not found');
  }

  // 2. Fetch the student's course within the same scope.
  const course = await Course.findOne({
    ...scoped(req),
    _id: student.courseId,
  }).lean();

  // 3. Fetch university for enrollment label (BR-12).
  const university = student.universityId
    ? await University.findById(student.universityId)
        .select('name shortCode enrollmentLabel')
        .lean()
    : null;

  // 4. Fetch latest clearance application and summary if available.
  const latestApp = await ClearanceApplication.findOne({
    ...scoped(req),
    studentId: student._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  let clearanceSummary = null;
  const clearanceCheckAvailable = true;

  if (latestApp) {
    const clearanceValidation = await validateMandatoryClearances(req, student._id, latestApp._id);
    clearanceSummary = {
      applicationId: latestApp._id,
      isEligible: clearanceValidation.isEligibleForTCSubmission,
      mandatoryDepartments: clearanceValidation.mandatoryDepartments,
      incompleteDepartments: clearanceValidation.incompleteDepartments,
    };
  } else {
    clearanceSummary = {
      applicationId: null,
      isEligible: false,
      mandatoryDepartments: [],
      incompleteDepartments: [],
    };
  }

  // 5. Return combined TC preview data.
  return {
    student: {
      _id: student._id,
      scholarNo: student.scholarNo,
      enrollmentNo: student.enrollmentNo,
      rollNo: student.rollNo,
      name: student.name,
      fatherName: student.fatherName,
      motherName: student.motherName,
      dob: student.dob,
      gender: student.gender,
      category: student.category,
      religion: student.religion,
      address: student.address,
      mobile: student.mobile,
      admissionDate: student.admissionDate,
      batch: student.batch,
      branch: student.branch,
      previousSchool: student.previousSchool,
      status: student.status,
      universityId: student.universityId,
      university: university
        ? {
            _id: university._id,
            name: university.name,
            shortCode: university.shortCode,
            enrollmentLabel: university.enrollmentLabel,
          }
        : null,
    },

    course: course
      ? {
          _id: course._id,
          name: course.name,
          shortCode: course.shortCode,
          branch: course.branch,
          pattern: course.pattern,
          duration: course.duration,
          examTerms: course.examTerms,
        }
      : null,

    academicDetails: null,
    academicDetailsAvailable: false,

    clearanceSummary,
    clearanceCheckAvailable,
  };
}

// -------------------------------------------------------------------
// createTC(req, body)
// Creates a new TC draft only when every mandatory clearance is Clear (TC-01).
// -------------------------------------------------------------------

export async function createTC(req, body) {
  const { studentId, reasonForLeaving = '', conduct = '' } = body;

  // 1. Fetch student within current institute scope.
  const student = await Student.findOne({ ...scoped(req), _id: studentId });
  if (!student) throw ApiError.notFound('Student not found');
  if (student.deletedAt) {
    throw ApiError.notFound('Student not found');
  }

  // 2. Check if student already has a TC issued.
  if (student.status === STUDENT_STATUSES.TC_ISSUED) {
    throw ApiError.conflict('Transfer Certificate has already been issued for this student');
  }

  // 3. Check if an active TC draft/submission/approval already exists.
  const existingTC = await TC.findOne({
    ...scoped(req),
    studentId: student._id,
    status: { $in: ['draft', 'submitted', 'pending_approval', 'approved'] },
  });

  if (existingTC) {
    throw ApiError.conflict(
      'A Transfer Certificate draft or record already exists for this student',
    );
  }

  // 4. Verify clearance eligibility (SRS TC-01).
  const eligibility = await checkEligibility(req, student._id);

  if (!eligibility.eligible) {
    throw ApiError.conflict('Cannot create TC draft: mandatory clearances are not clear', {
      pending: eligibility.pending,
    });
  }

  if (!eligibility.clearanceApplicationId) {
    throw ApiError.conflict('A clearance application is required before creating a TC draft');
  }

  // 5. Create TC in draft status and link the clearance application.
  // Spread scoped(req) last to enforce tenant isolation.
  const tc = await TC.create({
    studentId: student._id,
    clearanceApplicationId: eligibility.clearanceApplicationId,
    reasonForLeaving,
    conduct,
    status: 'draft',
    createdBy: getActorId(req),
    updatedBy: getActorId(req),
    ...scoped(req),
  });

  // 6. Record creation in audit log.
  await audit(req, AUDIT_ACTIONS.CREATE, 'tc', tc._id, null, tc);

  return tc;
}

// -------------------------------------------------------------------
// listTCs(req)
// Fetches TC records with pagination, search and status filter.
// -------------------------------------------------------------------

export async function listTCs(req) {
  const { search, sort, page, limit, status } = req.query;

  // Base filter: current tenant and institute only.
  const filter = {
    ...scoped(req),
  };

  // Optional status filter.
  if (status) {
    filter.status = status;
  }

  // Search in student details, TC reference number and book serial.
  if (search) {
    const matchingStudents = await Student.find({
      ...scoped(req),
      deletedAt: null,
      ...searchFilter(search, ['name', 'scholarNo', 'enrollmentNo', 'rollNo']),
    }).distinct('_id');

    const tcSearch = searchFilter(search, ['refNo', 'bookSerial']);

    filter.$or = [...(tcSearch.$or || []), { studentId: { $in: matchingStudents } }];
  }

  // Pagination.
  const { skip } = pageOptions(req.query);

  // Fetch records and total count.
  const [rows, total] = await Promise.all([
    TC.find(filter)
      .sort(sortOption(sort))
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'studentId',
        select: 'name scholarNo enrollmentNo rollNo courseId',
        match: scoped(req),
      })
      .lean(),

    TC.countDocuments(filter),
  ]);

  return {
    rows,
    meta: { page, limit, total },
  };
}

// -------------------------------------------------------------------
// getTCById(req, id)
// Fetches one TC with student and course details.
// -------------------------------------------------------------------

export async function getTCById(req, id) {
  // 1. Find TC within current institute scope.
  const tc = await findTc(req, id);

  // 2. Fetch student and course preview data.
  const preview = await getTCData(req, tc.studentId);

  // 3. Return combined details.
  return {
    tc: {
      _id: tc._id,
      studentId: tc.studentId,
      reasonForLeaving: tc.reasonForLeaving,
      conduct: tc.conduct,
      status: tc.status,
      refNo: tc.refNo,
      bookSerial: tc.bookSerial,
      createdAt: tc.createdAt,
      updatedAt: tc.updatedAt,
    },

    student: preview.student,
    course: preview.course,

    academicDetails: preview.academicDetails,
    academicDetailsAvailable: preview.academicDetailsAvailable,

    clearanceSummary: preview.clearanceSummary,
    clearanceCheckAvailable: preview.clearanceCheckAvailable,
  };
}

// -------------------------------------------------------------------
// updateTC(req, id, changes)
// Updates an existing TC only when its status is draft (TC-03, TC-06).
// -------------------------------------------------------------------

export async function updateTC(req, id, changes) {
  const tc = await findTc(req, id);

  if (tc.status !== 'draft') {
    throw ApiError.conflict('Only draft TCs can be updated');
  }
  const before = tc.toObject();

  const updates = {};
  if (changes.reasonForLeaving !== undefined) {
    updates.reasonForLeaving = changes.reasonForLeaving;
  }
  if (changes.conduct !== undefined) {
    updates.conduct = changes.conduct;
  }

  tc.set(updates);
  tc.updatedBy = getActorId(req);
  await tc.save();
  await audit(req, AUDIT_ACTIONS.UPDATE, 'tc', tc._id, before, tc);
  return tc;
}
