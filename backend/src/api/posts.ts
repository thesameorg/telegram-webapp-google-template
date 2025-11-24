import { Request, Response } from 'express';
import { PostsService } from '../services/posts.service';
import { z } from 'zod';

const postsService = new PostsService();

const createPostSchema = z.object({
  content: z.string().min(1).max(280),
  imageUrl: z.string().url().optional(),
});

const getFeedSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  startAfter: z.string().optional(),
});

const handleError = (res: Response, error: unknown, defaultMsg: string): void => {
  if (error instanceof z.ZodError) {
    return void res.status(400).json({ error: 'Invalid input', details: error.errors });
  }
  if (error instanceof Error && error.message.includes('Unauthorized')) {
    return void res.status(403).json({ error: error.message });
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
