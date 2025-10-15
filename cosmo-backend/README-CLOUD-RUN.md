# Cosmo Backend - Google Cloud Run Edition 🚀

A fully containerized, serverless backend for the Cosmo dating app deployed on Google Cloud Run.

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Cloud Run     │────▶│  Firestore   │────▶│ Cloud Storage   │
│   Container     │     │   Database   │     │   (Photos)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
         │                      │
         │              ┌──────────────┐
         └─────────────▶│    Secret    │
                        │   Manager    │
                        └──────────────┘
```

## ✨ Key Features

- **Containerized Deployment**: Docker-based for consistency across environments
- **Auto-scaling**: Scales from 0 to 100+ instances based on traffic
- **Global CDN**: Automatic edge caching via Cloud Run
- **Secure Secrets**: All credentials stored in Secret Manager
- **VPC Connectivity**: Private connection to Firestore
- **Health Checks**: Built-in liveness and readiness probes
- **Structured Logging**: Cloud Logging integration with Pino

## 🚀 Quick Start

### Prerequisites

1. Install Google Cloud SDK:
```bash
brew install google-cloud-sdk
```

2. Authenticate with GCP:
```bash
gcloud auth login
gcloud auth application-default login
```

3. Set your project:
```bash
gcloud config set project YOUR_PROJECT_ID
```

### Local Development

1. Clone and install:
```bash
cd cosmo-backend
npm install
```

2. Set up environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Run locally:
```bash
npm run dev
```

4. Run with Docker:
```bash
npm run docker:build
npm run docker:run
```

### Deployment

#### Automated Deployment (Recommended)

```bash
# Deploy to staging
./deploy.sh staging

# Deploy to production
./deploy.sh production
```

#### Manual Deployment

1. Build and push image:
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/cosmo-backend
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy cosmo-backend \
  --image gcr.io/YOUR_PROJECT/cosmo-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

## 📁 Project Structure

```
cosmo-backend/
├── Dockerfile              # Multi-stage Docker build
├── cloudbuild.yaml        # CI/CD configuration
├── deploy.sh              # Deployment script
├── src/
│   ├── server.ts          # Express server entry point
│   ├── app.ts             # Application configuration
│   ├── routes/            # API route definitions
│   │   ├── auth.routes.ts
│   │   ├── profile.routes.ts
│   │   ├── event.routes.ts
│   │   ├── swipe.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── billing.routes.ts
│   │   ├── cron.routes.ts
│   │   └── admin.routes.ts
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   └── config/            # Configuration files
└── package.json
```

## 🔧 Configuration

### Environment Variables

```env
# Server
NODE_ENV=production
PORT=8080

# Google Cloud
PROJECT_ID=your-project-id
REGION=us-central1

# Authentication
JWT_SECRET=your-jwt-secret

# External Services
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@cosmo.app
STRIPE_SECRET_KEY=sk_live_xxxxx

# Cron Jobs
CRON_SECRET=your-cron-secret
```

### Secret Management

All sensitive data is stored in Google Secret Manager:

```bash
# Create a secret
echo -n "my-secret-value" | gcloud secrets create my-secret --data-file=-

# Access in Cloud Run
gcloud run services update cosmo-backend \
  --set-secrets MY_SECRET=my-secret:latest
