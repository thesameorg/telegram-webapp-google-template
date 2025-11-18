# Deployment Scripts

Organized deployment pipeline for deploying the Telegram WebApp to Google Cloud Run.

## Directory Structure

```
scripts/
├── deploy.sh                 # Main orchestrator - runs all stages
├── deploy_01_build.sh        # Stage 1: Build Docker image
├── deploy_02_push.sh         # Stage 2: Push to Artifact Registry
├── deploy_03_deploy.sh       # Stage 3: Deploy to Cloud Run
├── deploy_04_verify.sh       # Stage 4: Verify & configure webhook
├── tunnel.sh                 # Development: Local ngrok tunnel
├── webhook.sh                # Development: Configure webhook
└── README.md                 # This file
```

## Quick Start

### Complete Deployment
Run all stages in sequence:
```bash
./scripts/deploy.sh
```

### Individual Stages
Run stages independently:
```bash
./scripts/deploy_01_build.sh    # Build Docker image (linux/amd64)
./scripts/deploy_02_push.sh     # Push to Google Artifact Registry
./scripts/deploy_03_deploy.sh   # Deploy to Cloud Run
./scripts/deploy_04_verify.sh   # Verify deployment & set webhook
```

## Deployment Stages

### Stage 1: Build (`deploy_01_build.sh`)
- Builds Docker image with `--platform linux/amd64` flag
- Tags with git commit SHA and `:latest`
- Uses multi-stage Dockerfile to optimize image size

**Output**: Local Docker image

### Stage 2: Push (`deploy_02_push.sh`)
- Authenticates to Google Cloud (using `GCP_SA_KEY` or existing credentials)
- Configures Docker for Artifact Registry
- Pushes both SHA-tagged and `:latest` images

**Output**: Images in Artifact Registry

### Stage 3: Deploy (`deploy_03_deploy.sh`)
- Validates all required environment variables
- Deploys container to Cloud Run with configuration:
  - 0-10 instances (auto-scaling)
  - 1 CPU, 512Mi memory
  - 300s timeout
  - Port 8080
- Sets all environment variables (including Firebase credentials)

**Output**: Running Cloud Run service

### Stage 4: Verify (`deploy_04_verify.sh`)
- Retrieves service URL
- Tests `/health` endpoint
- Configures Telegram webhook (if `TELEGRAM_BOT_TOKEN` is valid)
- Displays deployment summary

**Output**: Verified deployment

## Prerequisites

### Required Tools
1. **Google Cloud CLI** (`gcloud`)
2. **Docker** (with linux/amd64 build support)
3. **curl** (for API calls)
4. **jq** (optional, for JSON parsing)

### Environment Variables

Create `.env` file in project root:

```bash
# Google Cloud Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=asia-southeast1
SERVICE_NAME=telegram-webapp-google-tpl

# Service Account Key (base64 encoded, optional if using gcloud auth)
GCP_SA_KEY=your-base64-encoded-service-account-key

# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Security
JWT_SECRET=your-jwt-secret-here

# Firebase/Firestore Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Application URL (will be set after first deployment)
WEB_APP_URL=https://your-service.run.app
```

### Important Notes on Environment Variables

#### `FIREBASE_PRIVATE_KEY`
Must be quoted with literal `\n` characters:
```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvw...\n-----END PRIVATE KEY-----\n"
```

#### `GCP_SA_KEY`
Base64 encode your service account JSON:
```bash
GCP_SA_KEY=$(cat service-account-key.json | base64)
```

Or use existing gcloud credentials (omit this variable).

## Deployment Workflows

### First Time Deployment

1. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Run initial deployment**
   ```bash
   ./scripts/deploy.sh
   ```

3. **Update WEB_APP_URL**
   ```bash
   # Copy the URL from deployment output
   # Update .env file with the new URL
   WEB_APP_URL=https://your-actual-service-url.run.app
   ```

4. **Re-deploy to set WEB_APP_URL**
   ```bash
   ./scripts/deploy_03_deploy.sh
   ./scripts/deploy_04_verify.sh
   ```

### Iterative Development

For code changes:
```bash
./scripts/deploy.sh  # Full pipeline
```

For config-only changes (environment variables):
```bash
./scripts/deploy_03_deploy.sh  # Skip build/push
```

