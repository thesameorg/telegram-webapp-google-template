# Image Upload Implementation Plan

## Overview
Add optional image upload functionality to posts. Users can attach one image per post (Twitter-like). Images stored in Google Cloud Storage, displayed in feed with lazy loading.

## Requirements
- **Max file size**: 2 MB
- **Image formats**: JPEG/JPG, PNG
- **Optimization**: Client-side resize (max 1200px width)
- **Preview**: Show preview without edit option (remove & re-add to change)
- **Filenames**: UUID-based, metadata stripped
- **Optional**: Posts can have or not have images
- **Storage**: `telegram-webapp-images` bucket (asia-southeast1)
- **Feed**: Lazy loading for images

## Bucket Permissions Verified
```
✓ Public read: allUsers → roles/storage.objectViewer
✓ Authenticated write: projectEditor/Owner → roles/storage.legacyBucketOwner
✓ Location: ASIA-SOUTHEAST1
✓ Upload/download tested successfully
```

**Note**: User avatars (photoUrl) are NOT stored in bucket - only post images go to bucket.

---

## 1. Type Definitions Updates

### Backend: `backend/src/types.ts`
```typescript
export interface PostDocument {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;        // NEW: Optional post image URL
  createdAt: string;
  author: {
    username: string;
    firstName: string;
    photoUrl?: string;      // User avatar (NOT from bucket)
  };
}
```

### Frontend: `frontend/src/lib/api.ts`
```typescript
export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;        // NEW: Optional post image URL
  createdAt: string;
  author: {
    username: string;
    firstName: string;
    photoUrl?: string;      // User avatar (NOT from bucket)
  };
}
```

---

## 2. Backend Implementation

### 2.1 Install Dependencies
```bash
cd backend
npm install @google-cloud/storage multer @types/multer sharp @types/sharp
```

**Why sharp?** Strip EXIF metadata and ensure clean image processing.

### 2.2 Create Storage Service: `backend/src/services/storage.service.ts`
```typescript
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export class StorageService {
  private storage: Storage;
  private bucketName = process.env.STORAGE_BUCKET || 'telegram-webapp-images';

  constructor() {
    this.storage = new Storage({
      projectId: process.env.FIREBASE_PROJECT_ID,
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }
    });
  }

  /**
   * Upload image to Cloud Storage with UUID filename and stripped metadata
   */
  async uploadPostImage(
    buffer: Buffer,
    userId: string
  ): Promise<string> {
    // Strip metadata and re-encode
    const cleanBuffer = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF (then strip)
      .withMetadata({
        exif: {},    // Remove EXIF
        icc: {},     // Keep color profile for quality
      })
      .toBuffer();

    const uuid = randomUUID();
    const ext = await this.getImageExtension(cleanBuffer);
    const filename = `posts/${userId}/${uuid}.${ext}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filename);

    await file.save(cleanBuffer, {
      metadata: {
        contentType: this.getContentType(ext),
        cacheControl: 'public, max-age=31536000',
      },
      resumable: false,
    });

    return `https://storage.googleapis.com/${this.bucketName}/${filename}`;
  }

  /**
   * Delete image from Cloud Storage
   */
  async deletePostImage(imageUrl: string): Promise<void> {
    try {
      const filename = this.extractFilenameFromUrl(imageUrl);
      if (!filename) return;

      const bucket = this.storage.bucket(this.bucketName);
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
```

### 2.3 Update Posts Service: `backend/src/services/posts.service.ts`
```typescript
import type { PostDocument } from '../types';
import { StorageService } from './storage.service';

export class PostsService {
  private storageService = new StorageService();

  private async getCollection() {
    const { db } = await import('../config/firebase');
    return db.collection('posts');
  }

  async createPost(
    userId: string,
    content: string,
    author: { username: string; firstName: string; photoUrl?: string },
    imageUrl?: string
  ): Promise<PostDocument> {
    const postData = {
      userId,
      content,
      createdAt: new Date().toISOString(),
      author,
      ...(imageUrl && { imageUrl })
    };

    const collection = await this.getCollection();
    const docRef = await collection.add(postData);
    return { id: docRef.id, ...postData };
  }

  async getFeed(limit = 20, startAfter?: string): Promise<{
    posts: PostDocument[];
    nextCursor?: string;
  }> {
    const collection = await this.getCollection();
    let query = collection.orderBy('createdAt', 'desc').limit(limit + 1);

    if (startAfter) {
      const startDoc = await collection.doc(startAfter).get();
      if (startDoc.exists) query = query.startAfter(startDoc);
    }

    const snapshot = await query.get();
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostDocument));
    const hasMore = posts.length > limit;

    if (hasMore) posts.pop();

    return {
      posts,
      ...(hasMore && posts.length > 0 && { nextCursor: posts[posts.length - 1].id })
    };
  }

  async getPost(postId: string): Promise<PostDocument | null> {
    const collection = await this.getCollection();
    const doc = await collection.doc(postId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } as PostDocument : null;
  }

  async deletePost(postId: string, userId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const doc = await collection.doc(postId).get();

    if (!doc.exists) return false;

    const post = doc.data() as PostDocument;
    if (post.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete another user\'s post');
    }

    // Delete image from storage if exists
    if (post.imageUrl) {
      await this.storageService.deletePostImage(post.imageUrl);
    }

    await collection.doc(postId).delete();
    return true;
  }
}
```

### 2.4 Create Upload Endpoint: `backend/src/api/upload.ts`
```typescript
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

    const imageUrl = await storageService.uploadPostImage(
      req.file.buffer,
      req.user.userId
    );

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
```

### 2.5 Update Post Creation: `backend/src/api/posts.ts`
```typescript
import { Request, Response } from 'express';
import { PostsService } from '../services/posts.service';
import { z } from 'zod';

