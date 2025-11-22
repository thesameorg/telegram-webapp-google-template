import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { handleWebhook } from './webhook';
import { authHandler } from './api/auth';
import { getPosts, createPost, getPost, deletePost } from './api/posts';
import { uploadMiddleware, uploadImage } from './api/upload';
import { healthHandler } from './api/health';
import { authMiddleware } from './middleware/auth.middleware';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// Middleware
app.use(morgan('dev')); // Logging
app.use(express.json()); // Parse JSON bodies
if (!process.env.WEB_APP_URL) {
  throw new Error('WEB_APP_URL environment variable is required');
}

app.use(cors({
  origin: process.env.WEB_APP_URL,
  credentials: true
}));

// API Routes
app.get('/health', healthHandler);
app.post('/webhook', handleWebhook);
app.post('/api/auth', authHandler);

// Upload route (requires auth)
app.post('/api/upload/image', authMiddleware, uploadMiddleware, uploadImage);

// Posts routes (public read, auth required for write)
app.get('/api/posts', getPosts);
app.get('/api/posts/:id', getPost);
app.post('/api/posts', authMiddleware, createPost);
app.delete('/api/posts/:id', authMiddleware, deletePost);

// Serve frontend static files (in production)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for all other routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorMiddleware);

export default app;
