# Documentation

Complete documentation for deploying a minimalist Twitter-like app on Google Cloud Run with Telegram WebApp authentication.

---

## 📚 Quick Links

### Getting Started
- **[Setup Checklist](SETUP_CHECKLIST.md)** ← **START HERE**
  - Step-by-step guide with all required actions
  - GitHub secrets configuration
  - GCP project setup
  - Telegram bot creation

### Architecture & Design
- **[Architecture Overview](architecture.md)**
  - Tech stack decisions
  - Project structure
  - Database schema (Firestore)
  - API endpoints
  - Dockerfile strategy

### Authentication
- **[Telegram WebApp Auth](telegram-auth.md)**
  - How Telegram initData validation works
  - HMAC signature verification
  - JWT token generation
  - Frontend integration
  - Security considerations

### Bot Integration
- **[Webhook Setup](webhook-setup.md)**
  - Telegram bot webhook configuration
  - Local development with ngrok
  - Production webhook setup
  - Testing and monitoring
  - Troubleshooting

### Deployment
- **[Deployment Guide](deployment.md)**
  - Google Cloud Run deployment
  - GitHub Actions CI/CD
  - Environment variables
  - Cost optimization
  - Monitoring and troubleshooting

---

## 🚀 Quick Start

1. Read **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** first
2. Follow the checklist steps in order
3. Deploy and test
4. Reference other docs as needed

---

## 📖 Documentation Structure

```
docs/
├── README.md                   # This file
├── SETUP_CHECKLIST.md          # Step-by-step setup guide (START HERE)
├── architecture.md             # Architecture overview
├── telegram-auth.md            # Telegram WebApp authentication
├── webhook-setup.md            # Webhook configuration
└── deployment.md               # Cloud Run deployment
```

---

## 🎯 What You'll Build

A minimalist Twitter-like app with:
- ✅ Telegram WebApp authentication (no separate signup)
- ✅ Post short text messages (280 chars)
- ✅ Global feed (newest first)
- ✅ Bot commands (`/start`, `/help`)
- ✅ Deployed as single Docker container
- ✅ Firestore database (serverless)
- ✅ JWT-based auth (stateless)
- ✅ GitHub Actions CI/CD
- ✅ Free tier eligible

---

## 📝 Key Concepts

### Telegram WebApp
Users authenticate through Telegram - no password needed. Telegram provides signed user data (`initData`) that we validate using HMAC-SHA256.

### Stateless Architecture
No session storage - JWT tokens in localStorage. Perfect for Cloud Run's serverless model.

### Monorepo
Backend (Express + Node.js) and frontend (React + Vite) in one repo, deployed as single container.

### Firestore
NoSQL database - no connection pooling headaches, auto-scaling, generous free tier.

---

## 🔐 Security

- ✅ Telegram initData validation with HMAC
- ✅ JWT tokens with expiration
- ✅ CORS configuration
- ✅ Environment-based secrets
- ✅ GitHub Secrets for sensitive data
- 🔒 Optional: httpOnly cookies (production hardening)

---

## 💰 Cost

**Free tier covers**:
- Cloud Run: 2M requests/month
- Firestore: 50K reads, 20K writes per day
- Artifact Registry: 500MB storage

**Expected cost**: $0-2/month for personal project

---

## 🛠️ Tech Stack

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

---

## 📦 What We Took from Reference Repo

From [telegram-webapp-cloudflare-template](https://github.com/thesameorg/telegram-webapp-cloudflare-template):

✅ **Kept**:
- Telegram initData validation logic (HMAC signature)
- Webhook handler structure
- Grammy.js bot framework
- React + Vite frontend

❌ **Removed**:
- Payments (Telegram Stars)
- Image uploads (R2/Cloud Storage)
- Admin features (ban/unban)
- Profile management
- D1 database (switched to Firestore)
- KV sessions (switched to stateless JWT)

---

## 🔄 Development Workflow

```bash
# Install dependencies
npm install

# Start dev servers (backend + frontend)
npm run dev

# Start ngrok tunnel for webhooks
npm run tunnel:start

# Set Telegram webhook to tunnel
npm run webhook:set

# Check webhook status
npm run webhook:status

# Deploy to production
git push origin main  # GitHub Actions handles deployment
```

---

## 🐛 Common Issues

### "Invalid initData signature"
- Wrong bot token
- Check `TELEGRAM_BOT_TOKEN` in GitHub Secrets

### "Webhook not receiving updates"
- Run `npm run webhook:status`
- Re-set webhook: `npm run webhook:set`

### "Deployment fails"
- Check GitHub Actions logs
- Verify all secrets are set
- Check GCP permissions

### "App loads but auth fails"
- Check Firebase credentials
- Verify Firestore is enabled
- Check Cloud Run logs

---

## 📚 External Resources

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram WebApp Docs](https://core.telegram.org/bots/webapps)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Express.js Documentation](https://expressjs.com/)
- [Grammy.js Documentation](https://grammy.dev/)

---

## 🎓 Next Steps

After completing setup:

1. **Test the app**
   - Post messages
   - Check feed updates
   - Test bot commands

2. **Add features** (Phase 2)
   - Comments on posts
   - User profiles
   - Like/unlike posts
   - Follow/unfollow users

3. **Optimize**
   - Add caching
   - Optimize Firestore queries
   - Monitor costs
   - Set up alerts

4. **Secure**
   - Switch to httpOnly cookies
   - Add rate limiting
   - Set up Cloud Armor (DDoS)
   - Implement content moderation

---

## 💡 Tips

- **Local development**: Use `DEV_AUTH_BYPASS` to skip Telegram auth locally
- **Logs**: Check Cloud Run logs regularly during development
- **Costs**: Monitor GCP billing dashboard
- **Testing**: Test with real Telegram before deploying
- **Secrets rotation**: Change JWT_SECRET every 6 months

---

## 🆘 Getting Help

1. Check the relevant doc page
2. Review troubleshooting sections
3. Check Cloud Run logs: `gcloud run logs tail twitter-app`
4. Review GitHub Actions workflow logs
5. Open an issue with specific error messages

---

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.