const postsService = new PostsService();

const createPostSchema = z.object({
  content: z.string().min(1).max(280),
  imageUrl: z.string().url().optional(),  // NEW
});

const getFeedSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  startAfter: z.string().optional(),
});

const handleError = (res: Response, error: unknown, defaultMsg: string): void => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid input', details: error.errors });
    return;
  }
  if (error instanceof Error && error.message.includes('Unauthorized')) {
    res.status(403).json({ error: error.message });
    return;
  }
  console.error(defaultMsg, error);
  res.status(500).json({ error: defaultMsg });
};

export async function getPosts(req: Request, res: Response): Promise<void> {
  try {
    const { limit, startAfter } = getFeedSchema.parse(req.query);
    res.json(await postsService.getFeed(limit, startAfter));
  } catch (error) {
    handleError(res, error, 'Failed to fetch posts');
  }
}

export async function createPost(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });

    const { content, imageUrl } = createPostSchema.parse(req.body);

    const post = await postsService.createPost(
      req.user.userId,
      content,
      {
        username: req.user.username,
        firstName: req.user.firstName,
        photoUrl: req.user.photoUrl,
      },
      imageUrl
    );

    res.status(201).json({ post });
  } catch (error) {
    handleError(res, error, 'Failed to create post');
  }
}

export async function getPost(req: Request, res: Response): Promise<void> {
  try {
    const post = await postsService.getPost(req.params.id);
    if (!post) return void res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (error) {
    handleError(res, error, 'Failed to fetch post');
  }
}

export async function deletePost(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) return void res.status(401).json({ error: 'Unauthorized' });

    const deleted = await postsService.deletePost(req.params.id, req.user.userId);
    if (!deleted) return void res.status(404).json({ error: 'Post not found' });

    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Failed to delete post');
  }
}
```

### 2.6 Update Routes: `backend/src/app.ts`
```typescript
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { handleWebhook } from './webhook';
import { authHandler } from './api/auth';
import { getPosts, createPost, getPost, deletePost } from './api/posts';
import { uploadMiddleware, uploadImage } from './api/upload';  // NEW
import { healthHandler } from './api/health';
import { authMiddleware } from './middleware/auth.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
  origin: process.env.WEB_APP_URL || '*',
  credentials: true
}));

// API Routes
app.get('/health', healthHandler);
app.post('/webhook', handleWebhook);
app.post('/api/auth', authHandler);

// Upload route (requires auth)
app.post('/api/upload/image', authMiddleware, uploadMiddleware, uploadImage);  // NEW

// Posts routes (public read, auth required for write)
app.get('/api/posts', getPosts);
app.get('/api/posts/:id', getPost);
app.post('/api/posts', authMiddleware, createPost);
app.delete('/api/posts/:id', authMiddleware, deletePost);

// Serve frontend static files (in production)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorMiddleware);

export default app;
```

---

## 3. Frontend Implementation

### 3.1 Install Dependencies
```bash
cd frontend
npm install browser-image-compression
```

### 3.2 Create Image Utils: `frontend/src/lib/imageUtils.ts`
```typescript
import imageCompression from 'browser-image-compression';

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
export const MAX_IMAGE_WIDTH = 1200;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPEG and PNG images allowed' };
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image must be less than 2 MB' };
  }

  return { valid: true };
}

export async function resizeImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: MAX_IMAGE_WIDTH,
    useWebWorker: true,
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error('Failed to process image');
  }
}

