import { Request, Response } from 'express';
import multer from 'multer';
import { StorageService } from '../services/storage.service';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG allowed.'));
    }
  },
});

const storageService = new StorageService();

export const uploadMiddleware = upload.single('image');

export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const imageUrl = await storageService.uploadPostImage(req.file.buffer, req.user.userId);

    res.json({ imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    if (error instanceof Error && error.message.includes('Invalid file type')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to upload image' });
    }
  }
}
