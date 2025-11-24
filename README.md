Вот финальная версия README с вынесением деталей в документацию:

---

# Telegram Bot + Google Cloud Run Template

**Production-ready Node.js + TypeScript template for building Telegram bots and Web Apps deployed on Google Cloud Run.** Includes native Telegram authentication, stateless JWT auth, React frontend with Tailwind CSS, and automated GitHub Actions deployment.

---

## Features

🔐 **Authentication Built-in**
- Native Telegram Web App authentication (no database required)
- Stateless JWT tokens for API security
- Full example implementation included

☁️ **Google Cloud Free Tier**
- Cloud Run (2M requests/month free)
- Artifact Registry (0.5 GB storage free)
- Cloud Storage (5 GB + free egress)

🛠️ **Modern Stack**
- Node.js + TypeScript backend
- React + Tailwind CSS frontend
- Type-safe API contracts

🚀 **Deployment Ready**
- GitHub Actions CI/CD pipeline
- Automatic container builds
- Zero-downtime deployments

🏃 **Three Run Modes**
- Local development (`npm run dev`)
- Local in Docker (`docker-compose up`)
- Production on Cloud Run

📸 **Example Features**
- Single feed with posts
- Image upload to Cloud Storage
- CORS configured for Web App

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ and npm
- [Docker](https://www.docker.com/) (optional, for local container testing)
- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) configured
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### Local Development

```bash
# Clone and install
git clone <repo-url>
cd telegram-gcloud-template
npm install

# Configure environment
cp .env.example .env
# Edit .env with your tokens (see Configuration section)

# Run backend + frontend
npm run dev
```

Frontend available at `http://localhost:3000`, backend at `http://localhost:8080`.

### Local with Docker

```bash
# Build and run containers
docker-compose up

# Access at http://localhost:8080
```

### Deploy to Google Cloud Run

```bash
# One-time setup: enable APIs
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com

# Create storage bucket
gsutil mb -l us-central1 gs://your-bucket-name

# Deploy
gcloud run deploy telegram-bot \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars TELEGRAM_BOT_TOKEN=xxx,JWT_SECRET=yyy,GCS_BUCKET_NAME=your-bucket-name

# Get URL and set webhook
WEBHOOK_URL=$(gcloud run services describe telegram-bot --format='value(status.url)')
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=${WEBHOOK_URL}/webhook"
```

**Automated deployment:** Just push to `main` branch — GitHub Actions handles the rest. See [Deployment Guide](docs/deployment.md).

---

## Project Structure

```
telegram-gcloud-template/
├── src/
│   ├── backend/
│   │   ├── bot/
│   │   │   ├── handlers/          # Command and message handlers
│   │   │   └── index.ts           # Bot initialization
│   │   ├── api/
│   │   │   ├── routes/            # Express API routes
│   │   │   ├── middleware/        # JWT auth, CORS
│   │   │   └── controllers/       # Business logic
│   │   ├── services/
│   │   │   ├── auth.ts            # Telegram auth + JWT
│   │   │   ├── storage.ts         # Cloud Storage integration
│   │   │   └── feed.ts            # Feed/posts logic
│   │   └── server.ts              # Express app entry point
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/        # React components
│   │   │   ├── pages/             # Feed, Upload, etc.
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   ├── utils/             # Telegram auth helpers
│   │   │   └── App.tsx            # Main React app
│   │   ├── index.html
│   │   └── tailwind.config.js
│   └── shared/
│       └── types.ts               # Shared TypeScript types
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions CI/CD
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Key Files

- **`src/backend/server.ts`** — Express app with webhook + API endpoints
- **`src/backend/services/auth.ts`** — Telegram auth validation + JWT generation
- **`src/frontend/src/App.tsx`** — React Web App entry point
- **`.github/workflows/deploy.yml`** — Automated deployment pipeline

---

## Configuration

### Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
# Required - Telegram
TELEGRAM_BOT_TOKEN=1234567890:XXXXXXXXXXXXXXXXXXXXXXXXXXX
BOT_USERNAME=your_bot_username

# Required - Auth
JWT_SECRET=---                      # Random 32+ char string for signing tokens
JWT_EXPIRES_IN=7d                   # Token expiration

# Required - Google Cloud
GOOGLE_CLOUD_PROJECT=---            # Your GCP project ID
GCS_BUCKET_NAME=---                 # Bucket for image uploads
REGION=us-central1                  # Cloud Run region

# Optional - Development
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000   # Frontend URL for local dev

# Optional - AI Integration
OPENAI_API_KEY=---
ANTHROPIC_API_KEY=---
```