export function createImagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeImagePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}
```

### 3.3 Update API Client: `frontend/src/lib/api.ts`
```typescript
import { STORAGE_KEYS, FEED_PAGE_SIZE } from './constants';

const API_BASE = '/api';

export interface User {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;        // NEW
  createdAt: string;
  author: {
    username: string;
    firstName: string;
    photoUrl?: string;
  };
}

export interface AuthResponse {
  authenticated: boolean;
  token: string;
  user: User;
}

export interface FeedResponse {
  posts: Post[];
  nextCursor?: string;
}

const handleApiError = async (response: Response, defaultMsg: string) => {
  const error = await response.json();
  throw new Error(error.error || defaultMsg);
};

export async function authenticate(initData: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!response.ok) await handleApiError(response, 'Authentication failed');
  return response.json();
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(STORAGE_KEYS.JWT);

  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.JWT);
    window.location.reload();
    throw new Error('Session expired');
  }

  return response;
}

export async function getFeed(limit: number = FEED_PAGE_SIZE, startAfter?: string): Promise<FeedResponse> {
  const url = `${API_BASE}/posts?limit=${limit}${startAfter ? `&startAfter=${startAfter}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) await handleApiError(response, 'Failed to fetch feed');
  return response.json();
}

// NEW: Upload image
export async function uploadImage(imageFile: File): Promise<{ imageUrl: string }> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const token = localStorage.getItem(STORAGE_KEYS.JWT);
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}/upload/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.JWT);
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!response.ok) await handleApiError(response, 'Failed to upload image');
  return response.json();
}

// UPDATED: Accept imageUrl
export async function createPost(content: string, imageUrl?: string): Promise<{ post: Post }> {
  const response = await fetchWithAuth('/posts', {
    method: 'POST',
    body: JSON.stringify({ content, imageUrl }),
  });

  if (!response.ok) await handleApiError(response, 'Failed to create post');
  return response.json();
}

export async function deletePost(postId: string): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`/posts/${postId}`, {
    method: 'DELETE',
  });

  if (!response.ok) await handleApiError(response, 'Failed to delete post');
  return response.json();
}
```

### 3.4 Create Image Upload Component: `frontend/src/components/ImageUpload.tsx`
```typescript
import { useRef, useState, useEffect } from 'react';
import {
  validateImageFile,
  resizeImage,
  createImagePreviewUrl,
  revokeImagePreviewUrl
} from '../lib/imageUtils';

interface ImageUploadProps {
  onImageSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function ImageUpload({ onImageSelect, disabled }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) revokeImagePreviewUrl(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);

    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    try {
      const resizedFile = await resizeImage(file);
      const preview = createImagePreviewUrl(resizedFile);

      if (previewUrl) revokeImagePreviewUrl(previewUrl);

      setPreviewUrl(preview);
      onImageSelect(resizedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image');
    }
  };

