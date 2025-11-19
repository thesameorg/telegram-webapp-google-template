import { Request, Response } from 'express';
import { TelegramAuthService } from '../services/telegram-auth';
import { generateToken } from '../services/jwt';

export async function authHandler(req: Request, res: Response): Promise<void> {
  try {
    // DEV MODE: Bypass Telegram authentication for local testing
    if (process.env.DEV_BYPASS_AUTH === 'true') {
      console.log('⚠️  DEV MODE: Bypassing Telegram authentication');
      const mockUser = {
        id: 123456789,
        first_name: 'Dev',
        last_name: 'User',
        username: 'devuser',
      };

      const token = generateToken({
        userId: mockUser.id.toString(),
        username: mockUser.username,
        firstName: mockUser.first_name,
      });

      res.json({
        authenticated: true,
        token,
        user: mockUser,
      });
      return;
    }

    // Production: Validate Telegram initData
    const { initData } = req.body;

    if (!initData) {
      res.status(400).json({ error: 'Missing initData' });
      return;
    }

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