For production deployment, set these via:
- **GitHub Actions:** Repository Secrets (see [Deployment Guide](docs/deployment.md))
- **Cloud Run Console:** Edit & Deploy New Revision → Environment Variables
- **gcloud CLI:** `--set-env-vars` flag

---

## Core Features

### 🔐 Authentication

Template includes **native Telegram authentication** with **stateless JWT tokens** — no database required for auth.

**How it works:**
1. User opens bot → clicks "Launch App"
2. Telegram Web App opens with signed auth data
3. Backend validates signature using bot token
4. Backend issues JWT for API access
5. Frontend includes JWT in subsequent requests

**Implementation:** See [Authentication Guide](docs/authentication.md) for complete flow and code examples.

### 📸 Image Feed Example

Working example feature demonstrating:
- Image upload from frontend
- Storage in Google Cloud Storage
- Public URL generation
- Feed retrieval with authentication

**Endpoints:**
- `POST /api/feed/upload` — Upload image (multipart/form-data)
- `GET /api/feed` — Retrieve feed posts (requires JWT)

**Usage:** See [Feed Feature Guide](docs/features/feed.md) for API details and frontend integration.

### 🌐 CORS Configuration

Pre-configured for Telegram Web Apps with support for:
- Telegram Web App iframe (`https://web.telegram.org`)
- Local development server
- Custom origins via environment variable

**Configuration:** See [CORS Setup](docs/cors.md) for customization options.

---

## Development Workflows

### Adding Bot Commands

Edit `src/backend/bot/handlers/commands.ts`:

```typescript
bot.command('mycommand', async (ctx) => {
  await ctx.reply('Response from new command');
});
```

### Adding API Endpoints

1. Create controller in `src/backend/api/controllers/`
2. Add route in `src/backend/api/routes/`
3. Add middleware if needed (auth, validation)

**Example:** See [API Development Guide](docs/development/api.md)

### Adding Frontend Pages

1. Create component in `src/frontend/src/pages/`
2. Add route in `src/frontend/src/App.tsx`
3. Style with Tailwind CSS classes

**Example:** See [Frontend Development Guide](docs/development/frontend.md)

### Integrating AI Services

Template structure supports easy AI integration:

```typescript
// src/backend/services/ai.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getAIResponse(prompt: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.choices[0].message.content;
}
```

**Examples:**
- [OpenAI Integration](docs/integrations/openai.md)
- [Anthropic Claude Integration](docs/integrations/anthropic.md)
- [Google Gemini Integration](docs/integrations/gemini.md)

---

## Deployment

### Local Development Mode

```bash
npm run dev
```

- Backend runs on port 8080
- Frontend runs on port 3000 (Vite dev server)
- Hot reload enabled
- Uses local file system (no Cloud Storage needed)
- CORS configured for `localhost:3000`

### Local Docker Mode

```bash
docker-compose up
```

- Simulates production environment
- Both services in containers
- Accesses Cloud Storage (requires credentials)
- Tests deployment configuration

### Production Deployment

**Via GitHub Actions (Recommended):**
1. Push to `main` branch
2. GitHub Actions automatically builds and deploys
3. Zero downtime deployment

**Manual deployment:**
```bash
gcloud run deploy telegram-bot --source .
```

