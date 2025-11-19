# Local Development Guide

This document describes how to run the Telegram WebApp Google Template locally for development and testing.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Development Modes](#development-modes)
  - [Mode 1: npm run dev (Direct Node.js)](#mode-1-npm-run-dev-direct-nodejs)
  - [Mode 2: Docker Container](#mode-2-docker-container)
- [Ngrok Tunnel Setup](#ngrok-tunnel-setup)
- [Webhook Configuration](#webhook-configuration)
- [Auth Bypass for Development](#auth-bypass-for-development)
- [Testing Workflows](#testing-workflows)
- [Troubleshooting](#troubleshooting)

---

## Overview

The application consists of:
- **Backend**: Express.js API server (port 8080)
- **Frontend**: React + Vite SPA (port 3000 in dev, served by backend in production)

Two development modes are supported:
1. **npm run dev**: Direct Node.js execution with hot-reload
2. **Docker container**: Production-like environment locally

Both modes support ngrok tunneling for Telegram webhook testing.

---

## Prerequisites

### Required Software

```bash
# Node.js 20+
node --version  # Should be >= 20.0.0

# npm 9+
npm --version   # Should be >= 9.0.0

# Docker (for Mode 2)
docker --version

# ngrok (for webhook testing)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# jq (for JSON parsing in scripts)
brew install jq
```

### ngrok Setup

1. Create free account at [ngrok.com](https://ngrok.com)
2. Get your auth token from the dashboard
3. Configure ngrok:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

---

## Environment Setup

### 1. Copy Environment Template

```bash
cp .env.example .env
```

### 2. Configure Required Variables

```bash
# .env file

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your_jwt_secret_here

# Firebase/Firestore Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Development Settings
NODE_ENV=development
DEV_BYPASS_AUTH=true  # Enable auth bypass for local testing
```

### 3. Environment Variable Details

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `FIREBASE_PROJECT_ID` | Yes* | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes* | Service account email |
| `FIREBASE_PRIVATE_KEY` | Yes* | Service account private key |
| `NODE_ENV` | No | Set to `development` for dev mode |
| `DEV_BYPASS_AUTH` | No | Set to `true` to skip Telegram auth |
| `WEB_APP_URL` | No | Set to ngrok URL when testing |

*Not required if `DEV_BYPASS_AUTH=true` (uses mock database)

---

## Development Modes

### Mode 1: npm run dev (Direct Node.js)

Best for rapid development with hot-reload.

#### Start Development Servers

```bash
# Install dependencies
npm install

# Start both backend (8080) and frontend (3000)
npm run dev
```

This runs:
- Backend: `tsx watch` on port 8080 with hot-reload
- Frontend: Vite dev server on port 3000 with HMR

#### Individual Services

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend
```

#### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health check**: http://localhost:8080/health

The frontend proxies `/api` and `/webhook` requests to the backend automatically (configured in `vite.config.ts`).

---

### Mode 2: Docker Container

Best for testing production-like environment.

#### Build Docker Image

```bash
# Build the image
docker build -t telegram-webapp-google .
```

#### Run Container with Environment Variables

```bash
# Option 1: Use .env file
docker run -p 8080:8080 --env-file .env telegram-webapp-google

# Option 2: Pass individual variables
docker run -p 8080:8080 \
  -e NODE_ENV=development \
  -e DEV_BYPASS_AUTH=true \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -e JWT_SECRET=your_secret \
  telegram-webapp-google
```

#### Docker with Live Code (Development)

For development with volume mounting (no rebuild needed):

```bash
# Create a docker-compose.dev.yml for easier management
docker run -p 8080:8080 \
  --env-file .env \
  -v $(pwd)/backend/src:/app/src:ro \
  telegram-webapp-google
```

Note: The production Docker image serves frontend from `/public`. For true hot-reload, use Mode 1.

#### Access Points

- **App**: http://localhost:8080
- **Health check**: http://localhost:8080/health

---

## Ngrok Tunnel Setup

Ngrok creates a public URL that tunnels to your local server, enabling Telegram webhook testing.

### Start Tunnel

```bash
npm run tunnel:start
```

Output:
```
🚇 Starting ngrok tunnel on port 8080...
✅ Tunnel started: https://abc123.ngrok-free.app

Next steps:
  1. npm run webhook:set
  2. Test bot in Telegram
```

### Check Tunnel Status

```bash
npm run tunnel:status
```

### Stop Tunnel

```bash
npm run tunnel:stop
```

### Manual ngrok Access

- **Web Interface**: http://localhost:4040 (inspect requests)
- **API**: http://localhost:4040/api/tunnels

---

## Webhook Configuration

Configure Telegram to send bot updates to your ngrok tunnel.

### Set Webhook

```bash
npm run webhook:set
```

This automatically:
1. Gets your current ngrok URL
2. Sets Telegram webhook to `{NGROK_URL}/webhook`

### Check Webhook Status

```bash
npm run webhook:status
```

Output:
```json
{
  "url": "https://abc123.ngrok-free.app/webhook",
  "pending_updates": 0,
  "last_error": null,
  "allowed_updates": ["message"]
}

🌐 Local tunnel: https://abc123.ngrok-free.app
✅ Webhook matches tunnel
```

### Clear Webhook

```bash
npm run webhook:clear
```

---

## Auth Bypass for Development

The auth bypass allows local testing without real Telegram authentication.

### Enable Auth Bypass

In your `.env` file:

```bash
NODE_ENV=development
DEV_BYPASS_AUTH=true
```

### How It Works

**Backend** (`backend/src/api/auth.ts`):
- When `DEV_BYPASS_AUTH=true`, skips Telegram signature validation
- Returns mock user:
  ```javascript
  {
    id: 123456789,
    first_name: 'Dev',
    last_name: 'User',
    username: 'devuser'
  }
  ```

**Frontend** (`frontend/src/lib/telegram.ts`):
- Detects if running outside Telegram (`WebApp.initData.length === 0`)
- Uses mock WebApp object with mock user data
- Allows testing the full UI flow

**Database**:
- Uses mock in-memory database when auth bypass is enabled
- See `backend/src/config/mock-db.ts` for pre-loaded sample data

### Testing with Auth Bypass

1. Start dev server: `npm run dev`
2. Open http://localhost:3000 in browser
3. App automatically authenticates as "Dev User"
4. Create posts, interact with UI normally

---

## Testing Workflows

### Workflow 1: Pure Local Development (No Telegram)

Best for UI/UX development and feature testing.

```bash
# 1. Configure environment
cp .env.example .env
# Set DEV_BYPASS_AUTH=true

# 2. Start servers
npm run dev

# 3. Open in browser
open http://localhost:3000
```

### Workflow 2: Local with Telegram Webhook

Best for testing bot interactions and real Telegram auth.

```bash
# 1. Configure environment (disable auth bypass)
# DEV_BYPASS_AUTH should be false or commented out

# 2. Start servers
npm run dev

# 3. Start tunnel
npm run tunnel:start

# 4. Set webhook
npm run webhook:set

# 5. Open bot in Telegram
# Send /start command
# Click "Open App" button
```

### Workflow 3: Docker with Telegram

Best for testing production-like environment.

```bash
# 1. Build image
docker build -t telegram-webapp-google .

# 2. Run container
docker run -p 8080:8080 --env-file .env telegram-webapp-google

# 3. Start tunnel
npm run tunnel:start

# 4. Set webhook
npm run webhook:set

# 5. Test in Telegram
```

---

## Complete Local Development Workflow

Here's the full workflow for development:

```bash
# Initial Setup (once)
npm install
cp .env.example .env
# Edit .env with your credentials

# Daily Development
npm run dev                    # Start servers
npm run tunnel:start           # Start ngrok (if testing webhooks)
npm run webhook:set            # Configure Telegram (if testing webhooks)

# Development cycle
# - Make changes
# - Hot-reload handles updates
# - Test in browser or Telegram

# End of session
npm run tunnel:stop            # Stop ngrok
npm run webhook:clear          # Clear webhook (optional)
Ctrl+C                         # Stop servers
```

---

## Troubleshooting

### Common Issues

#### "ngrok not installed"

```bash
brew install ngrok  # macOS
# or download from https://ngrok.com/download
```

#### "jq not installed"

```bash
brew install jq     # macOS
apt-get install jq  # Linux
```

#### "TELEGRAM_BOT_TOKEN not set"

Ensure your `.env` file has:
```bash
TELEGRAM_BOT_TOKEN=your_actual_token_here
```

#### "Tunnel already running"

```bash
npm run tunnel:stop
npm run tunnel:start
```

#### Webhook not receiving updates

1. Check tunnel is running: `npm run tunnel:status`
2. Check webhook matches tunnel: `npm run webhook:status`
3. Verify in ngrok dashboard: http://localhost:4040

#### Firebase connection errors

If not using Firebase, enable auth bypass:
```bash
DEV_BYPASS_AUTH=true
```

If using Firebase, verify credentials are correct in `.env`.

#### Port already in use

```bash
# Find process using port 8080
lsof -i :8080

# Kill it
kill -9 <PID>
```

#### Docker container can't read .env

Ensure you're passing environment variables:
```bash
docker run -p 8080:8080 --env-file .env telegram-webapp-google
```

### Debug Logging

Enable verbose logging:

```bash
# Backend: Check console output for:
# ⚠️  DEV MODE: Bypassing Telegram authentication
# ⚠️  Not running in Telegram - using mock data for development

# Frontend: Open browser DevTools console
# Look for: 📱 Mock Telegram ready
```

### ngrok Request Inspector

View all requests at http://localhost:4040:
- Inspect incoming webhooks
- Replay failed requests
- View response times

---

## Architecture Summary

```
┌─────────────────┐     ┌─────────────────┐
│   Browser       │     │   Telegram      │
│   :3000 (dev)   │     │   Bot/WebApp    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       │ (webhook)
         │ (vite proxy)          │
         ▼                       ▼
┌─────────────────────────────────────────┐
│          ngrok tunnel                   │
│     https://xxx.ngrok-free.app          │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│        Backend Express Server           │
│              :8080                       │
│  ┌─────────────────────────────────┐    │
│  │ /webhook - Telegram updates     │    │
│  │ /api/auth - Authentication      │    │
│  │ /api/posts - CRUD operations    │    │
│  │ /health - Health check          │    │
│  └─────────────────────────────────┘    │
│                 │                       │
│    ┌────────────┴────────────┐         │
│    │   DEV_BYPASS_AUTH?      │         │
│    ├───────────┬─────────────┤         │
│    │  Yes      │     No      │         │
│    ▼           │     ▼       │         │
│  Mock DB    Firebase/Firestore         │
└─────────────────────────────────────────┘
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run tunnel:start` | Start ngrok tunnel |
| `npm run tunnel:stop` | Stop ngrok tunnel |
| `npm run tunnel:status` | Check tunnel status |
| `npm run webhook:set` | Set Telegram webhook |
| `npm run webhook:status` | Check webhook config |
| `npm run webhook:clear` | Remove webhook |
| `npm run build` | Build for production |
| `npm run typecheck` | Run TypeScript checks |

---

## Future Improvements

Based on the Cloudflare template, consider adding:

1. **docker-compose.yml** for easier Docker management
2. **npm run stop** command to kill all dev processes
3. **Database migrations** for Firestore schema management
4. **Test coverage** for auth bypass and mock database
