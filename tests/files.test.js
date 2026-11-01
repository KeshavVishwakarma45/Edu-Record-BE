// Files are served only through GET /api/v1/files/:id, and only to the institute that owns them.
import request from 'supertest';
import { createApp } from '../src/app.js';
import { save } from '../src/utils/storage.js';
import { startDb, stopDb } from './helpers/db.js';
import { createWorld, loginAs } from './helpers/fixtures.js';

const app = createApp();
let world;
let ssecFile;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

beforeAll(async () => {
  await startDb();
  world = await createWorld();
  // Pretend an SSEC user uploaded a photo
  const fakeReq = {
    scope: { tenantId: world.tenantId, instituteId: world.institutes.ssec._id },
    user: { id: world.users.admin._id },
  };
  ssecFile = await save(fakeReq, {
    buffer: PNG,
    mimetype: 'image/png',
    size: PNG.length,
    originalname: 'a.png',
  });
});
afterAll(stopDb);

test('the owning institute can download the file', async () => {
  const token = await loginAs(app, world.users.admin);
  const res = await request(app)
    .get(`/api/v1/files/${ssecFile._id}`)
    .set({ Authorization: `Bearer ${token}`, 'X-Institute-Id': String(world.institutes.ssec._id) });

  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('image/png');
  expect(Buffer.compare(res.body, PNG)).toBe(0);
});

test('another institute gets 404, even with a valid id', async () => {
  const token = await loginAs(app, world.users.ssismPrincipal);
  const res = await request(app)
    .get(`/api/v1/files/${ssecFile._id}`)
    .set({
      Authorization: `Bearer ${token}`,
      'X-Institute-Id': String(world.institutes.ssism._id),
    });

  expect(res.status).toBe(404);
});
