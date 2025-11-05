import { useState, useEffect } from 'react';
import { getFeed, deletePost, Post as PostType } from '../lib/api';
import { Post } from './Post';
import { PostForm } from './PostForm';
import { getUser } from '../lib/telegram';

export function Feed() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentUser = getUser();

  const loadFeed = async (cursor?: string) => {
    try {
      const data = await getFeed(20, cursor);
      if (cursor) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handlePostCreated = () => {
    // Reload feed from beginning
    setLoading(true);
    loadFeed();
  };

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete post');
    }
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      setLoadingMore(true);
      loadFeed(nextCursor);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading feed...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              loadFeed();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Feed</h1>

      <PostForm onPostCreated={handlePostCreated} />

      {posts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No posts yet. Be the first to post!
        </div>
      )}

      {posts.map(post => (
        <Post
          key={post.id}
          post={post}
          currentUserId={currentUser?.id.toString()}
          onDelete={handleDelete}
        />
      ))}

      {nextCursor && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
