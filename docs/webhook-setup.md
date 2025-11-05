# Telegram Bot Webhook Setup

## Overview

Telegram bots can receive updates in two ways:
1. **Long Polling**: Bot actively requests updates from Telegram API
2. **Webhooks**: Telegram sends updates to your server via HTTP POST

We use **webhooks** because:
- ✅ No need for bot to run continuously polling
- ✅ Instant delivery of messages
- ✅ Works perfectly with Cloud Run's serverless model
- ✅ Lower latency for users

---

## Webhook Flow

```
User sends /start
    ↓
Telegram Server receives message
    ↓
Telegram POSTs to https://your-app.run.app/webhook
    ↓
Your backend processes the update
    ↓
Bot responds to user
```

---

## Implementation

### 1. Webhook Handler

```typescript
// backend/src/webhook.ts
import { Request, Response } from 'express';
import { Bot, webhookCallback, Context as GrammyContext } from 'grammy';

export async function handleWebhook(req: Request, res: Response) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(500).json({ error: 'Bot token not configured' });
  }

  const bot = new Bot(botToken);

  // Command: /start
  bot.command('start', async (ctx: GrammyContext) => {
    const webAppUrl = process.env.WEB_APP_URL || 'https://your-app.run.app';
    const firstName = ctx.from?.first_name || 'User';

    await ctx.reply(
      `👋 Welcome ${firstName}!\n\n` +
      `Open the app to start posting:`,
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
  bot.command('help', async (ctx: GrammyContext) => {
    await ctx.reply(
      '📖 Available Commands:\n\n' +
      '/start - Open the app\n' +
      '/help - Show this message\n\n' +
      'Use the app button to post messages!'
    );
  });

  // Handle text messages (non-commands)
  bot.on('message:text', async (ctx: GrammyContext) => {
    const text = ctx.message.text;

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
  return webhookCallback(bot, 'express')(req, res);
}
```

### 2. Register Webhook Route

```typescript
// backend/src/app.ts
import express from 'express';
import { handleWebhook } from './webhook';

const app = express();

// Webhook endpoint (NO auth middleware - Telegram calls this)
app.post('/webhook', handleWebhook);

// ... other routes
```

**Important**: Do NOT add authentication middleware to `/webhook` - Telegram needs to call it directly.

---

## Setting Up Webhook

### Local Development with ngrok

**Why ngrok?**
- Telegram requires HTTPS webhooks
- ngrok creates a public HTTPS tunnel to your local server
- Perfect for testing bot commands locally

**Setup**:

1. **Install ngrok**
```bash
# macOS
brew install ngrok

# Linux
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xvzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/
```

2. **Start your backend**
```bash
npm run dev
# Backend running on http://localhost:8787
```

3. **Start ngrok tunnel**
```bash
npm run tunnel:start
# or manually:
ngrok http 8787
```

Output:
```
Forwarding https://abc123.ngrok.io -> http://localhost:8787
```

4. **Set webhook**
```bash
npm run webhook:set
```

This script will:
- Get the ngrok public URL
- Call Telegram API to set webhook
- Configure allowed update types

**Manual webhook setup**:
```bash
TUNNEL_URL="https://abc123.ngrok.io"
BOT_TOKEN="your_bot_token"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${TUNNEL_URL}/webhook\",
    \"allowed_updates\": [\"message\"]
  }"
```

5. **Verify webhook**
```bash
npm run webhook:status
```

Output:
```json
{
  "url": "https://abc123.ngrok.io/webhook",
  "pending_updates": 0,
  "last_error": null,
  "allowed_updates": ["message"]
}
```

---

### Production Deployment (Cloud Run)

**After deploying to Cloud Run**:

```bash
# Get your Cloud Run URL
CLOUD_RUN_URL="https://twitter-app-xxx-uc.a.run.app"
BOT_TOKEN="your_bot_token"

# Set webhook
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${CLOUD_RUN_URL}/webhook\",
    \"allowed_updates\": [\"message\"],
    \"drop_pending_updates\": true
  }"
```

