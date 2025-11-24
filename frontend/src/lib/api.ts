import { STORAGE_KEYS, FEED_PAGE_SIZE } from './constants';

const API_BASE = '/api';

export interface User {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  author: {
    username: string;
    firstName: string;
    photoUrl?: string;
  };
}

export interface AuthResponse {
  authenticated: boolean;
  token: string;
  user: User;
}

export interface FeedResponse {
  posts: Post[];
  nextCursor?: string;
}

const handleApiError = async (response: Response, defaultMsg: string) => {
  const error = await response.json();
  throw new Error(error.error || defaultMsg);
};

export async function authenticate(initData: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!response.ok) await handleApiError(response, 'Authentication failed');
  return response.json();
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(STORAGE_KEYS.JWT);

  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.JWT);
    window.location.reload();
    throw new Error('Session expired');
  }

  return response;
}

export async function getFeed(
  limit: number = FEED_PAGE_SIZE,
  startAfter?: string
): Promise<FeedResponse> {
  const url = `${API_BASE}/posts?limit=${limit}${startAfter ? `&startAfter=${startAfter}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) await handleApiError(response, 'Failed to fetch feed');
  return response.json();
}

export async function uploadImage(imageFile: File): Promise<{ imageUrl: string }> {
  const token = localStorage.getItem(STORAGE_KEYS.JWT);
  if (!token) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${API_BASE}/upload/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.JWT);
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!response.ok) await handleApiError(response, 'Failed to upload image');
  return response.json();
}

export async function createPost(content: string, imageUrl?: string): Promise<{ post: Post }> {
  const response = await fetchWithAuth('/posts', {
    method: 'POST',
    body: JSON.stringify({ content, imageUrl }),
  });

  if (!response.ok) await handleApiError(response, 'Failed to create post');
  return response.json();
}

export async function deletePost(postId: string): Promise<{ success: boolean }> {
  const response = await fetchWithAuth(`/posts/${postId}`, {
    method: 'DELETE',
  });

  if (!response.ok) await handleApiError(response, 'Failed to delete post');
  return response.json();
}
