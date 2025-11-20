import { Request, Response } from 'express';
import { TelegramAuthService } from '../services/telegram-auth';
import { generateToken } from '../services/jwt';
import { MOCK_USER } from '../config/mock-user';

export async function authHandler(req: Request, res: Response): Promise<void> {
  try {
    // Extract initData from request body
    const { initData } = req.body;

    console.log('🔐 Auth attempt:', {
      hasInitData: !!initData,
      initDataLength: initData?.length || 0,
      initDataPreview: initData?.substring(0, 50) || 'none',
    });

    if (!initData) {
      res.status(400).json({ error: 'Missing initData' });
      return;
    }

    // DEV MODE: Check if this is a dev bypass request (not real Telegram data)
    if (process.env.DEV_BYPASS_AUTH === 'true' && initData === 'dev_mode_bypass') {
      console.log('⚠️  DEV MODE: Bypassing Telegram authentication for mock request');

      const token = generateToken({
        userId: MOCK_USER.id.toString(),
        username: MOCK_USER.username,
        firstName: MOCK_USER.first_name,
      });

      res.json({
        authenticated: true,
        token,
        user: MOCK_USER,
      });
      return;
    }

    // Real Telegram authentication (even if DEV_BYPASS_AUTH is true)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(500).json({ error: 'Bot token not configured' });
      return;
    }

    const authService = new TelegramAuthService(botToken);
    const user = await authService.validateInitData(initData);

    // Generate JWT token
    const token = generateToken({
      userId: user.id.toString(),
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
