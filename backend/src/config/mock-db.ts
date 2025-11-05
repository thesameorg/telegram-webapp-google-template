// Mock in-memory database for development
import { PostDocument } from '../types';

class MockDatabase {
  private posts: Map<string, PostDocument> = new Map();
  private postIdCounter = 1;

  // Posts collection
  async createPost(postData: Omit<PostDocument, 'id'>): Promise<PostDocument> {
    const id = `post_${this.postIdCounter++}`;
    const post: PostDocument = { id, ...postData };
    this.posts.set(id, post);
    return post;
  }

  async getPosts(limit: number = 20, startAfter?: string): Promise<PostDocument[]> {
    let posts = Array.from(this.posts.values());

    // Sort by createdAt descending (newest first)
    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Handle pagination
    if (startAfter) {
      const startIndex = posts.findIndex(p => p.id === startAfter);
      if (startIndex >= 0) {
        posts = posts.slice(startIndex + 1);
      }
    }

    return posts.slice(0, limit);
  }

  async getPost(id: string): Promise<PostDocument | null> {
    return this.posts.get(id) || null;
  }

  async deletePost(id: string): Promise<boolean> {
    return this.posts.delete(id);
  }

  // Clear all data (for testing)
  clear() {
    this.posts.clear();
    this.postIdCounter = 1;
  }
}

export const mockDb = new MockDatabase();

// Add some sample posts for development
mockDb.createPost({
  userId: '123456789',
  content: 'Welcome to the dev server! This is a sample post.',
  createdAt: new Date().toISOString(),
  author: {
    username: 'devuser',
    firstName: 'Dev',
  }
});

mockDb.createPost({
  userId: '123456789',
  content: 'You can create new posts and they will be stored in memory. Perfect for testing!',
  createdAt: new Date(Date.now() - 60000).toISOString(),
  author: {
    username: 'devuser',
    firstName: 'Dev',
  }
});
