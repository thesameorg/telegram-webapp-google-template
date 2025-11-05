# Google Artifact Registry Setup

Before the GitHub Actions workflow can push Docker images, you need to create an Artifact Registry repository in your Google Cloud project.

## Prerequisites

- Google Cloud CLI (`gcloud`) installed and configured
- Authenticated to your GCP project: `gcloud auth login`
- Project ID set: `gcloud config set project YOUR_PROJECT_ID`

## Create the Artifact Registry Repository

### Option 1: Using gcloud CLI

```bash
# Enable Artifact Registry API (if not already enabled)
gcloud services enable artifactregistry.googleapis.com

# Create the repository
gcloud artifacts repositories create twitter-app \
    --repository-format=docker \
    --location=us-central1 \
    --description="Twitter app Docker images for Cloud Run"
```

**Note:** Change `us-central1` to your preferred region if you want to use a different one.

### Option 2: Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **Artifact Registry** (use search or find in menu)
4. Click **+ CREATE REPOSITORY**
5. Fill in:
   - **Name**: `twitter-app`
   - **Format**: `Docker`
   - **Location type**: `Region`
   - **Region**: `us-central1` (or your preferred region)
   - **Description**: `Twitter app Docker images for Cloud Run`
6. Click **CREATE**

## Configure GitHub Variables (Optional)

If you want to use a different region or service name, set these in your GitHub repository:

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions → Variables tab
3. Add these variables:
   - `CLOUD_RUN_REGION`: Your GCP region (e.g., `us-central1`, `europe-west1`)
   - `CLOUD_RUN_SERVICE_NAME`: Your service name (default: `twitter-app`)
   - `CLOUD_RUN_URL`: Will be set after first deployment

## Verify

After creating the repository, verify it exists:

```bash
gcloud artifacts repositories list --location=us-central1
```

You should see `twitter-app` in the list.

## Regions

Common GCP regions:
- `us-central1` (Iowa) - Default, good for US
- `us-east1` (South Carolina)
- `us-west1` (Oregon)
- `europe-west1` (Belgium)
- `asia-northeast1` (Tokyo)

**Choose the region closest to your users for lower latency.**

## Next Steps

After creating the repository:
1. Push to `main` branch or manually trigger the workflow
2. The GitHub Action will build and push the Docker image
3. Cloud Run will deploy your service
4. Note the deployed URL and set it as `CLOUD_RUN_URL` GitHub variable
