import Joi from 'joi';
import { objectId, listQuery } from '../../utils/validators.js';
import {
  CLEARANCE_ACTION_STATUSES,
  CLEARANCE_STATUS_LIST,
} from '../../constants/clearanceStatuses.js';

const documentsEnclosedSchema = Joi.object({
  tenthMarksheet: Joi.boolean().required(),
  twelfthMarksheet: Joi.boolean().required(),
  yearSemesterMarksheets: Joi.boolean().required(),
}).unknown(false);

const declarationsSchema = Joi.object({
  feesPaid: Joi.boolean().required(),
  duesCleared: Joi.boolean().required(),
  booksReturned: Joi.boolean().required(),
}).unknown(false);

// CLR-01: Create TC clearance application.
export const createClearanceApplicationSchema = Joi.object({
  studentId: objectId().required(),
  lastClassAttended: Joi.string().trim().min(1).max(100).required(),
  leavingReason: Joi.string().trim().min(1).max(250).required(),
  documentsEnclosed: documentsEnclosedSchema.required(),
  declarations: declarationsSchema.required(),
}).unknown(false);

// CLR-03: Department updates its own clearance item.
// A remark can be updated independently.
// NOT_CLEAR requires a reason.
export const updateClearanceItemSchema = Joi.object({
  status: Joi.string().valid(...CLEARANCE_ACTION_STATUSES),

  remark: Joi.when('status', {
    is: 'NOT_CLEAR',
    then: Joi.string().trim().min(1).max(500).required(),
    otherwise: Joi.string().trim().max(500),
  }),

  amountDue: Joi.number().min(0).precision(2),
})
  .min(1)
  .unknown(false);

// CLR-05: Accounts updates pending dues.
export const updateClearanceDuesSchema = Joi.object({
  amountDue: Joi.number().min(0).precision(2).required(),
  remark: Joi.string().trim().max(500),
}).unknown(false);

// Route parameters.
export const clearanceItemIdParams = Joi.object({
  itemId: objectId().required(),
});

export const clearanceStudentIdParams = Joi.object({
  studentId: objectId().required(),
});

export const clearanceApplicationIdParams = Joi.object({
  clearanceApplicationId: objectId().required(),
});

// CLR-02: List and filter clearance applications.
export const listClearanceApplicationsQuery = listQuery(
  ['createdAt', 'lastClassAttended', 'leavingReason'],
  {
    studentId: objectId().allow(''),
    fromDate: Joi.date().iso().raw(),
    toDate: Joi.date().iso().raw(),
  },
);

// CLR-03: Department clearance queue.
export const listClearanceQueueQuery = listQuery(['createdAt', 'status', 'statusUpdatedAt'], {
  status: Joi.string().valid(...CLEARANCE_STATUS_LIST),
  departmentId: objectId().allow(''),
  dateFrom: Joi.date().iso().raw(),
  dateTo: Joi.date().iso().raw(),
  fromDate: Joi.date().iso().raw(),
  toDate: Joi.date().iso().raw(),
});

// Department clearance history.
export const listDepartmentHistoryQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  studentId: objectId().allow(''),
  status: Joi.string().valid(...CLEARANCE_STATUS_LIST),
  dateFrom: Joi.date().iso().raw(),
  dateTo: Joi.date().iso().raw(),
}).unknown(false);

// CLR-05: Accounts pending dues list.
export const listPendingDuesQuery = listQuery(['createdAt', 'updatedAt', 'amountDue'], {
  departmentId: objectId().allow(''),
  fromDate: Joi.date().iso().raw(),
  toDate: Joi.date().iso().raw(),
});

// CLR-05: Accounts audit history filters.
export const listAccountsHistoryQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().max(100),
  studentId: objectId().allow(''),
  status: Joi.string().valid(...CLEARANCE_STATUS_LIST),
  dateFrom: Joi.date().iso().raw(),
  dateTo: Joi.date().iso().raw(),
}).unknown(false);
