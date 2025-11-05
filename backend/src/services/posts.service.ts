import { db } from '../config/firebase';
import type { PostDocument } from '../types';

export class PostsService {
  private readonly collection = db.collection('posts');

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

    const docRef = await this.collection.add(postData);
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
    let query = this.collection
      .orderBy('createdAt', 'desc')
      .limit(limit + 1); // Get one extra to check if there are more

    if (startAfter) {
      const startDoc = await this.collection.doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    const snapshot = await query.get();
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as PostDocument));

    // Check if there are more posts
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop(); // Remove the extra post
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
    const doc = await this.collection.doc(postId).get();

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
    const doc = await this.collection.doc(postId).get();

    if (!doc.exists) {
      return false;
    }

    const post = doc.data() as PostDocument;
    if (post.userId !== userId) {
      throw new Error('Unauthorized: Cannot delete another user\'s post');
    }

    await this.collection.doc(postId).delete();
    return true;
  }
}
