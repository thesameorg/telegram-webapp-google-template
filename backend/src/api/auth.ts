import { Request, Response } from 'express';
import { TelegramAuthService } from '../services/telegram-auth';
import { generateToken } from '../services/jwt';
import { db } from '../config/firebase';

export async function authHandler(req: Request, res: Response): Promise<void> {
  try {
    // Parse request body
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({ error: 'Missing initData' });
      return;
    }

    // Validate initData
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(500).json({ error: 'Bot token not configured' });
      return;
    }

    const authService = new TelegramAuthService(botToken);
    const user = await authService.validateInitData(initData);

    // Save/update user in Firestore
    const userId = user.id.toString();
    const userDoc = {
      id: userId,
      username: user.username || '',
      firstName: user.first_name,
      lastName: user.last_name || '',
      photoUrl: user.photo_url || '',
      languageCode: user.language_code || 'en',
      isPremium: user.is_premium || false,
      updatedAt: new Date().toISOString(),
    };

    const userRef = db.collection('users').doc(userId);
    const existingUser = await userRef.get();

    if (existingUser.exists) {
      await userRef.update(userDoc);
    } else {
      await userRef.set({
        ...userDoc,
        createdAt: new Date().toISOString(),
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId,
      username: user.username || '',
      firstName: user.first_name,
    });

    res.json({
      authenticated: true,
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        photoUrl: user.photo_url,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
}
