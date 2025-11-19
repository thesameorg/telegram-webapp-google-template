import type { PostDocument } from '../types';

export class PostsService {
  // Always use real Firebase - no mock database

  /**
   * Create a new post
   */
  async createPost(
    userId: string,
    content: string,
    author: { username: string; firstName: string; photoUrl?: string }
  ): Promise<PostDocument> {
    const postData = {
      userId,
      content,
      createdAt: new Date().toISOString(),
      author,
    };

    const { db } = await import('../config/firebase');
    const collection = db.collection('posts');
    const docRef = await collection.add(postData);
    const post = { id: docRef.id, ...postData };

    return post;
  }

  /**
   * Get feed (paginated, newest first)
   */
  async getFeed(limit: number = 20, startAfter?: string): Promise<{
    posts: PostDocument[];
    nextCursor?: string;
  }> {
    const { db } = await import('../config/firebase');
    const collection = db.collection('posts');
    let query = collection
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (startAfter) {
      const startDoc = await collection.doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as PostDocument));

    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop();
    }

    const result: { posts: PostDocument[]; nextCursor?: string } = { posts };

    if (hasMore && posts.length > 0) {
      result.nextCursor = posts[posts.length - 1].id;
    }

    return result;
  }

  /**
   * Get a single post by ID
   */
  async getPost(postId: string): Promise<PostDocument | null> {
    const { db } = await import('../config/firebase');
    const collection = db.collection('posts');
    const doc = await collection.doc(postId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as PostDocument;
  }

  /**
   * Delete a post (only by owner)
   */
  async deletePost(postId: string, userId: string): Promise<boolean> {
    const { db } = await import('../config/firebase');
    const collection = db.collection('posts');
    const doc = await collection.doc(postId).get();

    if (!doc.exists) {
      return false;
    }

    const post = doc.data() as PostDocument;
    if (post.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete another user\'s post');
    }

    await collection.doc(postId).delete();
    return true;
  }
}
