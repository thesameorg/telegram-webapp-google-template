import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const SECRET = process.env.JWT_SECRET;

export const generateToken = (payload: JWTPayload): string =>
  jwt.sign(payload, SECRET, { expiresIn: '7d' });

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, SECRET) as JWTPayload;
  } catch {
    throw new Error('Invalid or expired token');
  }
};
