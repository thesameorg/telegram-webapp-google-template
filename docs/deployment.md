# Deployment to Google Cloud Run

## Overview

This guide covers deploying the Twitter app to Google Cloud Run using GitHub Actions for CI/CD.

---

## Prerequisites

1. **Google Cloud Project**
   - Create project at [console.cloud.google.com](https://console.cloud.google.com)
   - Enable Cloud Run API
   - Enable Artifact Registry API (for Docker images)
   - Enable Firestore API

2. **Telegram Bot**
   - Create bot via [@BotFather](https://t.me/botfather)
   - Save bot token
   - Set bot commands (optional)

3. **GitHub Repository**
   - Fork or clone this repo
   - Access to repository settings (for secrets)

---

## Step 1: Google Cloud Setup

### 1.1 Create Service Account

```bash
# Set project ID
PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"

# Get service account email
SA_EMAIL="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
```

### 1.2 Grant Permissions

```bash
# Cloud Run Admin (deploy services)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# Service Account User (act as Cloud Run service account)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Artifact Registry Writer (push Docker images)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Firestore User (access database)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user"
```

### 1.3 Create Service Account Key

```bash
# Generate JSON key
gcloud iam service-accounts keys create key.json \
  --iam-account=$SA_EMAIL

# Base64 encode for GitHub Secrets
cat key.json | base64
# Copy output for next step
```

### 1.4 Setup Firestore

```bash
# Enable Firestore
gcloud firestore databases create --region=us-central1

# Or use Firebase Console:
# https://console.firebase.google.com
# → Select project → Firestore Database → Create database
```

### 1.5 Get Firebase Service Account Key

```bash
# Go to Firebase Console
# → Project Settings → Service Accounts
# → Generate new private key
# Save as firebase-key.json

# Extract values for GitHub Secrets
cat firebase-key.json | jq -r '.project_id'       # FIREBASE_PROJECT_ID
cat firebase-key.json | jq -r '.client_email'     # FIREBASE_CLIENT_EMAIL
cat firebase-key.json | jq -r '.private_key'      # FIREBASE_PRIVATE_KEY
```

---

## Step 2: GitHub Secrets Configuration

Go to your GitHub repository:
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Required Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|-----------|
| `GCP_SA_KEY` | Service account JSON key (base64) | Step 1.3 |
| `GCP_PROJECT_ID` | Google Cloud project ID | `gcloud config get-value project` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | @BotFather |
| `JWT_SECRET` | JWT signing secret | `openssl rand -hex 32` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Firebase console |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | Firebase console |
| `FIREBASE_PRIVATE_KEY` | Firebase private key | Firebase console (keep \n chars) |

### Required Variables

**Settings** → **Secrets and variables** → **Actions** → **Variables** tab

| Variable Name | Example | Description |
|---------------|---------|-------------|
| `CLOUD_RUN_SERVICE_NAME` | `twitter-app` | Name of Cloud Run service |
| `CLOUD_RUN_REGION` | `us-central1` | Cloud Run region |
| `CLOUD_RUN_URL` | `https://twitter-app-xxx.run.app` | Set after first deploy |

---

## Step 3: GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  GCP_PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  GCP_REGION: ${{ vars.CLOUD_RUN_REGION }}
  SERVICE_NAME: ${{ vars.CLOUD_RUN_SERVICE_NAME }}

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Run tests
        run: npm test

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

  build-and-deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest
    needs: test

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: |
          gcloud auth configure-docker ${{ env.GCP_REGION }}-docker.pkg.dev

      - name: Build Docker image
        run: |
          docker build -t ${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.SERVICE_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }} .
          docker tag ${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.SERVICE_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
                     ${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.SERVICE_NAME }}/${{ env.SERVICE_NAME }}:latest

      - name: Push Docker image
        run: |
          docker push ${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.SERVICE_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
          docker push ${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.SERVICE_NAME }}/${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=${{ env.GCP_REGION }}-docker.pkg.dev/${{ env.GCP_PROJECT_ID }}/${{ env.SERVICE_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --platform=managed \
            --region=${{ env.GCP_REGION }} \
            --allow-unauthenticated \
            --set-env-vars="NODE_ENV=production" \
            --set-env-vars="TELEGRAM_BOT_TOKEN=${{ secrets.TELEGRAM_BOT_TOKEN }}" \
            --set-env-vars="JWT_SECRET=${{ secrets.JWT_SECRET }}" \
            --set-env-vars="FIREBASE_PROJECT_ID=${{ secrets.FIREBASE_PROJECT_ID }}" \
            --set-env-vars="FIREBASE_CLIENT_EMAIL=${{ secrets.FIREBASE_CLIENT_EMAIL }}" \
            --set-env-vars="FIREBASE_PRIVATE_KEY=${{ secrets.FIREBASE_PRIVATE_KEY }}" \
            --set-env-vars="WEB_APP_URL=${{ vars.CLOUD_RUN_URL }}" \
            --min-instances=0 \
            --max-instances=10 \
            --cpu=1 \
            --memory=512Mi \
            --timeout=60

      - name: Get Cloud Run URL
        id: get-url
        run: |
          URL=$(gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.GCP_REGION }} \
            --format='value(status.url)')
          echo "url=$URL" >> $GITHUB_OUTPUT
          echo "🚀 Deployed to: $URL"

      - name: Set Telegram Webhook
        run: |
          WEBHOOK_URL="${{ steps.get-url.outputs.url }}/webhook"
          echo "Setting webhook to: $WEBHOOK_URL"

          RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/setWebhook" \
            -H "Content-Type: application/json" \
            -d "{
              \"url\": \"${WEBHOOK_URL}\",
              \"allowed_updates\": [\"message\"],
              \"drop_pending_updates\": true
            }")

          echo "$RESPONSE" | jq .

          if echo "$RESPONSE" | jq -e '.ok' > /dev/null; then
            echo "✅ Webhook configured successfully"
          else
            echo "❌ Failed to configure webhook"
            exit 1
          fi

      - name: Verify Deployment
        run: |
          URL="${{ steps.get-url.outputs.url }}"

          # Wait for service to be ready
          sleep 10

          # Check health endpoint
          HEALTH=$(curl -s "$URL/health")
          echo "Health check: $HEALTH"

          if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null; then
            echo "✅ Service is healthy"
          else
            echo "⚠️ Service health check failed"
          fi

      - name: Summary
        run: |
          echo "## Deployment Summary 🚀" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Service**: ${{ env.SERVICE_NAME }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Region**: ${{ env.GCP_REGION }}" >> $GITHUB_STEP_SUMMARY
          echo "- **URL**: ${{ steps.get-url.outputs.url }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Commit**: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Next Steps" >> $GITHUB_STEP_SUMMARY
          echo "1. Test bot: Send /start to your Telegram bot" >> $GITHUB_STEP_SUMMARY
          echo "2. Open WebApp and try posting" >> $GITHUB_STEP_SUMMARY
          echo "3. Check logs: \`gcloud run logs read ${{ env.SERVICE_NAME }} --region=${{ env.GCP_REGION }}\`" >> $GITHUB_STEP_SUMMARY
```

---

## Step 4: First Deployment

### 4.1 Create Artifact Registry Repository

```bash
# Create Docker repository
gcloud artifacts repositories create $SERVICE_NAME \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="Twitter app container images"
```

### 4.2 Commit and Push

```bash
git add .
git commit -m "Initial deployment configuration"
git push origin main
```

### 4.3 Monitor Deployment

1. Go to **Actions** tab in GitHub
2. Watch deployment progress
3. Copy Cloud Run URL from workflow output
4. Update `CLOUD_RUN_URL` variable in GitHub

### 4.4 Update Environment Variable

```bash
# After first deploy, get the URL
gcloud run services describe $SERVICE_NAME \
  --region=$GCP_REGION \
  --format='value(status.url)'

# Update GitHub variable CLOUD_RUN_URL with this URL
# Then re-run the workflow to set WEB_APP_URL correctly
```

---

## Step 5: Configure Telegram Bot

### 5.1 Set Bot Commands

```bash
BOT_TOKEN="your_bot_token"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "Open the app"},
      {"command": "help", "description": "Show help message"}
    ]
  }'
