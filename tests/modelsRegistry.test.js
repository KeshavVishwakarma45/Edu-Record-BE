// Every *.model.js must be listed in config/models.js, otherwise populate() of that model
// fails at runtime with "Schema hasn't been registered" (tests import models directly and miss it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const registry = fs.readFileSync(path.join(src, 'config/models.js'), 'utf8');
const modelFiles = fs
  .readdirSync(path.join(src, 'modules'), { recursive: true })
  .filter((file) => file.endsWith('.model.js'))
  .map((file) => file.split(path.sep).join('/'));

test.each(modelFiles)('modules/%s is registered in config/models.js', (file) => {
  expect(registry).toContain(`'../modules/${file}'`);
});
