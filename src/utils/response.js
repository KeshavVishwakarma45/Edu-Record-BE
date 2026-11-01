// Every successful response has the same shape, so the client can read any module the same way:
//   { success: true, data, meta?: { page, limit, total } }

export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendList(res, rows, { page, limit, total }) {
  return res.status(200).json({ success: true, data: rows, meta: { page, limit, total } });
}
