import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { ERROR_CODES } from '../../utils/errorCodes.js';
import { User } from '../users/user.model.js';
import { Institute } from '../institutes/institute.model.js';

const ACCESS_TOKEN_LIFETIME = '15m';
export const REFRESH_TOKEN_DAYS = 7;
export const BCRYPT_ROUNDS = 12;

// Compared against when the mobile is unknown, so that case takes as long as a wrong password
const DUMMY_HASH = bcrypt.hashSync('no-such-user', BCRYPT_ROUNDS);

function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), tenantId: String(user.tenantId) },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: ACCESS_TOKEN_LIFETIME,
    },
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

// The institutes this user can open, with their role in each (for the institute switcher)
async function listInstitutes(user) {
  const ids = user.access.map((entry) => entry.instituteId);
  const institutes = await Institute.find({ tenantId: user.tenantId, _id: { $in: ids } })
    .select('name shortCode')
    .sort({ name: 1 })
    .lean();

  return institutes.map((institute) => {
    const access = user.access.find((entry) => String(entry.instituteId) === String(institute._id));
    return {
      id: institute._id,
      name: institute.name,
      shortCode: institute.shortCode,
      role: access.role,
      departmentId: access.departmentId ?? null,
    };
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, mobile: user.mobile };
}

export async function login({ mobile, password }) {
  // Login is the only query allowed without tenantId: we do not know the tenant until we find the user
  const user = await User.findOne({ mobile })
    .select('+passwordHash')
    .setOptions({ skipTenantGuard: true });

  // Same message and same timing for "no such user" and "wrong password", so mobiles cannot be guessed
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk || !user.isActive) {
    throw new ApiError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Mobile number or password is wrong');
  }

  return {
    accessToken: createAccessToken(user),
    refreshToken: createRefreshToken(user),
    user: publicUser(user),
    institutes: await listInstitutes(user),
  };
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
  if (!user || !user.isActive || user.tokenVersion !== payload.version) {
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
  return { user: publicUser(user), institutes: await listInstitutes(user) };
}