  const handleRemove = () => {
    if (previewUrl) revokeImagePreviewUrl(previewUrl);

    setPreviewUrl(null);
    setError(null);
    onImageSelect(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {!previewUrl ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Add Image
        </button>
      ) : (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-64 rounded-lg border border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 disabled:opacity-50 shadow-lg transition-colors"
            title="Remove image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
```

### 3.5 Update PostForm: `frontend/src/components/PostForm.tsx`
```typescript
import { useState } from 'react';
import { createPost, uploadImage } from '../lib/api';
import { Button } from './ui';
import { ImageUpload } from './ImageUpload';
import { POST_CHARACTER_LIMIT } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && !selectedImage) {
      setError('Post must have content or an image');
      return;
    }

    if (content.length > POST_CHARACTER_LIMIT) {
      setError(`Post is too long (max ${POST_CHARACTER_LIMIT} characters)`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;

      // Upload image first if selected
      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);
        imageUrl = uploadResult.imageUrl;
      }

      // Create post with optional image
      await createPost(content, imageUrl);

      setContent('');
      setSelectedImage(null);
      onPostCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = POST_CHARACTER_LIMIT - content.length;
  const isValid = (content.trim() || selectedImage) && content.length <= POST_CHARACTER_LIMIT;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening?"
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={isSubmitting}
        />

        <div className="mt-3">
          <ImageUpload
            onImageSelect={setSelectedImage}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-between items-center mt-3">
          <span className={`text-sm ${remainingChars < 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {remainingChars} characters remaining
          </span>
          <Button type="submit" disabled={isSubmitting || !isValid}>
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </form>
    </div>
  );
}
```

### 3.6 Update Post Component with Lazy Loading: `frontend/src/components/Post.tsx`
```typescript
import { useState } from 'react';
import { Post as PostType } from '../lib/api';
import { formatRelativeDate } from '../lib/utils';

interface PostProps {
  post: PostType;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
}

export function Post({ post, currentUserId, onDelete }: PostProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const canDelete = currentUserId && currentUserId === post.userId;

  const handleDelete = () => {
    if (onDelete && confirm('Are you sure you want to delete this post?')) {
      onDelete(post.id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {post.author.photoUrl ? (
            <img
              src={post.author.photoUrl}
              alt={post.author.firstName}
              className="w-10 h-10 rounded-full"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {post.author.firstName[0]}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className="font-bold">{post.author.firstName}</span>
              {post.author.username && (
                <span className="text-gray-500 text-sm">@{post.author.username}</span>
              )}
              <span className="text-gray-400 text-sm">·</span>
              <span className="text-gray-400 text-sm">{formatRelativeDate(post.createdAt)}</span>
            </div>

            {post.content && (
              <p className="mt-1 text-gray-800 whitespace-pre-wrap">{post.content}</p>
            )}

            {/* Lazy loaded post image */}
            {post.imageUrl && (
              <div className="mt-3 relative">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg min-h-[200px]">
                    <div className="animate-pulse text-gray-400">Loading...</div>
                  </div>
                )}
                <img
                  src={post.imageUrl}
                  alt="Post image"
                  className={`max-w-full rounded-lg border border-gray-200 transition-opacity duration-300 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  loading="lazy"
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            )}
          </div>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-sm ml-2 transition-colors"
            title="Delete post"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 4. File Organization in Bucket

```
telegram-webapp-images/
└── posts/
    └── {userId}/
        ├── {uuid1}.jpg       # Post images (UUID filenames, metadata stripped)
        ├── {uuid2}.png
        └── ...
```

**Note**: User avatars (`photoUrl`) are NOT stored in this bucket.

---

## 5. Implementation Steps

### Phase 1: Backend
1. Install dependencies: `@google-cloud/storage`, `multer`, `@types/multer`, `sharp`, `@types/sharp`
2. Create `StorageService` (UUID naming, metadata stripping via sharp)
3. Create upload endpoint with multer middleware
4. Update `PostsService` (handle imageUrl, delete images on post deletion)
5. Update post creation API to accept imageUrl
6. Add upload route to `app.ts` (requires auth middleware)
7. Update `PostDocument` type

### Phase 2: Frontend
1. Install dependencies: `browser-image-compression`
2. Create image utility functions
3. Create `ImageUpload` component
4. Update `PostForm` (image upload + preview)
5. Update `Post` component (display images with lazy loading)
6. Update API client (`uploadImage` + update `createPost`)
7. Update `Post` interface

### Phase 3: Manual Testing
- [ ] Upload JPEG (< 2 MB) - verify UUID filename in bucket
- [ ] Upload PNG (< 2 MB) - verify UUID filename in bucket
- [ ] Try uploading > 2 MB image (should fail with error)
- [ ] Try uploading GIF (should fail with error)
- [ ] Post text only (no image) - should work
- [ ] Post image only (no text) - should work
- [ ] Post text + image - should work
- [ ] Remove image before posting - should work
- [ ] Delete post with image - verify image deleted from bucket
- [ ] Test in Telegram WebApp on mobile
- [ ] Verify lazy loading in feed (check Network tab)
- [ ] Verify metadata stripped (download image, check EXIF)

---

## 6. Environment Variables

Add to `.env`:
```bash
STORAGE_BUCKET=telegram-webapp-images
```

Already configured in GitHub Actions as repository variable.

---

## 7. Security & Auth

### Authentication
- Uses existing auth middleware (Telegram + DEV_BYPASS_AUTH for local)
- Upload endpoint requires authentication
- Users can only delete their own posts/images

### File Validation
- **Client-side**: File type (JPEG/PNG), size (2 MB)
- **Server-side**: Multer validation, sharp processing
- **Metadata**: Stripped via sharp to remove EXIF, location data, etc.

### Storage Security
- Bucket: Public read (`allUsers` → `roles/storage.objectViewer`)
- Bucket: Authenticated write (`projectEditor/Owner` → `roles/storage.legacyBucketOwner`)
- Files organized by userId (prevents conflicts)
- UUID filenames (no predictable paths)

### Input Sanitization
- Image URLs validated with Zod schema
- Content-Type headers enforced
- No executable files possible (JPEG/PNG only)

---

## Dependencies Summary

### Backend
- `@google-cloud/storage` - Cloud Storage SDK
- `multer` + `@types/multer` - File upload middleware
- `sharp` + `@types/sharp` - Image processing & metadata stripping

### Frontend
- `browser-image-compression` - Client-side resize/compression
