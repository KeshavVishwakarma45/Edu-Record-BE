# files

Serves uploaded files: `GET /api/v1/files/:id` (full middleware chain, all staff).
A file of another institute answers 404.

Uploading is done by each module own route: `uploadImage("photo")` from `middleware/upload.js`
checks type and size, then the service calls `save(req, req.file)` from `utils/storage.js` and stores
the returned File `_id` on its record. The client shows a file by fetching it with the token
and using `URL.createObjectURL(blob)`, because an `<img src>` cannot send the token.
