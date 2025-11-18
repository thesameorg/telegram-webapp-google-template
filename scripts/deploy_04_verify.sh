#!/bin/bash

# Verify deployment and set webhook

set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

set -a
source .env
set +a

echo "========================================"
echo "Verifying Deployment"
echo "========================================"

# Get Cloud Run URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$GCP_REGION" \
  --format='value(status.url)')

echo "Service URL: $SERVICE_URL"

# Health check
echo ""
echo "Checking health endpoint..."
sleep 5

HEALTH=$(curl -s "${SERVICE_URL}/health" || echo '{"status":"error"}')
echo "Health response: $HEALTH"

if echo "$HEALTH" | grep -q '"status":"ok"'; then
    echo "Service is healthy!"
else
    echo "Warning: Service health check failed"
fi

# Set Telegram Webhook
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ "$WEB_APP_URL" != "placeholder" ]; then
    echo ""
    echo "Setting Telegram webhook..."
    WEBHOOK_URL="${SERVICE_URL}/webhook"

    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{
            \"url\": \"${WEBHOOK_URL}\",
            \"allowed_updates\": [\"message\"],
            \"drop_pending_updates\": true
        }")

    if echo "$RESPONSE" | grep -q '"ok":true'; then
        echo "Webhook configured: ${WEBHOOK_URL}"
    else
        echo "Webhook configuration failed:"
        echo "$RESPONSE"
    fi
fi

echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo "Service:  ${SERVICE_NAME}"
echo "Region:   ${GCP_REGION}"
echo "URL:      ${SERVICE_URL}"
echo ""
echo "Next Steps:"
echo "1. Update WEB_APP_URL in .env to: ${SERVICE_URL}"
echo "2. Test bot: Send /start to your Telegram bot"
echo "3. Check logs: gcloud run logs tail ${SERVICE_NAME} --region=${GCP_REGION}"
echo "========================================"
