import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.substring(7);

  if (!req.headers.authorization?.startsWith('Bearer ') || !token) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
