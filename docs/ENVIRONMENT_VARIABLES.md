# Environment Variables Guide

Complete guide to environment variables and secrets for all deployment modes.

---

## Table of Contents

- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
- [Local Development (.env file)](#local-development-env-file)
- [Local Docker](#local-docker)
- [GitHub Actions Secrets](#github-actions-secrets)
- [Cloud Run Deployment](#cloud-run-deployment)
- [How to Get Values](#how-to-get-values)

---

## Required Variables

These variables are **required** for the application to run:

| Variable | Description | Example | Where Used |
|----------|-------------|---------|------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `1234567890:ABCdefGHI...` | All modes |
| `JWT_SECRET` | Secret for signing JWT tokens | `66ce1df2589751048073...` | All modes |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `my-telegram-app` | All modes |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk@...iam.gserviceaccount.com` | All modes |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | `-----BEGIN PRIVATE KEY-----\n...` | All modes |

---

## Optional Variables

| Variable | Description | Default | Where Used |
|----------|-------------|---------|------------|
| `NODE_ENV` | Runtime environment | `development` | All modes |
| `DEV_BYPASS_AUTH` | Skip Telegram auth for local testing | `false` | Local/Docker only |
| `WEB_APP_URL` | Deployed app URL (for Telegram) | - | Cloud Run only |
| `PORT` | Server port | `8080` | All modes |

---

## Local Development (.env file)

Create `.env` in project root:

```bash
# Required - Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Required - JWT
JWT_SECRET=your_jwt_secret_here_use_openssl_rand_hex_32

# Required - Firebase/Firestore
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAo...\n-----END PRIVATE KEY-----\n"

# Optional - Development
NODE_ENV=development
DEV_BYPASS_AUTH=true
```

### Key Format for Local .env

**IMPORTANT**: In the `.env` file, store `FIREBASE_PRIVATE_KEY` with **literal `\n` characters** (not actual newlines):

```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0...\n-----END PRIVATE KEY-----\n"
```

The code automatically converts `\n` to actual newlines via `.replace(/\\n/g, '\n')`.

### Why DEV_BYPASS_AUTH?

When `DEV_BYPASS_AUTH=true`:
- Skips Telegram signature validation
- Returns mock user (id: 123456789, username: devuser)
- Allows testing in browser without Telegram
- **Still uses real Firebase** (not a mock database)

---

## Local Docker

Docker uses the same `.env` file but requires `NODE_ENV=production` to serve the frontend.

### Option 1: Using npm script (recommended)

```bash
npm run docker:build
npm run docker:start
```

The `docker-local.sh` script automatically:
- Reads variables from `.env`
- Sets `NODE_ENV=production` (to serve frontend)
- Sets `DEV_BYPASS_AUTH=true` (for local testing)
- Passes all Firebase credentials

### Option 2: Manual docker run

```bash
source .env
docker run -d -p 8080:8080 \
  -e NODE_ENV=production \
  -e DEV_BYPASS_AUTH=true \
  -e TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
  -e FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
  -e FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
  telegram-webapp-google
```

### Why source .env?

The `source .env` command loads variables into your shell environment, allowing Docker to access them when using `-e` flags.

---

## GitHub Actions Secrets

Store these in **GitHub Repository Settings → Secrets and Variables → Actions → Secrets**:

### Required Secrets

| Secret Name | Value | Format |
|-------------|-------|--------|
| `GCP_SA_KEY` | Google Cloud service account JSON | Full JSON file content |
| `GCP_PROJECT_ID` | Google Cloud project ID | `my-gcp-project` |
| `TELEGRAM_BOT_TOKEN` | Bot token | `1234567890:ABC...` |
| `JWT_SECRET` | JWT signing secret | 64-character hex string |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `my-firebase-project` |
| `FIREBASE_CLIENT_EMAIL` | Service account email | `...@...iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Service account private key | **See format below** |

### FIREBASE_PRIVATE_KEY Format for GitHub Secrets

**CRITICAL**: In GitHub Secrets, paste with **actual newlines** (NOT `\n`):

```
-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDhWeUwt3808pom
IV/QpQduHRPjiIFhKkQvgYuIMkef5rFPeMIMNUMNFFvsl6Ow96aK9yMWMeRz/TgU
...
-----END PRIVATE KEY-----
```

**How to get it**:
1. Open your Firebase service account JSON file
2. Find the `private_key` field
3. Copy the **entire value** (including `-----BEGIN` and `-----END`)
4. Paste directly into GitHub Secret (with actual line breaks)

### Required Variables

Store these in **GitHub Repository Settings → Secrets and Variables → Actions → Variables**:

| Variable Name | Value | Required |
|--------------|-------|----------|
| `GCP_REGION` | Google Cloud region | No (default: `asia-southeast1`) |
| `SERVICE_NAME` | Cloud Run service name | No (default: `telegram-webapp-google-tpl`) |
| `WEB_APP_URL` | Deployed app URL | No (set after first deploy) |

---

## Cloud Run Deployment

Environment variables are set via `env.yaml` file in the deployment workflow.

### How it works

The GitHub Actions workflow creates an `env.yaml` file:

```yaml
NODE_ENV: production
TELEGRAM_BOT_TOKEN: <from GitHub secret>
JWT_SECRET: <from GitHub secret>
FIREBASE_PROJECT_ID: <from GitHub secret>
FIREBASE_CLIENT_EMAIL: <from GitHub secret>
FIREBASE_PRIVATE_KEY: |
  -----BEGIN PRIVATE KEY-----
  <multiline key with proper indentation>
  -----END PRIVATE KEY-----
WEB_APP_URL: <from GitHub variable, if set>
```

Then deploys with:
```bash
gcloud run deploy SERVICE_NAME --env-vars-file=env.yaml
```

### Multiline YAML Format

The workflow uses `sed 's/^/  /'` to indent each line of the private key by 2 spaces, creating valid YAML:

```yaml
FIREBASE_PRIVATE_KEY: |
  -----BEGIN PRIVATE KEY-----
  MIIEvwIBADANBgkqhkiG9w0...
  -----END PRIVATE KEY-----
```

This is the **standard Google Cloud approach** for multiline environment variables.

---

## How to Get Values

### TELEGRAM_BOT_TOKEN

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow instructions
3. Copy the token (format: `1234567890:ABCdef...`)

### JWT_SECRET

Generate a random 64-character hex string:

```bash
openssl rand -hex 32
```

### Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings → Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

From the JSON file, extract:
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY`

### GCP_SA_KEY (for GitHub Actions)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **IAM & Admin → Service Accounts**
3. Create or select a service account
4. Click **Keys → Add Key → Create New Key**
5. Choose **JSON** format
6. Copy the **entire JSON file content** into the GitHub Secret

**Required permissions**:
- Cloud Run Admin
- Service Account User
- Artifact Registry Writer

---

## Comparison Table

| Aspect | Local .env | Docker Local | GitHub Actions | Cloud Run |
|--------|-----------|--------------|----------------|-----------|
| **FIREBASE_PRIVATE_KEY Format** | `\n` (literal) | `\n` (literal) | Actual newlines | Multiline YAML |
| **How it's read** | dotenv package | Docker `-e` flag | GitHub Secrets API | Cloud Run env vars |
| **Code handling** | `.replace(/\\n/g, '\n')` | `.replace(/\\n/g, '\n')` | Indented in YAML | Direct from YAML |
| **NODE_ENV** | `development` | `production` | `production` | `production` |
| **DEV_BYPASS_AUTH** | `true` (optional) | `true` | Not used | Not used |
| **Frontend served from** | Vite (port 3000) | Express (port 8080) | N/A | Express (port 8080) |

---

## Troubleshooting

### Local: "Firebase initialization failed"

- Check `.env` has `FIREBASE_PRIVATE_KEY` with `\n` characters
- Verify Firebase project exists and Firestore is created

### Docker: "Cannot find module"

- Run `npm install` in both `backend/` and `frontend/`
- Rebuild the image: `npm run docker:build`

### GitHub Actions: "FIREBASE_PRIVATE_KEY is missing"

- Ensure secret is pasted with **actual newlines**, not `\n` characters
- Run the `validate-secrets` workflow to check

### GitHub Actions: "Invalid YAML format"

- The private key lines must be indented (handled by workflow)
- Check the `env.yaml` preview in workflow logs

### Cloud Run: "Environment variable values must be strings"

- One of the variables is empty (likely `WEB_APP_URL`)
- The workflow now skips empty variables automatically

### Auth bypass not working

- Ensure `DEV_BYPASS_AUTH=true` is set
- Check it's `development` or that auth code doesn't check `NODE_ENV`
- For Docker: the script sets it automatically

---

## Security Best Practices

1. **Never commit `.env` file** - it's in `.gitignore`
2. **Use different secrets for prod/dev** - especially `JWT_SECRET`
3. **Rotate secrets periodically** - especially after team members leave
4. **Limit service account permissions** - only grant what's needed
5. **Use Secret Manager for production** - consider Google Secret Manager instead of env vars for sensitive data

---

## Quick Reference

```bash
# Generate JWT secret
openssl rand -hex 32

# Test local setup
npm run dev

# Test Docker setup
npm run docker:start

# Validate GitHub secrets
# Run "Validate Secrets" workflow manually in GitHub Actions

# Check deployed env vars
gcloud run services describe SERVICE_NAME --region=REGION --format=yaml
```
