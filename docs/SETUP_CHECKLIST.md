# Setup Checklist

Complete these steps to deploy your Twitter app to Google Cloud Run.

---

## ☑️ Prerequisites

- [ ] GitHub account with access to this repository
- [ ] Google Cloud account ([sign up free](https://cloud.google.com/free))
- [ ] Telegram account

---

## 🤖 Step 1: Create Telegram Bot

### 1.1 Create Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow prompts:
   - Bot name: `My Twitter Bot`
   - Username: `my_twitter_bot` (must end with `bot`)
4. **Save the bot token** (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 1.2 Configure Bot

Send these commands to @BotFather:

```
/setcommands
→ Select your bot
→ Send:
start - Open the app
help - Show help message

/setdescription
→ Select your bot
→ Send: A minimalist Twitter-like app

/setabouttext
→ Select your bot
→ Send: Post short messages and see the feed
```

### 1.3 Save Bot Token

```
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
```

---

## ☁️ Step 2: Setup Google Cloud

### 2.1 Create Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name: `twitter-app` (or your choice)
4. Click **Create**
5. **Save project ID** (e.g., `twitter-app-123456`)

### 2.2 Enable APIs

Go to **APIs & Services** → **Enable APIs and Services**, search and enable:

- [ ] Cloud Run API
- [ ] Artifact Registry API
- [ ] Cloud Build API
- [ ] Firestore API (or Firebase)

Or use command:
```bash
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com
```

### 2.3 Create Service Account

```bash
# Set your project ID
PROJECT_ID="twitter-app-123456"  # Replace with your project ID
gcloud config set project $PROJECT_ID

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"

# Get service account email
SA_EMAIL="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
echo "Service account: $SA_EMAIL"
```

### 2.4 Grant Permissions

```bash
# Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# Service Account User
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Artifact Registry Writer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Firestore User
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user"
```

### 2.5 Generate Service Account Key

```bash
# Create key
gcloud iam service-accounts keys create github-sa-key.json \
  --iam-account=$SA_EMAIL

# Base64 encode (for GitHub Secret)
cat github-sa-key.json | base64 > github-sa-key-base64.txt

# macOS users use:
cat github-sa-key.json | base64 -w 0 > github-sa-key-base64.txt

# Copy the content of github-sa-key-base64.txt
cat github-sa-key-base64.txt
```

**Save this base64 string** for GitHub Secrets.

---

## 🔥 Step 3: Setup Firebase/Firestore

### 3.1 Create Firestore Database

**Option A: Via gcloud CLI**
```bash
gcloud firestore databases create --region=us-central1
```

**Option B: Via Firebase Console**
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Select your project (or add Firebase to existing GCP project)
3. Click **Firestore Database** → **Create database**
4. Choose **Production mode**
5. Select region: `us-central1` (or closest to you)

### 3.2 Get Firebase Credentials

1. Go to **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate new private key**
4. Save the JSON file as `firebase-key.json`

### 3.3 Extract Credentials

```bash
# Extract values from firebase-key.json
cat firebase-key.json | jq -r '.project_id'       # Save as FIREBASE_PROJECT_ID
cat firebase-key.json | jq -r '.client_email'     # Save as FIREBASE_CLIENT_EMAIL
cat firebase-key.json | jq -r '.private_key'      # Save as FIREBASE_PRIVATE_KEY
```

**Note**: `FIREBASE_PRIVATE_KEY` will contain `\n` characters - **keep them as-is**.

---

## 🔐 Step 4: Generate JWT Secret

```bash
# Generate random 32-byte hex string
openssl rand -hex 32

# Example output: a1b2c3d4e5f6...
```

**Save this** as `JWT_SECRET`.

---

## 🐙 Step 5: Configure GitHub Secrets

Go to your GitHub repository:
**Settings** → **Secrets and variables** → **Actions**

### 5.1 Add Secrets

Click **New repository secret** for each:

| Name | Value | Where to Get |
|------|-------|--------------|
| `GCP_SA_KEY` | Base64-encoded service account key | Step 2.5 output |
| `GCP_PROJECT_ID` | Your GCP project ID | Step 2.1 (e.g., `twitter-app-123456`) |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | Step 1.1 |
| `JWT_SECRET` | Random hex string | Step 4 output |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Step 3.3 (usually same as GCP project ID) |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | Step 3.3 |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (with \n) | Step 3.3 |

**Example** for `FIREBASE_PRIVATE_KEY`:
```
-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n
```

### 5.2 Add Variables

Click **Variables** tab → **New repository variable**:

| Name | Value | Notes |
|------|-------|-------|
| `CLOUD_RUN_SERVICE_NAME` | `twitter-app` | Your service name |
| `CLOUD_RUN_REGION` | `us-central1` | Cloud Run region |
| `CLOUD_RUN_URL` | (leave empty for now) | Will be set after first deploy |

---

## 📦 Step 6: Create Artifact Registry

This stores your Docker images.

```bash
PROJECT_ID="twitter-app-123456"  # Your project ID
REGION="us-central1"
SERVICE_NAME="twitter-app"

gcloud artifacts repositories create $SERVICE_NAME \
  --repository-format=docker \
  --location=$REGION \
  --description="Twitter app container images" \
  --project=$PROJECT_ID
```

Verify:
```bash
gcloud artifacts repositories list --location=$REGION
```

---

## 🚀 Step 7: Deploy

### 7.1 Commit and Push

```bash
git add .
git commit -m "Initial setup"
git push origin main
```

### 7.2 Monitor Deployment

1. Go to **Actions** tab in GitHub
2. Watch **Deploy to Cloud Run** workflow
3. Wait ~5-10 minutes for first deploy

### 7.3 Get Cloud Run URL

After deployment succeeds:

```bash
gcloud run services describe twitter-app \
  --region=us-central1 \
  --format='value(status.url)'

# Example output: https://twitter-app-abc123-uc.a.run.app
```

### 7.4 Update Cloud Run URL Variable

1. Go to GitHub: **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. Edit `CLOUD_RUN_URL`
3. Set value to the URL from step 7.3

### 7.5 Re-run Workflow

1. Go to **Actions** tab
2. Click latest workflow run
3. Click **Re-run jobs** → **Re-run all jobs**

This will update the `WEB_APP_URL` environment variable and set the webhook correctly.

---

## 🎯 Step 8: Configure Telegram WebApp

### 8.1 Set Menu Button

```bash
BOT_TOKEN="your_bot_token"  # From Step 1
CLOUD_RUN_URL="your_cloud_run_url"  # From Step 7.3

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"Open App\",
      \"web_app\": {
        \"url\": \"${CLOUD_RUN_URL}\"
      }
    }
  }"
```

### 8.2 Verify Webhook

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .
```

Should show:
```json
{
  "url": "https://twitter-app-xxx.run.app/webhook",
  "has_custom_certificate": false,
  "pending_update_count": 0
}
```

---

## ✅ Step 9: Test Everything

### 9.1 Test Health Endpoint

```bash
curl "https://your-cloud-run-url.run.app/health"
# Expected: {"status":"ok","timestamp":"..."}
```

### 9.2 Test Bot Commands

1. Open your bot in Telegram
2. Send `/start` command
3. Should receive welcome message with "Open App" button

### 9.3 Test WebApp

1. Click "Open App" button (or menu button)
2. App should load and authenticate you
3. Try posting a message
4. Check if it appears in the feed

### 9.4 Check Logs

```bash
gcloud run logs tail twitter-app --region=us-central1
```

---

## 🎉 You're Done!

Your Twitter app is now deployed and running!

### What You Have

- ✅ Telegram bot with WebApp
- ✅ Cloud Run service (serverless)
- ✅ Firestore database
- ✅ Automatic deployments via GitHub Actions
- ✅ Telegram webhook configured

### Next Steps

- Share your bot with friends
- Add more features (comments, likes)
- Monitor usage in GCP Console
- Check costs (should be $0 for low traffic)

---

## 🔧 Troubleshooting

### Deployment Fails

**Check GitHub Actions logs**:
1. Go to **Actions** tab
2. Click failed workflow
3. Expand failed step
4. Look for error message

**Common issues**:
- Missing GitHub secret → Re-check Step 5
- GCP permissions → Re-run Step 2.4
- Artifact Registry missing → Re-run Step 6

### Bot Not Responding

**Check webhook status**:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

**Re-set webhook**:
```bash
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${CLOUD_RUN_URL}/webhook"
```

### App Not Loading

**Check Cloud Run logs**:
```bash
gcloud run logs tail twitter-app --region=us-central1 --limit=50
```

**Check service status**:
```bash
gcloud run services describe twitter-app --region=us-central1
```

### Authentication Fails

**Verify Firestore permissions**:
```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/datastore.user"
```

**Check Firebase credentials**:
- Verify `FIREBASE_PROJECT_ID` matches your project
- Verify `FIREBASE_PRIVATE_KEY` has `\n` characters

---

## 📝 Quick Reference

### GitHub Secrets Needed

```
GCP_SA_KEY               # Base64 service account key
GCP_PROJECT_ID           # GCP project ID
TELEGRAM_BOT_TOKEN       # From @BotFather
JWT_SECRET               # openssl rand -hex 32
FIREBASE_PROJECT_ID      # Firebase project ID
FIREBASE_CLIENT_EMAIL    # From firebase-key.json
FIREBASE_PRIVATE_KEY     # From firebase-key.json (keep \n)
```

### GitHub Variables Needed

```
CLOUD_RUN_SERVICE_NAME   # e.g., "twitter-app"
CLOUD_RUN_REGION         # e.g., "us-central1"
CLOUD_RUN_URL            # Set after first deploy
```

### Useful Commands

```bash
# View logs
gcloud run logs tail twitter-app --region=us-central1

# Check service
gcloud run services describe twitter-app --region=us-central1

# Check webhook
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

# Re-deploy
git push origin main

# Manual deploy
gcloud run deploy twitter-app --source=.
```

---

## 💰 Cost Estimate

With Cloud Run free tier:
- **$0/month** for < 50K requests
- **$0/month** for Firestore < 50K reads/day
- **$0/month** for Artifact Registry < 500MB

Typical usage for personal project: **$0-2/month**

---

## 🆘 Need Help?

- Check `docs/deployment.md` for detailed guide
- Check `docs/telegram-auth.md` for auth troubleshooting
- Check `docs/webhook-setup.md` for webhook issues
- Open an issue on GitHub
