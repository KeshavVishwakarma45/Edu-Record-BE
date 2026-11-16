import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendList } from '../../utils/response.js';
import * as inwardService from './inward.service.js';

export const getStudents = asyncHandler(async (req, res) => {
  const students = await inwardService.getStudents(req, req.params.id);
  sendSuccess(res, students);
});

export const createReceipt = asyncHandler(async (req, res) => {
  const receipt = await inwardService.createReceipt(req, req.params.id, req.body);
  sendSuccess(res, receipt);
});

export const updateReceipt = asyncHandler(async (req, res) => {
  const receipt = await inwardService.updateReceipt(
    req,
    req.params.id,
    req.params.receiptId,
    req.body,
  );
  sendSuccess(res, receipt);
});

export const receiveMissing = asyncHandler(async (req, res) => {
  const receipt = await inwardService.receiveMissing(
    req,
    req.params.newBatchId,
    req.params.missingId,
    req.body,
  );
  sendSuccess(res, receipt);
});

// API 11: Update missing document
export const updateMissing = asyncHandler(async (req, res) => {
  const document = await inwardService.updateMissing(
    req,
    req.params.id,
    req.params.missingId,
    req.body,
  );

  sendSuccess(res, document);
});

// API 12: Get pending documents
export const getPending = asyncHandler(async (req, res) => {
  const { rows, meta } = await inwardService.getPending(req);
  sendList(res, rows, meta);
});

// List all inward batches
export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await inwardService.list(req);
  sendList(res, rows, meta);
});

// Get one inward batch by ID
export const getById = asyncHandler(async (req, res) => {
  sendSuccess(res, await inwardService.getById(req, req.params.id));
});

// Create a new inward batch
export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, await inwardService.create(req, req.body), 201);
});

// Get expected, received and missing document counts
export const getCounts = asyncHandler(async (req, res) => {
  sendSuccess(res, await inwardService.getCounts(req, req.params.id));
});

// Mark a student's document as missing
export const markDocumentMissing = asyncHandler(async (req, res) => {
  sendSuccess(res, await inwardService.markDocumentMissing(req, req.params.id, req.body));
});

// Get all missing documents for an inward batch
export const getMissingDocuments = asyncHandler(async (req, res) => {
  sendSuccess(res, await inwardService.getMissingDocuments(req, req.params.id));
});
