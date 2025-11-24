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
      ...(imageUrl && { imageUrl }),
    };
    const collection = await this.getCollection();
    const docRef = await collection.add(postData);
    return { id: docRef.id, ...postData };
  }

  async getFeed(
    limit = 20,
    startAfter?: string
  ): Promise<{
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
    const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PostDocument);
    const hasMore = posts.length > limit;

    if (hasMore) posts.pop();

    return {
      posts,
      ...(hasMore && posts.length > 0 && { nextCursor: posts[posts.length - 1].id }),
    };
  }

  async getPost(postId: string): Promise<PostDocument | null> {
    const collection = await this.getCollection();
    const doc = await collection.doc(postId).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as PostDocument) : null;
  }

  async deletePost(postId: string, userId: string): Promise<boolean> {
    const collection = await this.getCollection();
    const doc = await collection.doc(postId).get();

    if (!doc.exists) return false;

    const post = doc.data() as PostDocument;
    if (post.userId !== userId) {
      throw new Error("Unauthorized: Cannot delete another user's post");
    }

    // Delete image from storage if exists
    if (post.imageUrl) {
      await this.storageService.deletePostImage(post.imageUrl);
    }

    await collection.doc(postId).delete();
    return true;
  }
}
