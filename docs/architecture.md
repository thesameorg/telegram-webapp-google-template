# Architecture: Minimalist Twitter App on Google Cloud Run

## Overview

A minimalistic Twitter-like application deployed as a single Docker container on Google Cloud Run, using Telegram WebApp for authentication and bot webhooks for notifications.

---

## Tech Stack

### Backend
- **Framework**: Hono (lightweight, edge-compatible)
- **Language**: TypeScript + Node.js 20
- **Database**: Firestore (serverless, free tier)
- **Auth**: Telegram WebApp initData validation + JWT
- **Bot**: Grammy.js (Telegram bot framework)
- **Validation**: Zod

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State**: React hooks (no external state management for MVP)

### Infrastructure
- **Runtime**: Google Cloud Run (single container)
- **Secrets**: GitHub Secrets → Cloud Run env vars
- **CI/CD**: GitHub Actions
- **Docker**: Multi-stage build

---

## Project Structure (Monorepo)

```
telegram-webapp-google-template/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── firebase.ts              # Firestore initialization
│   │   ├── services/
│   │   │   ├── telegram-auth.ts         # initData validation (from reference)
│   │   │   ├── jwt.ts                   # JWT generation/validation
│   │   │   └── posts.service.ts         # Post CRUD operations
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       # JWT validation middleware
│   │   │   └── error.middleware.ts      # Error handling
│   │   ├── api/
│   │   │   ├── auth.ts                  # POST /api/auth
│   │   │   ├── posts.ts                 # Posts endpoints
│   │   │   └── health.ts                # Health check
│   │   ├── webhook.ts                   # Telegram bot webhook handler
│   │   ├── types.ts                     # TypeScript types
│   │   ├── index.ts                     # Hono app setup
│   │   └── server.ts                    # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Feed.tsx                 # Post feed
│   │   │   ├── PostForm.tsx             # Create post
│   │   │   └── Post.tsx                 # Single post component
│   │   ├── lib/
│   │   │   ├── telegram.ts              # Telegram SDK integration
│   │   │   └── api.ts                   # API client
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                    # Tailwind imports
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
├── docs/
│   ├── architecture.md                  # This file
│   ├── telegram-auth.md                 # Telegram auth flow
│   ├── webhook-setup.md                 # Webhook configuration
│   └── deployment.md                    # Deployment guide
├── scripts/
│   ├── webhook.sh                       # Webhook management (set/status/clear)
│   └── tunnel.sh                        # ngrok tunnel for local dev
├── .github/
│   └── workflows/
│       └── deploy.yml                   # CI/CD pipeline
├── Dockerfile                           # Multi-stage build
├── .dockerignore
├── .env.example
├── package.json                         # Root scripts
└── README.md
```

---

## Database Schema (Firestore)

### Collection: `users`
```typescript
{
  id: string                    // Telegram user ID (document ID)
  username: string              // @username
  firstName: string
  lastName?: string
  photoUrl?: string
  languageCode?: string
  isPremium?: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Collection: `posts`
```typescript
{
  id: string                    // Auto-generated (document ID)
  userId: string                // Ref to users (Telegram ID)
  content: string               // Max 280 chars
  createdAt: Timestamp

  // Denormalized user data for faster reads
  author: {
    username: string
    firstName: string
    photoUrl?: string
  }
}
```

**Phase 2 Collections** (comments, likes):
```typescript
// Collection: comments
{
  id: string
  postId: string
  userId: string
  content: string
  createdAt: Timestamp
  author: { username, firstName, photoUrl }
}

// Collection: likes
{
  id: string                    // Composite: "${userId}_${postId}"
  postId: string
  userId: string
  createdAt: Timestamp
}
```

---

## API Endpoints

### Authentication
```
POST   /api/auth               # Authenticate with Telegram initData
  Body: { initData: string }
  Response: { token: string, user: TelegramUser }
```

### Posts
```
GET    /api/posts              # Get feed (paginated, newest first)
  Query: ?limit=20&startAfter=docId
  Response: { posts: Post[], nextCursor?: string }

POST   /api/posts              # Create post (auth required)
  Headers: Authorization: Bearer <jwt>
  Body: { content: string }
  Response: { post: Post }

