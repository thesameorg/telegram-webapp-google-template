import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(
    payload,
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