```

### 5.2 Set Bot Menu Button

```bash
CLOUD_RUN_URL="https://twitter-app-xxx.run.app"

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

---

## Step 6: Verify Deployment

### 6.1 Test Health Endpoint

```bash
CLOUD_RUN_URL="https://twitter-app-xxx.run.app"

curl "$CLOUD_RUN_URL/health"
# Expected: {"status":"ok","timestamp":"..."}
```

### 6.2 Test Webhook

```bash
# Check webhook status
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | jq .

# Should show:
# {
#   "url": "https://twitter-app-xxx.run.app/webhook",
#   "has_custom_certificate": false,
#   "pending_update_count": 0
# }
```

### 6.3 Test Bot in Telegram

1. Open your bot in Telegram
2. Send `/start` command
3. Click "Open App" button
4. Should see your app UI

### 6.4 Check Logs

```bash
# Stream logs
gcloud run logs tail $SERVICE_NAME --region=$GCP_REGION

# View recent logs
gcloud run logs read $SERVICE_NAME \
  --region=$GCP_REGION \
  --limit=50
```

---

## Cost Optimization

### Free Tier Limits

Cloud Run free tier (per month):
- 2 million requests
- 360,000 GB-seconds
- 180,000 vCPU-seconds

**For this app**:
- ~50,000 requests/month = FREE
- With 512Mi memory, 1 vCPU = ~20,000 GB-seconds/month = FREE

