import { useState, useEffect } from 'react';
import { getFeed, deletePost, Post as PostType } from '../lib/api';
import { Post } from './Post';
import { PostForm } from './PostForm';
import { getUser } from '../lib/telegram';
import { Loading, ErrorMessage, Button } from './ui';
import { FEED_PAGE_SIZE } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';

export function Feed() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  const currentUser = getUser();

  const loadFeed = async (cursor?: string) => {
    try {
      const data = await getFeed(FEED_PAGE_SIZE, cursor);
      setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handlePostCreated = () => {
    setLoading(true);
    loadFeed();
  };

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      setLoadingMore(true);
      loadFeed(nextCursor);
    }
  };

  if (loading) return <Loading message="Loading feed..." />;
  if (error)
    return (
      <ErrorMessage
        message={error}
        onRetry={() => {
          setLoading(true);
          loadFeed();
        }}
      />
    );

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Feed</h1>

      <PostForm onPostCreated={handlePostCreated} />

      {posts.length === 0 && (
        <div className="text-center py-8 text-gray-500">No posts yet. Be the first to post!</div>
      )}

      {posts.map((post) => (
        <Post
          key={post.id}
          post={post}
          currentUserId={currentUser?.id.toString()}
          onDelete={handleDelete}
        />
      ))}

      {nextCursor && (
        <div className="text-center mt-4">
          <Button onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
