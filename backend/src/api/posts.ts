import { Request, Response } from 'express';
import { PostsService } from '../services/posts.service';
import { z } from 'zod';

const postsService = new PostsService();

// Validation schemas
const createPostSchema = z.object({
  content: z.string().min(1).max(280),
});

const getFeedSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  startAfter: z.string().optional(),
});

/**
 * GET /api/posts - Get feed
 */
export async function getPosts(req: Request, res: Response): Promise<void> {
  try {
    const { limit, startAfter } = getFeedSchema.parse(req.query);

    const result = await postsService.getFeed(limit, startAfter);

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
      return;
    }

    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
}

/**
 * POST /api/posts - Create post (auth required)
 */
export async function createPost(req: Request, res: Response): Promise<void> {
  try {
    const { content } = createPostSchema.parse(req.body);

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const post = await postsService.createPost(
      req.user.userId,
      content,
      {
        username: req.user.username,
        firstName: req.user.firstName,
      }
    );

    res.status(201).json({ post });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid post data', details: error.errors });
      return;
    }

    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
}

/**
 * GET /api/posts/:id - Get single post
 */
export async function getPost(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const post = await postsService.getPost(id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({ post });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
}

/**
 * DELETE /api/posts/:id - Delete post (auth required, owner only)
 */
export async function deletePost(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const deleted = await postsService.deletePost(id, req.user.userId);

    if (!deleted) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      res.status(403).json({ error: error.message });
      return;
    }

    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
}
