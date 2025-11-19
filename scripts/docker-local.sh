#!/bin/bash
# Run Docker container locally with environment variables

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONTAINER_NAME="telegram-webapp-local"
IMAGE_NAME="telegram-webapp-google"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
else
  echo "❌ .env file not found"
  exit 1
fi

case "$1" in
  build)
    echo "🔨 Building Docker image..."
    docker build -t "$IMAGE_NAME" "$PROJECT_DIR"
    echo "✅ Image built: $IMAGE_NAME"
    ;;

  start)
    echo "🚀 Starting Docker container..."

    # Stop existing container if running
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
      echo "⚠️  Stopping existing container..."
      docker stop "$CONTAINER_NAME" > /dev/null
      docker rm "$CONTAINER_NAME" > /dev/null
    elif docker ps -aq -f name="$CONTAINER_NAME" | grep -q .; then
      docker rm "$CONTAINER_NAME" > /dev/null
    fi

    # Run container with environment variables
    # NODE_ENV=production to serve frontend static files
    # DEV_BYPASS_AUTH=true to bypass Telegram auth for local testing
    docker run -d \
      --name "$CONTAINER_NAME" \
      -p 8080:8080 \
      -e NODE_ENV=production \
      -e DEV_BYPASS_AUTH=true \
      -e TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
      -e JWT_SECRET="$JWT_SECRET" \
      -e FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
      -e FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
      -e FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
      -e WEB_APP_URL="$WEB_APP_URL" \
      "$IMAGE_NAME"

    echo "✅ Container started: $CONTAINER_NAME"
    echo "🌐 App: http://localhost:8080"
    echo ""
    echo "Commands:"
    echo "  npm run docker:logs    - View logs"
    echo "  npm run docker:stop    - Stop container"
    ;;

  stop)
    echo "🛑 Stopping Docker container..."
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
      docker stop "$CONTAINER_NAME" > /dev/null
      docker rm "$CONTAINER_NAME" > /dev/null
      echo "✅ Container stopped"
    else
      echo "⚠️  Container not running"
    fi
    ;;

  logs)
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
      docker logs -f "$CONTAINER_NAME"
    else
      echo "❌ Container not running"
      exit 1
    fi
    ;;

  status)
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
      echo "✅ Container running"
      docker ps -f name="$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
      echo "❌ Container not running"
    fi
    ;;

  *)
    echo "Usage: $0 {build|start|stop|logs|status}"
    echo ""
    echo "Commands:"
    echo "  build   - Build Docker image"
    echo "  start   - Start container (with auth bypass)"
    echo "  stop    - Stop container"
    echo "  logs    - View container logs"
    echo "  status  - Check container status"
    exit 1
    ;;
esac
