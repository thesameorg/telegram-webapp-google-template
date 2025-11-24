# Telegram WebApp Google Cloud Template

A minimalist TeleGoog App with Telegram WebApp authentication, deployed on Google Cloud Run.

## Features

- ✅ Telegram WebApp authentication (no separate signup)
- ✅ Post short text messages (280 chars)
- ✅ Global feed (newest first)
- ✅ Bot commands (`/start`, `/help`)
- ✅ Deployed as single Docker container
- ✅ Firestore database (serverless)
- ✅ JWT-based auth (stateless)
- ✅ GitHub Actions CI/CD
- ✅ Free tier eligible

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite + Tailwind | Modern, fast, developer-friendly |
| Backend | Express + Node.js 20 | Battle-tested, perfect for Cloud Run |
| Database | Firestore | Serverless, no connection management |
| Auth | Telegram WebApp + JWT | Secure, no password management |
| Bot | Grammy.js | Best TypeScript bot framework |
| Runtime | Cloud Run | Serverless, auto-scaling, free tier |
| CI/CD | GitHub Actions | Automated deployments |
| Container | Docker (multi-stage) | Small image (~120MB) |

## Quick Start

### 1. Prerequisites

- GitHub account with access to this repository
- Google Cloud account ([sign up free](https://cloud.google.com/free))
- Telegram account

### 2. Setup

Follow the detailed setup guide in [`docs/SETUP_CHECKLIST.md`](docs/SETUP_CHECKLIST.md).

Quick summary:
1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Set up Google Cloud project and Firestore
3. Configure GitHub Secrets
4. Deploy!

### 3. Local Development

```bash
# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Start development servers
npm run dev

# In another terminal, start ngrok tunnel
npm run tunnel:start

# Set Telegram webhook
npm run webhook:set
```

## Documentation

- **[Setup Checklist](docs/SETUP_CHECKLIST.md)** - Complete setup guide
- **[Architecture](docs/architecture.md)** - Tech stack and design decisions
- **[Telegram Auth](docs/telegram-auth.md)** - How authentication works
- **[Webhook Setup](docs/webhook-setup.md)** - Bot webhook configuration
- **[Deployment](docs/deployment.md)** - Cloud Run deployment guide

## Project Structure

```
telegram-webapp-google-template/
├── backend/
│   ├── src/
│   │   ├── config/         # Firebase configuration
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── api/            # API endpoints
│   │   ├── webhook.ts      # Telegram bot handler
│   │   ├── app.ts          # Express app setup
│   │   └── server.ts       # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   └── package.json
├── docs/                   # Documentation
├── scripts/                # Dev tools
├── .github/workflows/      # CI/CD
└── Dockerfile             # Multi-stage build
```

## Scripts

```bash
# Development
npm run dev              # Start backend + frontend
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Build
npm run build            # Build both
npm run build:backend    # Backend only
npm run build:frontend   # Frontend only

# Tunnel & Webhook (local dev)
npm run tunnel:start     # Start ngrok tunnel
npm run tunnel:stop      # Stop ngrok tunnel
npm run tunnel:status    # Check tunnel status
npm run webhook:set      # Set webhook to tunnel
npm run webhook:status   # Check webhook status
npm run webhook:clear    # Clear webhook
```

## Environment Variables

See [`.env.example`](.env.example) for all required environment variables.

### Required for Deployment

Set these in GitHub Secrets:
- `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
- `JWT_SECRET` - Random secret (generate with `openssl rand -hex 32`)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Firebase private key
- `GCP_SA_KEY` - Google Cloud service account key (base64)
- `GCP_PROJECT_ID` - Google Cloud project ID

## Deployment

Deployment happens automatically via GitHub Actions when you push to `main`.

For manual deployment:
```bash
# Build and deploy
gcloud run deploy telegoog-app --source=.
```

See [docs/deployment.md](docs/deployment.md) for detailed deployment guide.

## Cost Estimate

**Free tier covers**:
- Cloud Run: 2M requests/month
- Firestore: 50K reads, 20K writes per day
- Artifact Registry: 500MB storage

**Expected cost**: $0-2/month for personal project

## Security

- ✅ Telegram initData validation with HMAC
- ✅ JWT tokens with expiration
- ✅ CORS configuration
- ✅ Environment-based secrets
- ✅ GitHub Secrets for sensitive data

## Troubleshooting

### "Invalid initData signature"
- Wrong bot token in GitHub Secrets
- Check `TELEGRAM_BOT_TOKEN` value

### "Webhook not receiving updates"
- Run `npm run webhook:status`
- Re-set webhook: `npm run webhook:set`

### "Deployment fails"
- Check GitHub Actions logs
- Verify all secrets are set correctly
- Check GCP permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Check the [documentation](docs/)
- Review troubleshooting sections
- Open an issue for bugs or questions
