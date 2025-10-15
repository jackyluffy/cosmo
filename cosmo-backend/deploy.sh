#!/bin/bash

# Deployment script for Cosmo Backend on Google Cloud Run

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID=${PROJECT_ID:-"cosmo-dating-app"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"cosmo-backend"}
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${GREEN}🚀 Cosmo Backend Deployment Script${NC}"
echo "================================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

# Check if logged in to gcloud
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}Please authenticate with gcloud:${NC}"
    gcloud auth login
fi

# Set project
echo -e "${GREEN}Setting project to: ${PROJECT_ID}${NC}"
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "${GREEN}Enabling required GCP APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com

# Create service account
echo -e "${GREEN}Setting up service account...${NC}"
SERVICE_ACCOUNT="${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create ${SERVICE_NAME} \
    --display-name="Cosmo Backend Service Account" \
    --quiet || true

# Grant necessary permissions
echo -e "${GREEN}Granting IAM permissions...${NC}"
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

# Create secrets
echo -e "${GREEN}Creating secrets in Secret Manager...${NC}"

# Function to create or update secret
create_secret() {
    SECRET_NAME=$1
    SECRET_VALUE=$2

    if gcloud secrets describe ${SECRET_NAME} --project=${PROJECT_ID} &>/dev/null; then
        echo "Updating secret: ${SECRET_NAME}"
        echo -n "${SECRET_VALUE}" | gcloud secrets versions add ${SECRET_NAME} --data-file=-
    else
        echo "Creating secret: ${SECRET_NAME}"
        echo -n "${SECRET_VALUE}" | gcloud secrets create ${SECRET_NAME} --data-file=-
    fi

    # Grant access to service account
    gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet
}

# Read .env file if it exists
if [ -f .env ]; then
    echo -e "${GREEN}Loading secrets from .env file...${NC}"

    # Create secrets from .env
    create_secret "jwt-secret" "$(grep JWT_SECRET .env | cut -d '=' -f2)"
    create_secret "twilio-token" "$(grep TWILIO_AUTH_TOKEN .env | cut -d '=' -f2)"
    create_secret "sendgrid-key" "$(grep SENDGRID_API_KEY .env | cut -d '=' -f2)"
    create_secret "stripe-key" "$(grep STRIPE_SECRET_KEY .env | cut -d '=' -f2)"
    create_secret "cron-secret" "$(openssl rand -hex 32)"
else
    echo -e "${YELLOW}Warning: .env file not found. Using placeholder secrets.${NC}"
    create_secret "jwt-secret" "change-this-secret-in-production"
    create_secret "twilio-token" "your-twilio-token"
    create_secret "sendgrid-key" "your-sendgrid-key"
    create_secret "stripe-key" "your-stripe-key"
    create_secret "cron-secret" "$(openssl rand -hex 32)"
fi

# Create Firebase service account key
echo -e "${GREEN}Setting up Firebase service account...${NC}"
FIREBASE_SA_EMAIL="firebase-adminsdk@${PROJECT_ID}.iam.gserviceaccount.com"

# Check if Firebase service account exists
if ! gcloud iam service-accounts describe ${FIREBASE_SA_EMAIL} --project=${PROJECT_ID} &>/dev/null; then
    echo "Creating Firebase Admin SDK service account..."
    gcloud iam service-accounts create firebase-adminsdk \
        --display-name="Firebase Admin SDK Service Account" \
        --quiet
fi

# Generate and store service account key
echo "Generating service account key..."
gcloud iam service-accounts keys create firebase-sa.json \
    --iam-account=${FIREBASE_SA_EMAIL} \
    --quiet

# Store in Secret Manager
create_secret "firebase-sa" "$(cat firebase-sa.json)"
rm firebase-sa.json

# Create VPC connector for private Firestore access
echo -e "${GREEN}Setting up VPC connector...${NC}"
gcloud compute networks vpc-access connectors create cosmo-connector \
    --region=${REGION} \
    --subnet-mode=auto \
    --min-instances=2 \
    --max-instances=10 \
    --machine-type=e2-micro \
    --quiet || true

# Build and push Docker image
echo -e "${GREEN}Building Docker image...${NC}"
gcloud builds submit --tag ${IMAGE_NAME}:latest .

# Deploy to Cloud Run
echo -e "${GREEN}Deploying to Cloud Run...${NC}"

