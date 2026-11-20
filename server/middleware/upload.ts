import multer from 'multer';
import path from 'path';

export const zipUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max ZIP
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedMimes = new Set([
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'application/octet-stream',
      'multipart/x-zip',
    ]);
    if (ext !== '.zip' && !allowedMimes.has(file.mimetype)) {
      cb(new Error('Only .zip archive files are permitted.'));
      return;
    }
    cb(null, true);
  },
});
