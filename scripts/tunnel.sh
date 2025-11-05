#!/bin/bash
# Tunnel management for local development

set -e

case "$1" in
  start)
    echo "🚇 Starting ngrok tunnel on port 8080..."

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
    ngrok http 8080 > /dev/null &
    sleep 2

    # Get tunnel URL
    if ! command -v jq &> /dev/null; then
      echo "⚠️  jq not installed (recommended for parsing tunnel URL)"
      echo "Install: brew install jq"
      echo "Check tunnel URL at: http://localhost:4040"
    else
      TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
      echo "✅ Tunnel started: $TUNNEL_URL"
    fi

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
      if command -v jq &> /dev/null; then
        TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
        echo "✅ Tunnel running: $TUNNEL_URL"
      else
        echo "✅ Tunnel running (check http://localhost:4040 for URL)"
      fi
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
