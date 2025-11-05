import { Request, Response } from 'express';
import { Bot, webhookCallback, Context } from 'grammy';

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(500).json({ error: 'Bot token not configured' });
    return;
  }

  const bot = new Bot(botToken);
  const webAppUrl = process.env.WEB_APP_URL || 'https://your-app.run.app';

  // Command: /start
  bot.command('start', async (ctx: Context) => {
    const firstName = ctx.from?.first_name || 'User';

    await ctx.reply(
      `👋 Welcome ${firstName}!\n\n` +
      `Open the app to start posting and see the global feed!`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🚀 Open App',
              web_app: { url: webAppUrl }
            }
          ]]
        }
      }
    );
  });

  // Command: /help
  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      '📖 Available Commands:\n\n' +
      '/start - Open the app\n' +
      '/help - Show this message\n\n' +
      'Use the app button to post messages and see the feed!'
    );
  });

  // Handle text messages (non-commands)
  bot.on('message:text', async (ctx: Context) => {
    const text = ctx.message?.text;

    // Ignore commands (handled above)
    if (text?.startsWith('/')) {
      return;
    }

    // Respond to regular messages
    await ctx.reply(
      'Please use the app to post messages!\n\n' +
      'Click /start to open the app.'
    );
  });

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  // Use Grammy's webhook callback for Express
  const callback = webhookCallback(bot, 'express');
  await callback(req, res);
}
