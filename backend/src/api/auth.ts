import { Request, Response } from 'express';
import { TelegramAuthService } from '../services/telegram-auth';
import { generateToken } from '../services/jwt';
import { MOCK_USER } from '../config/mock-user';
import type { TelegramUser } from '../types';

const buildAuthResponse = (user: TelegramUser) => {
  const token = generateToken({
    userId: user.id.toString(),
    username: user.username || '',
    firstName: user.first_name,
  });

  return {
    authenticated: true,
    token,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      photoUrl: user.photo_url,
    },
  };
};

const isDevelopmentBypass = (initData: string) =>
  process.env.DEV_BYPASS_AUTH === 'true' && initData === 'dev_mode_bypass';

export async function authHandler(req: Request, res: Response): Promise<void> {
  try {
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({ error: 'Missing initData' });
      return;
    }

    // Development bypass
    if (isDevelopmentBypass(initData)) {
      console.log('⚠️  DEV MODE: Bypassing Telegram authentication');
      res.json(buildAuthResponse(MOCK_USER));
      return;
    }

    // Real Telegram authentication
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(500).json({ error: 'Bot token not configured' });
      return;
    }

    const authService = new TelegramAuthService(botToken);
    const user = await authService.validateInitData(initData);

    res.json(buildAuthResponse(user));
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
}