**Automated in GitHub Actions** (see deployment.md):
```yaml
# .github/workflows/deploy.yml
- name: Set Telegram webhook
  run: |
    WEBHOOK_URL="${{ vars.CLOUD_RUN_URL }}/webhook"

    curl -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/setWebhook" \
      -H "Content-Type: application/json" \
      -d "{
        \"url\": \"${WEBHOOK_URL}\",
        \"allowed_updates\": [\"message\"],
        \"drop_pending_updates\": true
      }"
```

---

## Webhook Scripts

### scripts/tunnel.sh

```bash
#!/bin/bash
# Tunnel management for local development

set -e

case "$1" in
  start)
    echo "🚇 Starting ngrok tunnel on port 8787..."

    # Check if ngrok is installed
    if ! command -v ngrok &> /dev/null; then
      echo "❌ ngrok not installed"
      echo "Install: brew install ngrok"
      exit 1
    fi

    # Check if already running
    if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
      echo "⚠️  Tunnel already running"
      TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
      echo "URL: $TUNNEL_URL"
      exit 0
    fi

    # Start ngrok in background
    ngrok http 8787 > /dev/null &
    sleep 2

    # Get tunnel URL
    TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
    echo "✅ Tunnel started: $TUNNEL_URL"
    echo ""
    echo "Next steps:"
    echo "  1. npm run webhook:set"
    echo "  2. Test bot in Telegram"
    ;;

  stop)
    echo "🛑 Stopping ngrok tunnel..."
    pkill ngrok || echo "No ngrok process found"
    echo "✅ Stopped"
    ;;

  status)
    if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
      TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
      echo "✅ Tunnel running: $TUNNEL_URL"
    else
      echo "❌ Tunnel not running"
      echo "Start: npm run tunnel:start"
    fi
    ;;

  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
```

### scripts/webhook.sh

```bash
#!/bin/bash
# Webhook management script

set -e

# Load environment variables
if [ -f .env ]; then
  source .env
fi

# Check bot token
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "❌ TELEGRAM_BOT_TOKEN not set in .env"
  exit 1
fi

TELEGRAM_API="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

get_tunnel_url() {
  curl -s http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[0].public_url' 2>/dev/null || echo ""
}

case "$1" in
  set)
    echo "🔗 Setting webhook..."

    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
      echo "❌ jq not installed: brew install jq"
      exit 1
    fi

    # Get tunnel URL
    TUNNEL_URL=$(get_tunnel_url)
    if [ -z "$TUNNEL_URL" ] || [ "$TUNNEL_URL" == "null" ]; then
      echo "❌ Tunnel not running"
      echo "Start tunnel: npm run tunnel:start"
      exit 1
    fi

    WEBHOOK_URL="${TUNNEL_URL}/webhook"
    echo "Setting webhook to: $WEBHOOK_URL"

    RESPONSE=$(curl -s -X POST "${TELEGRAM_API}/setWebhook" \
      -H "Content-Type: application/json" \
      -d "{
        \"url\": \"${WEBHOOK_URL}\",
        \"allowed_updates\": [\"message\"]
      }")

    if echo "$RESPONSE" | jq -e '.ok' > /dev/null 2>&1; then
      echo "✅ Webhook set successfully!"
    else
      echo "❌ Failed to set webhook:"
      echo "$RESPONSE" | jq '.'
      exit 1
    fi
    ;;

  status)
    echo "🔍 Checking webhook status..."

    RESPONSE=$(curl -s "${TELEGRAM_API}/getWebhookInfo")

    if ! command -v jq &> /dev/null; then
      echo "$RESPONSE"
      exit 0
    fi

    echo "$RESPONSE" | jq '{
      url: .result.url,
      pending_updates: .result.pending_update_count,
      last_error: .result.last_error_message,
      allowed_updates: .result.allowed_updates
    }'

    # Check if matches tunnel
    TUNNEL_URL=$(get_tunnel_url)
    if [ -n "$TUNNEL_URL" ] && [ "$TUNNEL_URL" != "null" ]; then
      WEBHOOK_URL=$(echo "$RESPONSE" | jq -r '.result.url')
      EXPECTED="${TUNNEL_URL}/webhook"

      echo ""
      echo "🌐 Local tunnel: $TUNNEL_URL"
      if [ "$WEBHOOK_URL" == "$EXPECTED" ]; then
        echo "✅ Webhook matches tunnel"
      else
        echo "⚠️  Mismatch - run: npm run webhook:set"
      fi
    fi
    ;;

  clear)
    echo "🧹 Clearing webhook..."

    RESPONSE=$(curl -s -X POST "${TELEGRAM_API}/deleteWebhook")

    if echo "$RESPONSE" | jq -e '.ok' > /dev/null 2>&1; then
      echo "✅ Webhook cleared"
    else
      echo "❌ Failed:"
      echo "$RESPONSE" | jq '.'
      exit 1
    fi
    ;;

  *)
    echo "Usage: $0 {set|status|clear}"
    echo ""
    echo "Commands:"
    echo "  set     - Set webhook to ngrok tunnel"
    echo "  status  - Check current webhook"
    echo "  clear   - Remove webhook"
    exit 1
    ;;
esac
```

