#!/bin/bash

# Push Docker image to Google Artifact Registry

set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

set -a
source .env
set +a

# Authenticate to GCP if GCP_SA_KEY is provided
if [ -n "$GCP_SA_KEY" ]; then
    echo "Authenticating to Google Cloud..."
    echo "$GCP_SA_KEY" | base64 -d > /tmp/gcp-key.json
    gcloud auth activate-service-account --key-file=/tmp/gcp-key.json
    gcloud config set project "$GCP_PROJECT_ID"
    rm /tmp/gcp-key.json
    echo "Authenticated successfully"
else
    echo "Using existing gcloud credentials"
    gcloud config set project "$GCP_PROJECT_ID"
fi

# Configure Docker for Artifact Registry
echo ""
echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
echo "Docker configured"

# Generate commit SHA
if git rev-parse HEAD >/dev/null 2>&1; then
    COMMIT_SHA=$(git rev-parse HEAD)
else
    COMMIT_SHA=$(date +%s)
fi

IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

echo ""
echo "========================================"
echo "Pushing Docker Image"
echo "========================================"
echo "Image: ${IMAGE_NAME}"
echo "========================================"

docker push "${IMAGE_NAME}:${COMMIT_SHA}"
docker push "${IMAGE_NAME}:latest"

echo ""
echo "Push complete!"
