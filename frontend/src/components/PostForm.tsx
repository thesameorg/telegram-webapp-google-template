import { useState } from 'react';
import { createPost, uploadImage } from '../lib/api';
import { Button } from './ui';
import { ImageUpload } from './ImageUpload';
import { POST_CHARACTER_LIMIT } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';

interface PostFormProps {
  onPostCreated: () => void;
}

export function PostForm({ onPostCreated }: PostFormProps) {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && !selectedImage) {
      setError('Post must have content or an image');
      return;
    }

    if (content.length > POST_CHARACTER_LIMIT) {
      setError(`Post is too long (max ${POST_CHARACTER_LIMIT} characters)`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | undefined;

      // Upload image first if selected
      if (selectedImage) {
        const uploadResult = await uploadImage(selectedImage);
        imageUrl = uploadResult.imageUrl;
      }

      // Create post with optional image
      await createPost(content, imageUrl);

      setContent('');
      setSelectedImage(null);
      onPostCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingChars = POST_CHARACTER_LIMIT - content.length;
  const isValid = (content.trim() || selectedImage) && content.length <= POST_CHARACTER_LIMIT;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <form onSubmit={handleSubmit}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening?"
          className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          disabled={isSubmitting}
        />

        <div className="mt-3">
          <ImageUpload
            onImageSelect={setSelectedImage}
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-between items-center mt-3">
          <span className={`text-sm ${remainingChars < 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {remainingChars} characters remaining
          </span>
          <Button type="submit" disabled={isSubmitting || !isValid}>
            {isSubmitting ? 'Posting...' : 'Post'}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </form>
    </div>
  );
}
