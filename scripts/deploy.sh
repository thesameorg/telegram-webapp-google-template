#!/bin/bash

# Complete deployment pipeline for Google Cloud Run
# Orchestrates all deployment stages: build -> push -> deploy -> verify

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "Starting Complete Deployment Pipeline"
echo "========================================"
echo ""

# Stage 1: Build
echo "==> Stage 1: Building Docker image"
"${SCRIPT_DIR}/deploy_01_build.sh"
echo ""

# Stage 2: Push
echo "==> Stage 2: Pushing to Artifact Registry"
"${SCRIPT_DIR}/deploy_02_push.sh"
echo ""

# Stage 3: Deploy
echo "==> Stage 3: Deploying to Cloud Run"
"${SCRIPT_DIR}/deploy_03_deploy.sh"
echo ""

# Stage 4: Verify
echo "==> Stage 4: Verifying deployment"
"${SCRIPT_DIR}/deploy_04_verify.sh"
echo ""

echo "========================================"
echo "Deployment Pipeline Complete!"
echo "========================================"
