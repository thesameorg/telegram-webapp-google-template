#!/bin/bash

# Deploy to Cloud Run (assumes image is already pushed)

set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

set -a
source .env
set +a

# Validate required environment variables
REQUIRED_VARS=(
    "GCP_PROJECT_ID"
    "GCP_REGION"
    "SERVICE_NAME"
    "TELEGRAM_BOT_TOKEN"
    "JWT_SECRET"
    "FIREBASE_PROJECT_ID"
    "FIREBASE_CLIENT_EMAIL"
    "FIREBASE_PRIVATE_KEY"
    "WEB_APP_URL"
)

echo "Validating environment variables..."
MISSING_VARS=()
for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "Missing required environment variables:"
    printf '   - %s\n' "${MISSING_VARS[@]}"
    exit 1
fi

# Generate commit SHA
if git rev-parse HEAD >/dev/null 2>&1; then
    COMMIT_SHA=$(git rev-parse HEAD)
else
    COMMIT_SHA=$(date +%s)
fi

IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

echo ""
echo "========================================"
echo "Deploying to Cloud Run"
echo "========================================"
echo "Service: ${SERVICE_NAME}"
echo "Region:  ${GCP_REGION}"
echo "Image:   ${IMAGE_NAME}:${COMMIT_SHA}"
echo "========================================"

gcloud run deploy "$SERVICE_NAME" \
  --image="${IMAGE_NAME}:${COMMIT_SHA}" \
  --platform=managed \
  --region="$GCP_REGION" \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN},JWT_SECRET=${JWT_SECRET},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID},FIREBASE_CLIENT_EMAIL=${FIREBASE_CLIENT_EMAIL},FIREBASE_PRIVATE_KEY=${FIREBASE_PRIVATE_KEY},WEB_APP_URL=${WEB_APP_URL}" \
  --min-instances=0 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=300 \
  --port=8080

echo ""
echo "Deployment complete!"
