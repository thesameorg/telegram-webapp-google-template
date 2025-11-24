import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export class StorageService {
  private bucketName: string;

  constructor() {
    if (!process.env.STORAGE_BUCKET) {
      throw new Error('STORAGE_BUCKET environment variable is required');
    }
    this.bucketName = process.env.STORAGE_BUCKET;
  }

  async uploadPostImage(buffer: Buffer, userId: string): Promise<string> {
    const processed = await sharp(buffer).rotate().toBuffer();
    const { format } = await sharp(processed).metadata();

    const ext = format === 'png' ? 'png' : 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const filename = `posts/${userId}/${randomUUID()}.${ext}`;

    const file = getStorage().bucket(this.bucketName).file(filename);

    await file.save(processed, {
      metadata: { contentType, cacheControl: 'public, max-age=31536000' },
    });

    return `https://storage.googleapis.com/${this.bucketName}/${filename}`;
  }

  async deletePostImage(imageUrl: string): Promise<void> {
    try {
      const match = imageUrl.match(/telegram-webapp-images\/(.+)$/);
      if (match) {
        await getStorage().bucket(this.bucketName).file(match[1]).delete();
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }
}
