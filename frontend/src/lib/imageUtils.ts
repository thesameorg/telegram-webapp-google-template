import imageCompression from 'browser-image-compression';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_IMAGE_WIDTH = 1200;
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG and PNG images allowed' };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image must be less than 2 MB' };
  }

  return { valid: true };
}

export async function resizeImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: MAX_IMAGE_WIDTH,
      useWebWorker: true,
    });
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error('Failed to process image');
  }
}
