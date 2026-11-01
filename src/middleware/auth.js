import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../modules/users/user.model.js';
import { USER_STATUSES } from '../constants/statuses.js';

// Step 1 of every protected route: who is calling?
// Reads "Authorization: Bearer <access token>", checks it, loads the user and sets
//   req.user = { id, tenantId, name, email, isSuperAdmin,
//                access: [{ ownerType, ownerId, roleId, departmentIds }] }
export async function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthenticated());

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch {
    // Expired or tampered token. The client reacts to 401 by calling /auth/refresh.
    return next(ApiError.unauthenticated('Your session has expired. Please log in again.'));
  }

  // Load the user on every request so a deactivated user is locked out immediately
  const user = await User.findOne({ _id: payload.sub, tenantId: payload.tenantId }).lean();
  if (!user || user.status !== USER_STATUSES.ACTIVE) {
    return next(ApiError.unauthenticated('This account is not active'));
  }

  req.user = {
    id: user._id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    access: user.access,
  };
  next();
}
