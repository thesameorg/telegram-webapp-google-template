import { Post as PostType } from '../lib/api';
import { formatRelativeDate } from '../lib/utils';

interface PostProps {
  post: PostType;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
}

export function Post({ post, currentUserId, onDelete }: PostProps) {
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
            <p className="mt-1 text-gray-800 whitespace-pre-wrap">{post.content}</p>
          </div>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-sm ml-2"
            title="Delete post"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
