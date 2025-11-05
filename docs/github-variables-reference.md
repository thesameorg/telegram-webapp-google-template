# GitHub Variables & Secrets Reference

This is a complete reference for all GitHub variables and secrets needed for deployment.

## GitHub Secrets (Required)

Go to: **Settings → Secrets and variables → Actions → Secrets**

| Secret | Description | Example | How to Get |
|--------|-------------|---------|------------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID | `my-project-123` | GCP Console or `gcloud config get-value project` |
| `GCP_SA_KEY` | Service account key JSON | `{"type":"service_account"...}` | Create service account with Cloud Run Admin, Artifact Registry Writer roles |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather | `1234567890:ABCdef...` | [@BotFather](https://t.me/botfather) → /newbot |
| `JWT_SECRET` | Secret for JWT signing | Random 32+ char string | `openssl rand -hex 32` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `my-project-123` | Firebase Console → Project Settings |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | `firebase-adminsdk@...` | Firebase Console → Service Accounts |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | `-----BEGIN PRIVATE KEY-----...` | Firebase Console → Generate New Private Key |

## GitHub Variables (All Optional)

Go to: **Settings → Secrets and variables → Actions → Variables**

| Variable | Default | Description |
|----------|---------|-------------|
| `GCP_REGION` | `asia-se1` | Google Cloud region for deployment |
| `SERVICE_NAME` | `telegram-webapp-google-tpl` | Name for Cloud Run service AND Artifact Registry repository |
| `WEB_APP_URL` | *(empty)* | Set after first deployment for webhook configuration |

## Simplified Structure

**Key Simplification:** We use `SERVICE_NAME` for both the Artifact Registry repository and the image name. This means:
- Artifact Registry repository: `telegram-webapp-google-tpl`
- Docker image name: `telegram-webapp-google-tpl`
- Cloud Run service: `telegram-webapp-google-tpl`

Full Docker image path:
```
{GCP_REGION}-docker.pkg.dev/{GCP_PROJECT_ID}/{SERVICE_NAME}/{SERVICE_NAME}:latest
```

Example:
```
asia-se1-docker.pkg.dev/my-project/telegram-webapp-google-tpl/telegram-webapp-google-tpl:latest
```

## Quick Setup Checklist

1. **Create GCP service account** with roles:
   - Cloud Run Admin
   - Artifact Registry Writer
   - Service Account User

2. **Create Artifact Registry repository:**
   ```bash
   gcloud artifacts repositories create telegram-webapp-google-tpl \
     --repository-format=docker \
     --location=asia-se1
   ```

3. **Add all 7 secrets** to GitHub (listed above)

4. **Optional:** Add variables if you want different values from defaults

5. **Deploy:** Push to `main` branch or trigger workflow manually

6. **After first deployment:** Set `WEB_APP_URL` variable with the Cloud Run URL

## Common Regions

- `us-central1` - Iowa, USA (good latency for Americas)
- `us-east1` - South Carolina, USA
- `europe-west1` - Belgium (good for Europe)
- `asia-northeast1` - Tokyo, Japan
- `asia-southeast1` - Singapore
- `asia-se1` - Singapore (default, deprecated name but still works)

Choose the region closest to your users for best performance.