```

## 📊 API Endpoints

### Public Endpoints
- `POST /api/v1/auth/otp/request` - Request OTP
- `POST /api/v1/auth/otp/verify` - Verify OTP
- `GET /health` - Health check
- `GET /ready` - Readiness check

### Protected Endpoints (JWT Required)
- `GET /api/v1/profile/me` - Get user profile
- `PUT /api/v1/profile` - Update profile
- `POST /api/v1/profile/photo` - Upload photo
- `GET /api/v1/events` - List events
- `POST /api/v1/events/:id/join` - Join event
- `GET /api/v1/swipe/deck` - Get swipe deck
- `POST /api/v1/swipe/:id` - Swipe on profile

### Cron Endpoints (Secret Header Required)
- `POST /api/v1/cron/daily-matching` - Run matching algorithm
- `POST /api/v1/cron/cleanup-otp` - Clean expired OTPs
- `POST /api/v1/cron/update-subscriptions` - Update subscription statuses
- `POST /api/v1/cron/weekly-analytics` - Generate analytics report

## 🕐 Scheduled Jobs

Configure Cloud Scheduler to call cron endpoints:

```bash
# Daily matching at 2 AM PST
gcloud scheduler jobs create http daily-matching \
  --schedule="0 2 * * *" \
  --uri="https://cosmo-backend.run.app/api/v1/cron/daily-matching" \
  --headers="x-cron-secret=YOUR_SECRET"
```

## 🔍 Monitoring & Logging

### View Logs
```bash
# Real-time logs
gcloud run logs read cosmo-backend --region us-central1

# Tail logs
gcloud run logs tail cosmo-backend --region us-central1
```

### Metrics
Access metrics in Cloud Console:
- Request count
- Latency (p50, p95, p99)
- Error rate
- Container CPU/Memory usage
- Cold start frequency

### Custom Metrics
```bash
curl https://YOUR_SERVICE_URL/metrics
```

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Smoke Tests
```bash
npm run test:smoke -- --url=https://YOUR_SERVICE_URL
```

## 🚢 CI/CD Pipeline

### GitHub Actions
```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: google-github-actions/setup-gcloud@v0
      - run: gcloud builds submit --config cloudbuild.yaml
```

### Cloud Build Triggers
1. Go to Cloud Build Triggers
2. Connect your GitHub repository
3. Create trigger for main branch
4. Use included `cloudbuild.yaml`

## 🔒 Security Best Practices

1. **Least Privilege**: Service account with minimal permissions
2. **Secret Rotation**: Rotate secrets regularly via Secret Manager
3. **VPC Connector**: Private connection to Firestore
4. **Rate Limiting**: Built-in rate limiting per endpoint
5. **Input Validation**: Joi validation on all inputs
6. **CORS Configuration**: Strict origin validation
7. **Helmet.js**: Security headers enabled

## 💰 Cost Optimization

- **Scale to Zero**: No charges when idle
- **CPU Allocation**: Only during request processing
- **Memory**: Right-sized based on workload
- **Regional Deployment**: Single region to minimize costs
- **Firestore Indexes**: Optimized queries
- **Image Compression**: Reduce storage costs

## 🆘 Troubleshooting

### Container fails to start
```bash
# Check build logs
gcloud builds list --limit=5

# Check deployment logs
gcloud run services describe cosmo-backend --region us-central1
```

### High latency
- Check cold start frequency
- Increase minimum instances
- Optimize container size

### Database connection issues
- Verify VPC connector
- Check Firestore rules
- Validate service account permissions

## 📈 Performance Tuning

### Container Optimization
- Multi-stage Docker build
- Alpine Linux base image
- Production dependencies only
- Layer caching

### Cloud Run Settings
```bash
# Increase concurrency
--concurrency=1000

# Increase memory
--memory=2Gi

# Set minimum instances
--min-instances=1
```

## 🔄 Migration from Firebase Functions

Key differences:
1. **Entry Point**: `server.ts` instead of `index.ts`
2. **Cron Jobs**: HTTP endpoints instead of pubsub triggers
3. **Deployment**: Docker/Cloud Run instead of Firebase CLI
4. **Secrets**: Secret Manager instead of functions config
5. **Logging**: Structured logging for Cloud Logging

## 📚 Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Firestore Best Practices](https://cloud.google.com/firestore/docs/best-practices)
- [Secret Manager Guide](https://cloud.google.com/secret-manager/docs)
- [Cloud Build Configuration](https://cloud.google.com/build/docs/build-config)

## 📝 License

Proprietary - All rights reserved