**Make scripts executable**:
```bash
chmod +x scripts/tunnel.sh
chmod +x scripts/webhook.sh
```

---

## Testing Webhook

### 1. Start Development Environment

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Tunnel
npm run tunnel:start

# Terminal 3: Set webhook
npm run webhook:set
```

### 2. Test in Telegram

1. Open your bot in Telegram
2. Send `/start` command
3. Should receive welcome message with WebApp button
4. Check backend logs for webhook activity:

```
POST /webhook 200 - 45ms
Bot received: /start from @username
```

### 3. Common Issues

**Webhook not receiving updates**:
```bash
# Check webhook status
npm run webhook:status

# Output should show your ngrok URL
{
  "url": "https://abc123.ngrok.io/webhook",
  "pending_updates": 0
}
```

**"Tunnel not running" error**:
```bash
# Check if ngrok is running
curl http://localhost:4040/api/tunnels

# If not, start it
npm run tunnel:start
```

**Bot not responding**:
```bash
# Check backend logs
# Should see: POST /webhook requests

# Check for errors in webhook handler
# Add more logging to backend/src/webhook.ts
```

---

## Webhook Security

### Verify Requests from Telegram

**Option 1**: Check source IP (Telegram webhook IPs)
```typescript
// backend/src/webhook.ts
const TELEGRAM_IPS = [
  '149.154.160.0/20',
  '91.108.4.0/22',
];

export async function handleWebhook(c: Context) {
  const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');

  // Verify IP is from Telegram (simplified - use CIDR matching in production)
  // ... IP validation logic

  // Process webhook
}
```

**Option 2**: Use secret token (Telegram Bot API 6.0+)
```typescript
// Set webhook with secret
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "secret_token=your_random_secret"

// Verify in webhook handler
export async function handleWebhook(c: Context) {
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');

  if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Process webhook
}
```

---

## Advanced: Multiple Update Types

For future features (comments, likes), you might want other update types:

```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"allowed_updates\": [
      \"message\",
      \"callback_query\",
      \"inline_query\"
    ]
  }"
```

**Handle different update types**:
```typescript
// backend/src/webhook.ts
bot.on('callback_query', async (ctx) => {
  // User clicked inline button
  await ctx.answerCallbackQuery();
  await ctx.reply('Button clicked!');
});

bot.on('inline_query', async (ctx) => {
  // User typed @yourbot query in any chat
  await ctx.answerInlineQuery([/* results */]);
});
```

---

## Monitoring

### Check Webhook Health

```bash
# Get webhook info
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
```

**Important fields**:
- `pending_update_count`: Should be 0 (no backlog)
- `last_error_date`: Should be null
- `last_error_message`: Should be null

**If `pending_update_count > 0`**:
- Your webhook is not responding fast enough
- Check backend logs for errors
- Consider scaling Cloud Run instances

---

## References

- [Telegram Bot API: setWebhook](https://core.telegram.org/bots/api#setwebhook)
- [Grammy.js Webhooks](https://grammy.dev/guide/deployment-types.html#webhooks)
- [ngrok Documentation](https://ngrok.com/docs)