### Minimize Costs

1. **Scale to zero**
   ```bash
   --min-instances=0  # Already in workflow
   ```

2. **Right-size resources**
   ```bash
   --memory=512Mi     # Enough for Node.js + Hono
   --cpu=1            # Single vCPU sufficient
   ```

3. **Set request timeout**
   ```bash
   --timeout=60       # 60 seconds max
   ```

4. **Use Firestore free tier**
   - 50K reads/day
   - 20K writes/day
   - 20K deletes/day
   - 1 GB storage

---

## Monitoring

### Cloud Run Metrics

```bash
# View metrics in console
gcloud run services describe $SERVICE_NAME \
  --region=$GCP_REGION \
  --format='yaml(status)'

# Check revisions
gcloud run revisions list \
  --service=$SERVICE_NAME \
  --region=$GCP_REGION
```

### Set Up Alerts

```bash
# Alert on high error rate
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run Error Rate" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=60s
```

---

## Troubleshooting

### Deployment Fails

**"Permission denied"**:
```bash
# Check service account has correct roles
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@*"
```

**"Image not found"**:
```bash
# Verify Artifact Registry repository exists
gcloud artifacts repositories list --location=$GCP_REGION

# Create if missing
gcloud artifacts repositories create $SERVICE_NAME \
  --repository-format=docker \
  --location=$GCP_REGION
```

### App Not Responding

**Check logs**:
```bash
gcloud run logs tail $SERVICE_NAME --region=$GCP_REGION
```

**Common issues**:
- Missing environment variables
- Firestore permissions
- Port not set to 8080

### Webhook Not Working

**Verify webhook URL**:
```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

**Re-set webhook**:
```bash
CLOUD_RUN_URL="https://twitter-app-xxx.run.app"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "url=${CLOUD_RUN_URL}/webhook"
```

### Cold Start Issues

**Enable minimum instances** (costs money):
```bash
gcloud run services update $SERVICE_NAME \
  --region=$GCP_REGION \
  --min-instances=1
```

**Or optimize Docker image**:
- Use Alpine base (already done)
- Minimize dependencies
- Enable HTTP/2

---

## Manual Deployment (Alternative)

If you prefer to deploy manually:

```bash
# Build locally
docker build -t twitter-app .

# Tag for Artifact Registry
docker tag twitter-app $GCP_REGION-docker.pkg.dev/$PROJECT_ID/$SERVICE_NAME/$SERVICE_NAME:latest

# Authenticate Docker
gcloud auth configure-docker $GCP_REGION-docker.pkg.dev

# Push image
docker push $GCP_REGION-docker.pkg.dev/$PROJECT_ID/$SERVICE_NAME/$SERVICE_NAME:latest

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image=$GCP_REGION-docker.pkg.dev/$PROJECT_ID/$SERVICE_NAME/$SERVICE_NAME:latest \
  --platform=managed \
  --region=$GCP_REGION \
  --allow-unauthenticated \
  --set-env-vars="TELEGRAM_BOT_TOKEN=xxx,JWT_SECRET=xxx,..."

# Set webhook
CLOUD_RUN_URL=$(gcloud run services describe $SERVICE_NAME --region=$GCP_REGION --format='value(status.url)')
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" -d "url=${CLOUD_RUN_URL}/webhook"
```

---

## Security Best Practices

1. **Rotate secrets regularly**
   - JWT_SECRET: Every 6 months
   - Service account keys: Every 90 days

2. **Use Secret Manager** (instead of env vars)
   ```bash
   gcloud secrets create jwt-secret --data-file=-
   # Enter secret and Ctrl+D

   # Grant access
   gcloud secrets add-iam-policy-binding jwt-secret \
     --member="serviceAccount:${SA_EMAIL}" \
     --role="roles/secretmanager.secretAccessor"

   # Use in Cloud Run
   --set-secrets="JWT_SECRET=jwt-secret:latest"
   ```

3. **Enable VPC** (optional, for private resources)

4. **Set up Cloud Armor** (DDoS protection)

---

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GitHub Actions for GCP](https://github.com/google-github-actions)
- [Artifact Registry Guide](https://cloud.google.com/artifact-registry/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
