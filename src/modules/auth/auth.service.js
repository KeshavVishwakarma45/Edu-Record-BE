import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../utils/errorCodes.js';
import { accessibleInstitutes } from '../../utils/access.js';
import { hashToken } from '../../utils/setupLink.js';
import { USER_STATUSES } from '../../constants/statuses.js';
import { User } from '../users/user.model.js';

const ACCESS_TOKEN_LIFETIME = '15m';
export const REFRESH_TOKEN_DAYS = 7;
export const BCRYPT_ROUNDS = 12;

// Compared against when the email is unknown, so that case takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('no-such-user', BCRYPT_ROUNDS);

function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), tenantId: String(user.tenantId) },
    env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_LIFETIME },
  );
}

function createRefreshToken(user) {
  // tokenVersion lets logout cancel every refresh token issued before it
  return jwt.sign(
    { sub: String(user._id), tenantId: String(user.tenantId), version: user.tokenVersion },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_DAYS}d` },
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    isSuperAdmin: user.isSuperAdmin,
  };
}

// Everything the client needs after a successful login or password setup
async function startSession(user) {
  await User.updateOne({ tenantId: user.tenantId, _id: user._id }, { lastLoginAt: new Date() });
  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
    user: publicUser(user),
    institutes: await accessibleInstitutes(user),
  };
}

export async function login({ email, password }) {
  // Login is the only query allowed without tenantId: we do not know the tenant until we find the user
  const user = await User.findOne({ email })
    .select('+passwordHash')
    .setOptions({ skipTenantGuard: true });

  // Same message and same timing for "no such user", "no password yet" and "wrong password",
  // so emails cannot be guessed
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk || user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Email or password is wrong');
  }
  return startSession(user);
}

// Checks the refresh cookie and returns the user it belongs to
async function userFromRefreshToken(refreshToken) {
  if (!refreshToken) throw ApiError.unauthenticated();
  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw ApiError.unauthenticated('Your session has expired. Please log in again.');
  }
  const user = await User.findOne({ _id: payload.sub, tenantId: payload.tenantId });
  if (!user || user.status !== USER_STATUSES.ACTIVE || user.tokenVersion !== payload.version) {
    throw ApiError.unauthenticated('Your session has expired. Please log in again.');
  }
  return user;
}

export async function refresh(refreshToken) {
  const user = await userFromRefreshToken(refreshToken);
  return { accessToken: createAccessToken(user) };
}

export async function logout(refreshToken) {
  try {
    const user = await userFromRefreshToken(refreshToken);
    await User.updateOne({ _id: user._id, tenantId: user.tenantId }, { $inc: { tokenVersion: 1 } });
  } catch {
    // Already logged out or the token expired: nothing to cancel
  }
}

export async function me(userId, tenantId) {
  const user = await User.findOne({ _id: userId, tenantId }).lean();
  return { user: publicUser(user), institutes: await accessibleInstitutes(user) };
}

// ---- Invite and password links (the link is made in users.service.js) ----------------------

// Like login, the token arrives before the tenant is known, so this is the third explicit
// tenantGuard bypass: it looks up one user by the hash of a secret, random token.
async function userFromSetupToken(token) {
  const user = await User.findOne({ setupTokenHash: hashToken(token) })
    .select('+setupTokenHash')
    .setOptions({ skipTenantGuard: true });
  if (!user || !user.setupTokenExpiresAt || user.setupTokenExpiresAt < new Date()) {
    throw ApiError.notFound('This link is not valid or has expired. Ask your admin for a new one.');
  }
  if (user.status === USER_STATUSES.DISABLED) {
    throw ApiError.forbidden('This account is disabled');
  }
  return user;
}

// GET: who is this link for? (shown on the Set password page)
export async function checkSetupToken(token) {
  const user = await userFromSetupToken(token);
  return { name: user.name, email: user.email, isNewUser: user.status === USER_STATUSES.INVITED };
}

// POST: set the password, activate the account, and log the person in
export async function useSetupToken(token, password) {
  const user = await userFromSetupToken(token);
  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.status = USER_STATUSES.ACTIVE;
  user.setupTokenHash = null; // the link works only once
  user.setupTokenExpiresAt = null;
  user.tokenVersion += 1; // a password change logs out every other session
  await user.save();
  return startSession(user);
}
