import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export class StorageService {
  private bucketName: string;

  constructor() {
    if (!process.env.STORAGE_BUCKET) {
      throw new Error('STORAGE_BUCKET environment variable is required');
    }
    this.bucketName = process.env.STORAGE_BUCKET;
  }

  private getBucket() {
    // Use Firebase Admin Storage - automatically uses the same credentials
    return getStorage().bucket(this.bucketName);
  }

  /**
   * Upload image to Cloud Storage with UUID filename and stripped metadata
   */
  async uploadPostImage(
    buffer: Buffer,
    userId: string
  ): Promise<string> {
    let tempFilePath: string | null = null;

    try {
      // Strip metadata and re-encode (sharp strips metadata by default)
      const cleanBuffer = await sharp(buffer)
        .rotate() // Auto-rotate based on EXIF orientation
        .toBuffer();

      const uuid = randomUUID();
      const ext = await this.getImageExtension(cleanBuffer);
      const filename = `posts/${userId}/${uuid}.${ext}`;
      const contentType = this.getContentType(ext);

      // Write to temporary file
      tempFilePath = join(tmpdir(), `upload-${uuid}.${ext}`);
      await writeFile(tempFilePath, cleanBuffer);

      const bucket = this.getBucket();

      // Upload from file (more reliable than stream)
      await bucket.upload(tempFilePath, {
        destination: filename,
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      return `https://storage.googleapis.com/${this.bucketName}/${filename}`;
    } catch (error) {
      console.error('Error in uploadPostImage:', error);
      throw error;
    } finally {
      // Clean up temp file
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch (err) {
          console.error('Failed to delete temp file:', err);
        }
      }
    }
  }

  /**
   * Delete image from Cloud Storage
   */
  async deletePostImage(imageUrl: string): Promise<void> {
    try {
      const filename = this.extractFilenameFromUrl(imageUrl);
      if (!filename) return;

      const bucket = this.getBucket();
      await bucket.file(filename).delete();
    } catch (error) {
      console.error('Failed to delete image:', error);
      // Don't throw - allow post deletion even if image deletion fails
    }
  }

  private extractFilenameFromUrl(url: string): string {
    const match = url.match(/telegram-webapp-images\/(.+)$/);
    return match ? match[1] : '';
  }

  private async getImageExtension(buffer: Buffer): Promise<string> {
    const metadata = await sharp(buffer).metadata();
    return metadata.format === 'png' ? 'png' : 'jpg';
  }

  private getContentType(ext: string): string {
    return ext === 'png' ? 'image/png' : 'image/jpeg';
  }
}