GET    /api/posts/:id          # Get single post
  Response: { post: Post }

DELETE /api/posts/:id          # Delete own post (auth required)
  Headers: Authorization: Bearer <jwt>
  Response: { success: boolean }
```

### Webhook
```
POST   /webhook                # Telegram bot webhook
  Body: Telegram Update object
  Handles: /start, /help commands
```

### Health
```
GET    /health                 # Health check for Cloud Run
  Response: { status: "ok", timestamp: string }
```

---

## Telegram WebApp Authentication Flow

**Key concept**: Telegram WebApp passes `initData` which contains signed user info. We validate the HMAC signature to prove it came from Telegram.

### 1. Frontend Flow
```typescript
// frontend/src/lib/telegram.ts
import WebApp from '@twa-dev/sdk';

// Initialize Telegram WebApp
WebApp.ready();

// Get initData (includes user info + signature)
const initData = WebApp.initData;

// Send to backend for validation
const response = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initData })
});

const { token, user } = await response.json();

// Store JWT in localStorage
localStorage.setItem('jwt', token);
```

### 2. Backend Validation
```typescript
// backend/src/services/telegram-auth.ts
// COPIED FROM REFERENCE REPO

export class TelegramAuthService {
  constructor(private botToken: string) {}

  async validateInitData(initData: string): Promise<TelegramUser> {
    // 1. Extract hash from initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    // 2. Rebuild data string (sorted params)
    urlParams.delete('hash');
    const dataToCheck = Array.from(urlParams.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // 3. Compute HMAC-SHA256 signature
    // secret_key = HMAC-SHA256("WebAppData", bot_token)
    // hash = HMAC-SHA256(data_to_check, secret_key)
    const isValid = await this.validateSignature(dataToCheck, hash);

    if (!isValid) {
      throw new Error('Invalid initData signature');
    }

    // 4. Check auth_date (not expired)
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const maxAge = 3600; // 1 hour
    if (Date.now() / 1000 - authDate > maxAge) {
      throw new Error('initData expired');
    }

    // 5. Parse and return user
    const user = JSON.parse(urlParams.get('user') || '{}');
    return user;
  }

  private async validateSignature(data: string, hash: string): Promise<boolean> {
    // WebCrypto API implementation (see reference repo)
    const webAppDataKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const secretKeyData = await crypto.subtle.sign(
      'HMAC',
      webAppDataKey,
      new TextEncoder().encode(this.botToken)
    );

    const secretKey = await crypto.subtle.importKey(
      'raw',
      secretKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureData = await crypto.subtle.sign(
      'HMAC',
      secretKey,
      new TextEncoder().encode(data)
    );

    const calculatedHash = Array.from(new Uint8Array(signatureData))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return hash === calculatedHash;
  }
}
```

### 3. JWT Generation
```typescript
// backend/src/services/jwt.ts
import jwt from 'jsonwebtoken';

export function generateToken(user: TelegramUser): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      firstName: user.first_name
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
}
```

### 4. Auth Middleware
```typescript
// backend/src/middleware/auth.middleware.ts
import { Context, Next } from 'hono';
import { verifyToken } from '../services/jwt';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
```

---

## Telegram Bot Webhook

### Purpose
Handle bot commands like `/start`, `/help` when users interact with the bot directly (not in WebApp).

### Implementation
```typescript
// backend/src/webhook.ts
// ADAPTED FROM REFERENCE REPO

import { Bot, webhookCallback } from 'grammy';
import { Context } from 'hono';

export async function handleWebhook(c: Context) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return c.json({ error: 'Bot token not configured' }, 500);
  }

  const bot = new Bot(botToken);

  // Command: /start
  bot.command('start', async (ctx) => {
    const webAppUrl = process.env.WEB_APP_URL || 'https://your-app.run.app';
    const firstName = ctx.from?.first_name || 'User';

    await ctx.reply(
      `👋 Welcome ${firstName}!\n\n` +
      `Open the app to start posting:\n${webAppUrl}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🚀 Open App', web_app: { url: webAppUrl } }
          ]]
        }
      }
    );
  });

  // Command: /help
  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📖 Help\n\n' +
      '/start - Open the app\n' +
      '/help - Show this message'
    );
  });

  // Handle all text messages
  bot.on('message:text', async (ctx) => {
    if (!ctx.message.text?.startsWith('/')) {
      await ctx.reply('Use /start to open the app!');
    }
  });

  // Use Grammy's webhook callback for Hono
  return webhookCallback(bot, 'hono')(c);
}
```

### Route Setup
```typescript
// backend/src/index.ts
import { Hono } from 'hono';
import { handleWebhook } from './webhook';

const app = new Hono();

// Webhook endpoint (no auth required - Telegram calls this)
app.post('/webhook', handleWebhook);

// ... other routes
```

---

## Webhook Setup Process

### Local Development
1. Start ngrok tunnel: `npm run tunnel:start`
2. Set webhook: `npm run webhook:set`
3. Test bot commands in Telegram

```bash
# scripts/webhook.sh set
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
WEBHOOK_URL="${TUNNEL_URL}/webhook"

curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\"]}"
```

### Production (GitHub Actions)
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

## Multi-Stage Dockerfile

```dockerfile
# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/dist

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build
# Output: /app/backend/dist

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine

WORKDIR /app

# Copy backend production dependencies
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy built frontend (served as static files)
COPY --from=frontend-builder /app/frontend/dist ./public

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
```

**Key optimizations**:
- ✅ Frontend and backend built in parallel stages
- ✅ Only production dependencies in final image
- ✅ Layers cached efficiently (deps → code → build)
- ✅ Final image ~120MB (Alpine base)
- ✅ Frontend served as static files from `/public`

---

## GitHub Secrets & Environment Variables

### GitHub Secrets (Repository Settings)
```
TELEGRAM_BOT_TOKEN              # Telegram bot token
JWT_SECRET                      # JWT signing secret
GCP_PROJECT_ID                  # Google Cloud project ID
GCP_SA_KEY                      # Service account JSON key (base64)
FIREBASE_PROJECT_ID             # Firestore project ID
FIREBASE_PRIVATE_KEY            # Firebase Admin SDK private key
FIREBASE_CLIENT_EMAIL           # Firebase Admin SDK email
```

### GitHub Variables
```
CLOUD_RUN_SERVICE_NAME          # e.g., "twitter-app"
CLOUD_RUN_REGION                # e.g., "us-central1"
CLOUD_RUN_URL                   # e.g., "https://twitter-app-xxx.run.app"
```

### Cloud Run Environment Variables
```bash
gcloud run deploy twitter-app \
  --set-env-vars="TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}" \
  --set-env-vars="JWT_SECRET=${JWT_SECRET}" \
  --set-env-vars="FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}" \
  --set-env-vars="WEB_APP_URL=${CLOUD_RUN_URL}"
```

---

## Hono App Structure

```typescript
// backend/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { handleWebhook } from './webhook';
import { authHandler } from './api/auth';
import {
  getPosts,
  createPost,
  getPost,
  deletePost
} from './api/posts';
import { healthHandler } from './api/health';
import { authMiddleware } from './middleware/auth.middleware';
import { serveStatic } from 'hono/serve-static';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: process.env.WEB_APP_URL || '*',
  credentials: true
}));

// API Routes
app.get('/health', healthHandler);
app.post('/webhook', handleWebhook);
app.post('/api/auth', authHandler);

// Posts (public read, auth required for write)
app.get('/api/posts', getPosts);
app.get('/api/posts/:id', getPost);
app.post('/api/posts', authMiddleware, createPost);
app.delete('/api/posts/:id', authMiddleware, deletePost);

// Serve frontend static files
app.get('*', serveStatic({ root: './public' }));

export default app;
```

```typescript
// backend/src/server.ts
import app from './index';

const port = parseInt(process.env.PORT || '8080');

console.log(`🚀 Server starting on port ${port}`);
console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

Bun.serve({
  port,
  fetch: app.fetch,
});
```

---

## Firestore Initialization

```typescript
// backend/src/config/firebase.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  })
});

export const db = getFirestore(app);
```

---

## Frontend Telegram SDK Integration

```typescript
// frontend/src/lib/telegram.ts
import WebApp from '@twa-dev/sdk';

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
}

export const telegram: TelegramWebApp = WebApp;

// Initialize on load
telegram.ready();
telegram.expand();
```

```tsx
// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { telegram } from './lib/telegram';
import { authenticate } from './lib/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if we have a JWT token
    const token = localStorage.getItem('jwt');
    if (token) {
      setIsAuthenticated(true);
      return;
    }

    // Authenticate with Telegram initData
    const initData = telegram.initData;
    if (initData) {
      authenticate(initData)
        .then(({ token, user }) => {
          localStorage.setItem('jwt', token);
          setUser(user);
          setIsAuthenticated(true);
        })
        .catch(console.error);
    }
  }, []);

  if (!isAuthenticated) {
    return <div>Authenticating...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Feed />
    </div>
  );
}
```

---

## Key Differences from Cloudflare Template

| Aspect | Cloudflare Template | Google Cloud Run Version |
|--------|---------------------|--------------------------|
| **Database** | D1 (SQLite) + Drizzle | Firestore (NoSQL) |
| **Sessions** | KV Store | None (stateless JWT) |
| **Images** | R2 | Skipped (Phase 2: Cloud Storage) |
| **Payments** | Telegram Stars | Skipped |
| **Framework** | Hono on Workers | Hono on Node.js |
| **Deployment** | Wrangler | Docker → Cloud Run |
| **Secrets** | Wrangler secrets | GitHub Secrets → env vars |
| **Runtime** | Edge (Cloudflare) | Container (Cloud Run) |

**What we kept**:
- ✅ Telegram initData validation logic
- ✅ Webhook handler structure
- ✅ Grammy.js bot framework
- ✅ Hono framework
- ✅ React + Vite + TypeScript frontend

**What we removed**:
- ❌ Payments (Telegram Stars)
- ❌ Images (R2 storage)
- ❌ Admin features (ban/unban)
- ❌ Profile management
- ❌ Comments (Phase 2)

---

## Performance Considerations

### Cold Start Optimization
1. **Small image size**: ~120MB Alpine-based
2. **Firestore**: No connection pool warmup needed (HTTP API)
3. **Lazy loading**: Import heavy deps conditionally
4. **Keep 1 instance warm**: Configure Cloud Run min instances = 1 (costs ~$5/month)

### Firestore Query Optimization
```typescript
// Efficient feed query (compound index required)
const feedQuery = db.collection('posts')
  .orderBy('createdAt', 'desc')
  .limit(20);

// Pagination with cursor
if (startAfter) {
  const lastDoc = await db.collection('posts').doc(startAfter).get();
  feedQuery.startAfter(lastDoc);
}
```

### Caching Strategy
```typescript
// Cache static assets aggressively
app.get('/assets/*', serveStatic({
  root: './public',
  headers: {
    'Cache-Control': 'public, max-age=31536000, immutable'
  }
}));

// Cache API responses (optional)
app.get('/api/posts', async (c) => {
  c.header('Cache-Control', 'public, max-age=60'); // 1 min cache
  // ... fetch posts
});
```

---

## Development Workflow

```bash
# Install dependencies
npm install

# Local development (backend + frontend concurrently)
npm run dev
# Backend: http://localhost:8787
# Frontend: http://localhost:3000

# Set up ngrok tunnel for webhooks
npm run tunnel:start

# Set Telegram webhook to tunnel
npm run webhook:set

# Check webhook status
npm run webhook:status

# Build for production
npm run build

# Test production build locally
docker build -t twitter-app .
docker run -p 8080:8080 \
  -e TELEGRAM_BOT_TOKEN=xxx \
  -e JWT_SECRET=xxx \
  -e FIREBASE_PROJECT_ID=xxx \
  twitter-app
```

---

## Next Steps

1. ✅ Review this architecture plan
2. ⏭️ Create detailed Telegram auth documentation
3. ⏭️ Create webhook setup guide
4. ⏭️ Create deployment guide
5. ⏭️ Implement scaffolding (package.json, tsconfig, etc.)
6. ⏭️ Implement backend services
7. ⏭️ Implement frontend components
8. ⏭️ Set up GitHub Actions
9. ⏭️ Deploy to Cloud Run

---

## Questions?

Ready to proceed with implementation? Any changes to this plan?
