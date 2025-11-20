import { Request, Response } from 'express';
import { Bot, webhookCallback, Context } from 'grammy';

const createBot = (webAppUrl: string) => {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

  bot.command('start', async (ctx: Context) => {
    await ctx.reply(
      `👋 Welcome ${ctx.from?.first_name || 'User'}!\n\nOpen the app to start posting and see the global feed!`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🚀 Open App', web_app: { url: webAppUrl } }]]
        }
      }
    );
  });

  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      '📖 Available Commands:\n\n/start - Open the app\n/help - Show this message\n\nUse the app button to post messages and see the feed!'
    );
  });

  bot.on('message:text', async (ctx: Context) => {
    if (!ctx.message?.text?.startsWith('/')) {
      await ctx.reply('Please use the app to post messages!\n\nClick /start to open the app.');
    }
  });

  bot.catch((err) => console.error('Bot error:', err));

  return bot;
};

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return void res.status(500).json({ error: 'Bot token not configured' });
  }

  const webAppUrl = process.env.WEB_APP_URL || 'https://your-app.run.app';
  const bot = createBot(webAppUrl);
  await webhookCallback(bot, 'express')(req, res);
}
