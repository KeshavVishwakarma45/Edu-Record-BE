import { File } from './file.model.js';
import { findScopedOr404 } from '../../utils/findScoped.js';
import { getStream } from '../../utils/storage.js';

// Finds a file of the selected institute and opens it for reading.
// A file of another institute is "not found", exactly like a missing one (and the attempt is audited).
export async function open(req, id) {
  const file = await findScopedOr404(req, File, id, 'file');
  return { file, stream: getStream(file) };
}
