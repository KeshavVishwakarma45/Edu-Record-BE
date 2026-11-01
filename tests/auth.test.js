// Login, refresh cookie, logout and the login rate limit.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, PASSWORD } from './helpers/fixtures.js';

const app = createApp();
let world;

beforeAll(async () => {
  await startDb();
  world = await createWorld();
});
afterAll(stopDb);

const refreshCookie = (res) => res.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));

test('login returns an access token, the user and their institutes, and sets the refresh cookie', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: world.users.admin.email, password: PASSWORD });

  expect(res.status).toBe(200);
  expect(res.body.data.accessToken).toEqual(expect.any(String));
  expect(res.body.data.user).not.toHaveProperty('passwordHash');
  expect(res.body.data.institutes.map((i) => i.shortCode).sort()).toEqual(['SSEC', 'SSISM']);

  const cookie = refreshCookie(res);
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/Secure/);
  expect(cookie).toMatch(/SameSite=Strict/);
});

test('an SSISM-only user only sees SSISM in /me', async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: world.users.ssismPrincipal.email, password: PASSWORD });
  const res = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${login.body.data.accessToken}`);

  expect(res.status).toBe(200);
  expect(res.body.data.institutes).toEqual([
    expect.objectContaining({
      shortCode: 'SSISM',
      roleName: 'Principal',
      permissions: expect.arrayContaining(['course.write', 'tc.approve']),
    }),
  ]);
});

test('refresh works with the cookie and stops working after logout', async () => {
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: world.users.ssismTcClerk.email, password: PASSWORD });
  const cookie = refreshCookie(login).split(';')[0];

  const refreshed = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
  expect(refreshed.status).toBe(200);
  expect(refreshed.body.data.accessToken).toEqual(expect.any(String));

  expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(200);
  expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
});

test('wrong password and unknown email give the same 401', async () => {
  const wrongPassword = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: world.users.admin.email, password: 'wrong' });
  const unknownMobile = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'nobody@singaji.test', password: 'wrong' });

  expect(wrongPassword.status).toBe(401);
  expect(unknownMobile.status).toBe(401);
  expect(wrongPassword.body.error).toEqual(unknownMobile.body.error);
});

test('login is blocked after 5 failed attempts for the same email', async () => {
  const attempt = (email, password = 'wrong') =>
    request(app).post('/api/v1/auth/login').send({ email, password });
  const email = world.users.ssismPrincipal.email;

  for (let i = 0; i < 5; i += 1) {
    expect((await attempt(email)).status).toBe(401);
  }
  const blocked = await attempt(email, PASSWORD); // even the right password waits now
  expect(blocked.status).toBe(429);
  expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');

  // Other email addresses are not affected
  expect((await attempt(world.users.admin.email, PASSWORD)).status).toBe(200);
});

test('email login ignores upper/lower case and spaces', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: `  ${world.users.admin.email.toUpperCase()} `, password: PASSWORD });
  expect(res.status).toBe(200);
  expect(res.body.data.user.email).toBe(world.users.admin.email);
});

test('an invalid email is a 400 on the email field', async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'not-an-email', password: PASSWORD });
  expect(res.status).toBe(400);
  expect(res.body.error.details).toEqual([
    { field: 'email', message: 'Enter a valid email address' },
  ]);
});
