import { ZodError } from 'zod';
import multer from 'multer';

export function errorHandler(error, _req, res, _next) {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'Upload exactly one file using the image field.';
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({ error: error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ') });
  }
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  if (status === 500) console.error('Request failed:', error.code || error.name);
  res.status(status).json({ error: status === 500 ? 'Something went wrong. Please try again.' : error.message });
}
