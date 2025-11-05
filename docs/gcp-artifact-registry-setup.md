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

# Create the repository (use your service name)
gcloud artifacts repositories create telegram-webapp-google-tpl \
    --repository-format=docker \
    --location=asia-se1 \
    --description="Telegram WebApp Docker images for Cloud Run"
```

**Note:** Change `asia-se1` to your preferred region and `telegram-webapp-google-tpl` to your service name.

### Option 2: Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **Artifact Registry** (use search or find in menu)
4. Click **+ CREATE REPOSITORY**
5. Fill in:
   - **Name**: `telegram-webapp-google-tpl` (or your service name)
   - **Format**: `Docker`
   - **Location type**: `Region`
   - **Region**: `asia-se1` (or your preferred region)
   - **Description**: `Telegram WebApp Docker images for Cloud Run`
6. Click **CREATE**

## Configure GitHub Variables (Optional)

If you want to use a different region or service name, set these in your GitHub repository:

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions → Variables tab
3. Add these variables (all optional, defaults shown):
   - `GCP_REGION`: Your GCP region - default: `asia-se1` (e.g., `us-central1`, `europe-west1`)
   - `SERVICE_NAME`: Your service name - default: `telegram-webapp-google-tpl`
   - `WEB_APP_URL`: Your deployed URL - set this after first deployment for webhook configuration

## Verify

After creating the repository, verify it exists:

```bash
gcloud artifacts repositories list --location=asia-se1
```

You should see your repository (e.g., `telegram-webapp-google-tpl`) in the list.

## Regions

Common GCP regions:
- `us-central1` (Iowa) - Default, good for US
- `us-east1` (South Carolina)
- `us-west1` (Oregon)
- `europe-west1` (Belgium)
- `asia-northeast1` (Tokyo)

**Choose the region closest to your users for lower latency.**

## Understanding the Image Path

The workflow uses the following format for Docker images:

```
REGION-docker.pkg.dev/PROJECT_ID/SERVICE_NAME/SERVICE_NAME:TAG
```

**Simplified Structure:** We use `SERVICE_NAME` for both the Artifact Registry repository name AND the image name. This keeps everything consistent and easy to understand.

For example:
```
asia-se1-docker.pkg.dev/my-project/telegram-webapp-google-tpl/telegram-webapp-google-tpl:latest
                                    ^^^^^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^^
                                    (repository name)         (image name)
```

**Important:** Create your Artifact Registry repository with the same name as your service. The workflow defaults to `telegram-webapp-google-tpl` for both.

## Next Steps

After creating the repository:
1. Ensure the repository name matches your `SERVICE_NAME` (default: `telegram-webapp-google-tpl`)
2. Push to `main` branch or manually trigger the workflow
3. The GitHub Action will build and push the Docker image
4. Cloud Run will deploy your service
5. Note the deployed URL and set it as `WEB_APP_URL` GitHub variable for webhook configuration