DEPLOYMENT_ENV=$1
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    echo "Deploying to PRODUCTION..."

    gcloud run deploy ${SERVICE_NAME} \
        --image ${IMAGE_NAME}:latest \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --port 8080 \
        --memory 1Gi \
        --cpu 2 \
        --min-instances 1 \
        --max-instances 100 \
        --concurrency 250 \
        --timeout 60 \
        --set-env-vars NODE_ENV=production,PROJECT_ID=${PROJECT_ID} \
        --set-secrets JWT_SECRET=jwt-secret:latest \
        --set-secrets FIREBASE_SERVICE_ACCOUNT=firebase-sa:latest \
        --set-secrets TWILIO_AUTH_TOKEN=twilio-token:latest \
        --set-secrets SENDGRID_API_KEY=sendgrid-key:latest \
        --set-secrets STRIPE_SECRET_KEY=stripe-key:latest \
        --set-secrets CRON_SECRET=cron-secret:latest \
        --service-account ${SERVICE_ACCOUNT} \
        --vpc-connector projects/${PROJECT_ID}/locations/${REGION}/connectors/cosmo-connector
else
    echo "Deploying to STAGING..."

    gcloud run deploy ${SERVICE_NAME}-staging \
        --image ${IMAGE_NAME}:latest \
        --region ${REGION} \
        --platform managed \
        --allow-unauthenticated \
        --port 8080 \
        --memory 512Mi \
        --cpu 1 \
        --min-instances 0 \
        --max-instances 10 \
        --concurrency 100 \
        --timeout 60 \
        --set-env-vars NODE_ENV=staging,PROJECT_ID=${PROJECT_ID} \
        --set-secrets JWT_SECRET=jwt-secret:latest \
        --set-secrets FIREBASE_SERVICE_ACCOUNT=firebase-sa:latest \
        --set-secrets TWILIO_AUTH_TOKEN=twilio-token:latest \
        --set-secrets SENDGRID_API_KEY=sendgrid-key:latest \
        --set-secrets STRIPE_SECRET_KEY=stripe-key:latest \
        --set-secrets CRON_SECRET=cron-secret:latest \
        --service-account ${SERVICE_ACCOUNT} \
        --vpc-connector projects/${PROJECT_ID}/locations/${REGION}/connectors/cosmo-connector
fi

# Get the service URL
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
    CRON_SERVICE_NAME=${SERVICE_NAME}
else
    SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME}-staging --region ${REGION} --format 'value(status.url)')
    CRON_SERVICE_NAME=${SERVICE_NAME}-staging
fi

echo -e "${GREEN}Service deployed to: ${SERVICE_URL}${NC}"

# Set up Cloud Scheduler jobs
if [ "$DEPLOYMENT_ENV" = "production" ]; then
    echo -e "${GREEN}Setting up Cloud Scheduler jobs...${NC}"

    # Get cron secret
    CRON_SECRET_VALUE=$(gcloud secrets versions access latest --secret="cron-secret")

    # Daily matching at 2 AM PST
    gcloud scheduler jobs create http daily-matching \
        --location=${REGION} \
        --schedule="0 2 * * *" \
        --time-zone="America/Los_Angeles" \
        --uri="${SERVICE_URL}/api/v1/cron/daily-matching" \
        --http-method=POST \
        --headers="x-cron-secret=${CRON_SECRET_VALUE}" \
        --attempt-deadline=600s \
        --quiet || \
    gcloud scheduler jobs update http daily-matching \
        --location=${REGION} \
        --uri="${SERVICE_URL}/api/v1/cron/daily-matching" \
        --quiet

    # OTP cleanup at midnight
    gcloud scheduler jobs create http cleanup-otp \
        --location=${REGION} \
        --schedule="0 0 * * *" \
        --time-zone="America/Los_Angeles" \
        --uri="${SERVICE_URL}/api/v1/cron/cleanup-otp" \
        --http-method=POST \
        --headers="x-cron-secret=${CRON_SECRET_VALUE}" \
        --attempt-deadline=300s \
        --quiet || \
    gcloud scheduler jobs update http cleanup-otp \
        --location=${REGION} \
        --uri="${SERVICE_URL}/api/v1/cron/cleanup-otp" \
        --quiet

    # Subscription updates at 3 AM
    gcloud scheduler jobs create http update-subscriptions \
        --location=${REGION} \
        --schedule="0 3 * * *" \
        --time-zone="America/Los_Angeles" \
        --uri="${SERVICE_URL}/api/v1/cron/update-subscriptions" \
        --http-method=POST \
        --headers="x-cron-secret=${CRON_SECRET_VALUE}" \
        --attempt-deadline=300s \
        --quiet || \
    gcloud scheduler jobs update http update-subscriptions \
        --location=${REGION} \
        --uri="${SERVICE_URL}/api/v1/cron/update-subscriptions" \
        --quiet

    echo -e "${GREEN}Cloud Scheduler jobs configured${NC}"
fi

# Test the deployment
echo -e "${GREEN}Testing deployment...${NC}"
curl -s -o /dev/null -w "Health check status: %{http_code}\n" ${SERVICE_URL}/health

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo "================================"
echo "Service URL: ${SERVICE_URL}"
echo "Logs: gcloud run logs read ${CRON_SERVICE_NAME} --region ${REGION}"
echo "================================"