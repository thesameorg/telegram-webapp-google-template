# Local Development Quick Start

Two ways to run locally: **npm** (hot-reload) or **Docker** (production-like).

## Prerequisites

```bash
# Required
node --version  # >= 20.0.0
npm --version   # >= 9.0.0

# For Docker mode
docker --version

# For webhook testing
brew install ngrok jq
ngrok config add-authtoken YOUR_TOKEN
```

## Setup

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

---

## Mode 1: npm run dev

Best for development with hot-reload.

```bash
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- Auth bypass enabled via `DEV_BYPASS_AUTH=true` in `.env`

### With Telegram Webhook

```bash
npm run dev
npm run tunnel:start
npm run webhook:set
# Test bot in Telegram
```

---

## Mode 2: Docker

Best for testing production-like environment.

```bash
# Build image (first time or after code changes)
npm run docker:build

# Start container
npm run docker:start

# View logs
npm run docker:logs

# Stop container
npm run docker:stop
```

- App: http://localhost:8080 (frontend + API)
- Auth bypass enabled automatically

### Docker Commands

| Command | Description |
|---------|-------------|
| `npm run docker:build` | Build image |
| `npm run docker:start` | Start container |
| `npm run docker:stop` | Stop container |
| `npm run docker:logs` | View logs |
| `npm run docker:status` | Check status |

---

## Webhook Testing (Both Modes)

```bash
npm run tunnel:start      # Start ngrok
npm run webhook:set       # Configure Telegram
npm run webhook:status    # Check config
npm run tunnel:stop       # Stop ngrok
```

---

## Environment Variables

Required in `.env`:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
JWT_SECRET=your_jwt_secret
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# For local dev
DEV_BYPASS_AUTH=true
```

---

## Troubleshooting

**Port in use:**
```bash
lsof -i :8080
kill -9 <PID>
```

**Docker container issues:**
```bash
npm run docker:stop
npm run docker:start
```

**Firebase errors:** Ensure Firestore database is created in Firebase Console.
