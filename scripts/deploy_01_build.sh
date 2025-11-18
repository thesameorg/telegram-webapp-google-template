#!/bin/bash

# Build Docker image locally

set -e

# Load environment variables
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

set -a
source .env
set +a

# Generate commit SHA
if git rev-parse HEAD >/dev/null 2>&1; then
    COMMIT_SHA=$(git rev-parse HEAD)
    SHORT_SHA=$(git rev-parse --short HEAD)
else
    COMMIT_SHA=$(date +%s)
    SHORT_SHA="local-${COMMIT_SHA}"
fi

IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${SERVICE_NAME}/${SERVICE_NAME}"

echo "========================================"
echo "Building Docker Image"
echo "========================================"
echo "Image: ${IMAGE_NAME}"
echo "Tag:   ${COMMIT_SHA}"
echo "========================================"

docker build --platform linux/amd64 -t "${IMAGE_NAME}:${COMMIT_SHA}" .
docker tag "${IMAGE_NAME}:${COMMIT_SHA}" "${IMAGE_NAME}:latest"

echo ""
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${COMMIT_SHA}"
echo "Image: ${IMAGE_NAME}:latest"