To rebuild only (testing Docker build):
```bash
./scripts/deploy_01_build.sh
```

### Troubleshooting Deployment

Check each stage independently:

```bash
# 1. Test build locally
./scripts/deploy_01_build.sh
docker run --rm -p 8080:8080 --env-file .env \
  asia-southeast1-docker.pkg.dev/PROJECT/SERVICE/SERVICE:latest

# 2. Verify push succeeded
gcloud artifacts docker images list \
  asia-southeast1-docker.pkg.dev/PROJECT/SERVICE/SERVICE

# 3. Check Cloud Run deployment
gcloud run services describe SERVICE --region REGION

# 4. View logs
gcloud run logs tail SERVICE --region REGION
```

## Architecture Details

### Platform Compatibility
**Critical**: Always build with `--platform linux/amd64`
- Cloud Run runs on AMD64 architecture
- Mac M1/M2 users: Docker defaults to ARM64
- Without platform flag: "exec format error" on deployment

### Multi-Stage Build
Dockerfile uses 3 stages:
1. **frontend-builder**: Builds React app
2. **backend-builder**: Compiles TypeScript
3. **Production runtime**: Minimal Node.js image with only production dependencies

### Environment Variable Handling
Scripts use `set -a; source .env; set +a` pattern:
- Handles multiline variables (like `FIREBASE_PRIVATE_KEY`)
- Preserves special characters
- Better than `export $(grep -v '^#' .env | xargs)`

### Cloud Run Configuration
- **Scaling**: 0 min (scales to zero), 10 max instances
- **Timeout**: 300s (increased from default 60s for Firebase init)
- **Port**: 8080 (explicitly set, matching Dockerfile EXPOSE)
- **Memory**: 512Mi (sufficient for Node.js + Express)
- **CPU**: 1 (always allocated, not just during requests)

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/deploy.yml`) mirrors these scripts:
- Same build flags (`--platform linux/amd64`)
- Same Cloud Run configuration
- Same environment variable handling
- Automatically runs on push to `main` branch

### Required GitHub Secrets
```
GCP_PROJECT_ID
GCP_SA_KEY (base64 encoded JSON)
TELEGRAM_BOT_TOKEN
JWT_SECRET
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

### Required GitHub Variables
```
GCP_REGION (default: asia-southeast1)
SERVICE_NAME (default: telegram-webapp-google-tpl)
WEB_APP_URL
```

## Common Issues

### "exec format error"
**Cause**: Wrong architecture
**Fix**: Rebuild with `--platform linux/amd64`

### "Container failed to start"
**Cause**: Usually Firebase credentials or timeout
**Fix**:
- Check Firebase credentials are valid
- Verify `FIREBASE_PRIVATE_KEY` has proper newlines
- Check Cloud Run logs for specific error

### "Permission denied"
**Cause**: Service account lacks IAM permissions
**Fix**: Grant service account these roles:
- Cloud Run Admin
- Artifact Registry Writer
- Service Account User

### Webhook configuration fails
**Cause**: Invalid bot token or bot not found
**Fix**: Verify `TELEGRAM_BOT_TOKEN` with:
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

## Development Tools

### `tunnel.sh`
Creates ngrok tunnel for local development:
```bash
./scripts/tunnel.sh
```

### `webhook.sh`
Manually configure Telegram webhook:
```bash
./scripts/webhook.sh
```

## Performance Tips

1. **Layer caching**: Scripts tag with both SHA and `:latest` to maximize cache hits
2. **Parallel stages**: Run build on separate machine while deploying previous version
3. **Incremental deploys**: Use `deploy_03_deploy.sh` for config-only changes
4. **Multi-region**: Deploy to multiple regions by changing `GCP_REGION` env var

## Security Considerations

- Never commit `.env` file (already in `.gitignore`)
- Service account keys should have minimal permissions
- Use GitHub Secrets for CI/CD, never hardcode
- Rotate `JWT_SECRET` periodically
- Consider Cloud Secret Manager for production

## Support

For issues or questions:
1. Check Cloud Run logs: `gcloud run logs tail SERVICE --region REGION`
2. Review deployment output from scripts
3. Validate environment variables are set correctly
4. Test Firebase credentials independently
