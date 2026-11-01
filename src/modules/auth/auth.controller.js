import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as authService from './auth.service.js';

// The refresh token lives only in this cookie: JavaScript in the browser cannot read it
// (httpOnly), it is only sent over HTTPS (secure; browsers allow localhost), only to our own
// site (sameSite) and only to /api/v1/auth (path).
const REFRESH_COOKIE = 'refreshToken';
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth',
};

export const login = asyncHandler(async (req, res) => {
  const { refreshToken, ...result } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions,
    maxAge: authService.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  });
  sendSuccess(res, result);
});

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.cookies[REFRESH_COOKIE]);
  sendSuccess(res, result);
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const result = await authService.me(req.user.id, req.user.tenantId);
  sendSuccess(res, result);
});
