// Telegram User from initData
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  username: string;
  firstName: string;
  photoUrl?: string;
}


// Post Document
export interface PostDocument {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  author: {
    username: string;
    firstName: string;
    photoUrl?: string;
  };
}

// Express Request with User
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}