**Detailed guides:**
- [GitHub Actions Setup](docs/deployment.md#github-actions)
- [Manual Deployment](docs/deployment.md#manual)
- [Environment Configuration](docs/deployment.md#environment)
- [Troubleshooting](docs/troubleshooting.md)

---

## Google Cloud Free Tier Usage

This template is optimized to stay within free tier limits:

| Service | Free Tier | Typical Usage |
|---------|-----------|---------------|
| **Cloud Run** | 2M requests/month | ~65K requests/day |
| | 360K GB-seconds | ~1 instance running 24/7 |
| **Artifact Registry** | 0.5 GB storage | ~5-10 container images |
| **Cloud Storage** | 5 GB storage | ~5K images (1MB each) |
| | 1 GB egress/month | --- |

**Cost optimization tips:**
- Cloud Run scales to zero when idle (no requests = no cost)
- Artifact Registry: Clean old images periodically
- Cloud Storage: Use lifecycle policies to delete old files

**Monitoring costs:** See [Cost Optimization Guide](docs/cost-optimization.md)

---

## Production Checklist

Before launching:

- [ ] Set strong `JWT_SECRET` (32+ random characters)
- [ ] Configure webhook secret for security
- [ ] Enable Cloud Logging and monitoring
- [ ] Set up error alerting (Cloud Monitoring or external service)
- [ ] Configure Cloud Storage CORS for your domain
- [ ] Test authentication flow end-to-end
- [ ] Review [Cloud Run security best practices](https://cloud.google.com/run/docs/securing/overview)
- [ ] Set appropriate Cloud Run resource limits
- [ ] Configure custom domain (optional)
- [ ] Set up backup strategy for uploaded images

**Full checklist:** See [Production Deployment Checklist](docs/production-checklist.md)

---

## Troubleshooting

**Webhook not receiving messages?**
- Check webhook status: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Verify Cloud Run service is publicly accessible
- Check logs: `gcloud run logs read --service telegram-bot`

**Authentication failing?**
- Verify `TELEGRAM_BOT_TOKEN` matches BotFather token
- Check `JWT_SECRET` is set in environment
- Ensure frontend sends `initData` correctly

**Image upload not working?**
- Verify Cloud Storage bucket exists and is accessible
- Check service account has Storage Admin permissions
- Confirm CORS is configured on bucket

**GitHub Actions deployment failing?**
- Verify all repository secrets are set correctly
- Check service account permissions
- Review workflow logs in Actions tab

**Complete troubleshooting guide:** [docs/troubleshooting.md](docs/troubleshooting.md)

---

## Documentation

### Getting Started
- [Installation Guide](docs/installation.md)
- [Configuration Reference](docs/configuration.md)
- [Local Development](docs/development/local.md)

### Core Features
- [Authentication Flow](docs/authentication.md)
- [Image Feed Feature](docs/features/feed.md)
- [CORS Configuration](docs/cors.md)

### Development
- [Adding Bot Commands](docs/development/bot-commands.md)
- [API Development](docs/development/api.md)
- [Frontend Development](docs/development/frontend.md)
- [TypeScript Guide](docs/development/typescript.md)

### Deployment
- [GitHub Actions Setup](docs/deployment.md)
- [Manual Deployment](docs/deployment.md#manual)
- [Environment Variables](docs/deployment.md#environment)
- [Custom Domains](docs/deployment.md#custom-domains)

### Integrations
- [Google Cloud Storage](docs/integrations/cloud-storage.md)
- [OpenAI Integration](docs/integrations/openai.md)
- [Anthropic Claude](docs/integrations/anthropic.md)
- [Other AI Services](docs/integrations/ai-services.md)

### Operations
- [Monitoring & Logging](docs/operations/monitoring.md)
- [Cost Optimization](docs/cost-optimization.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Production Checklist](docs/production-checklist.md)

---

## Resources

**Official Documentation:**
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Web Apps](https://core.telegram.org/bots/webapps)
- [Google Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud Storage Guide](https://cloud.google.com/storage/docs)

**Related Projects:**
- [Telegraf.js](https://telegraf.js.org/) — Bot framework used in this template
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

**Community:**
- [Telegram Bot Developers](https://t.me/botdevelopers)
- [Google Cloud Community](https://www.googlecloudcommunity.com/)

---

## License

MIT License — see [LICENSE](LICENSE) file.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Questions or Issues?** Open an issue on GitHub or check [existing discussions](---).