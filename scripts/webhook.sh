#!/bin/bash
# Webhook management script

set -e

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
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
