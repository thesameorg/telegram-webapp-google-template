import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload; // Attach user to request
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
