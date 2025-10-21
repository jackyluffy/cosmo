# Cosmo Backend Deployment Guide

## Current Production Setup

### Backend Services
You have **TWO** separate backend deployments in Google Cloud Run:

1. **us-west1** (PRIMARY - Used by TestFlight/Production)
   - URL: `https://cosmo-backend-691853413697.us-west1.run.app`
   - Used by: Production iOS app (TestFlight)
   - Configured in: `cosmo/.env.production`
   - Current Revision: `cosmo-backend-00080-6s6`

2. **us-central1** (SECONDARY - Not actively used)
   - URL: `https://cosmo-backend-691853413697.us-central1.run.app`
   - Current Revision: `cosmo-backend-00008-g5w`
   - Status: Has been receiving deployments but app doesn't use it

### Frontend Configuration

**Development** (`cosmo/.env.development`):
```
EXPO_PUBLIC_API_URL=http://192.168.1.68:8080
```
- Uses local backend server on your machine
- For development with Expo Go

**Production** (`cosmo/.env.production`):
```
EXPO_PUBLIC_API_URL=https://cosmo-backend-691853413697.us-west1.run.app
```
- Used by TestFlight builds
- Points to **us-west1** backend

## How to Deploy Backend

### For Production/TestFlight Users (us-west1)

**IMPORTANT**: This is the deployment you should use for all production changes.

```bash
# Navigate to backend directory
cd /Users/luffy/Desktop/cosmo_app/cosmo-backend

# Deploy to us-west1 (this is what TestFlight uses)
gcloud builds submit \
  --region=us-west1 \
  --tag us-west1-docker.pkg.dev/cosmo-production-473621/cloud-run-source-deploy/cosmo-backend \
  && \
gcloud run deploy cosmo-backend \
  --image us-west1-docker.pkg.dev/cosmo-production-473621/cloud-run-source-deploy/cosmo-backend \
  --region us-west1 \
  --platform managed \
  --allow-unauthenticated \
  --project cosmo-production-473621
```

**What this does**:
1. Builds Docker image in us-west1
2. Pushes to Artifact Registry: `us-west1-docker.pkg.dev/.../cloud-run-source-deploy/cosmo-backend`
3. Deploys to Cloud Run in us-west1
4. Creates new revision and routes 100% traffic to it

### Deployment Time
- Build time: ~2-3 minutes
- Deployment time: ~30-60 seconds
- **Total**: ~3-4 minutes

### Verifying Deployment

```bash
# Check which revision is serving traffic in us-west1
gcloud run services describe cosmo-backend \
  --region us-west1 \
  --project cosmo-production-473621 \
  --format="value(status.traffic[0].revisionName,status.url)"

# View recent logs
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=cosmo-backend" \
  --limit 50 \
  --project cosmo-production-473621
```

## Deployment Checklist

Before deploying:
- [ ] Test changes locally with development backend
- [ ] Ensure all TypeScript compilation passes (`npm run build`)
- [ ] Verify environment variables are set correctly
- [ ] Check that migrations (if any) are compatible

After deploying:
- [ ] Verify new revision is serving 100% traffic
- [ ] Check Cloud Run logs for errors
- [ ] Test critical endpoints (auth, chat, events)
- [ ] Monitor for any increase in error rates

## Common Issues

### Issue: "Repository not found"
**Solution**: Make sure you're using the correct region and repository:
- ✅ Correct: `us-west1-docker.pkg.dev/cosmo-production-473621/cloud-run-source-deploy/cosmo-backend`
- ❌ Wrong: `us-west2-docker.pkg.dev/...` (wrong region)

### Issue: Authentication errors during deployment
**Solution**: Re-authenticate with gcloud:
```bash
gcloud auth login
```

### Issue: Changes not reflecting in TestFlight
**Possible causes**:
1. Deployed to wrong region (us-central1 instead of us-west1)
2. TestFlight app has old build with different API URL
3. Caching issues - wait 1-2 minutes after deployment

## Available Artifact Repositories

```
cosmo-backend               DOCKER  us-central1  (alternative repository)
cloud-run-source-deploy     DOCKER  us-west1     (PRIMARY - use this)
cosmo-docker               DOCKER  us-west1     (legacy)
```

## Recommendation: Consolidate Deployments

Currently you have backends in both us-west1 and us-central1. Consider:

**Option 1**: Keep us-west1 only (RECOMMENDED)
- Delete us-central1 deployment
- All traffic already goes to us-west1
- Simpler to maintain

**Option 2**: Switch to us-central1
- Update `cosmo/.env.production` to use us-central1 URL
- Rebuild and redeploy iOS app to TestFlight
- Delete us-west1 deployment

**Current recommendation**: Stick with us-west1 (no changes needed)

## Environment Variables in Cloud Run

The backend service gets credentials via:
- `GOOGLE_APPLICATION_CREDENTIALS_BASE64` (preferred)
- Or Application Default Credentials (ADC)

Firebase project: `cosmo-production-473621`

## Quick Reference

| Environment | Backend URL | Region | Usage |
|------------|-------------|--------|-------|
| Local Dev | http://192.168.1.68:8080 | N/A | Expo development |
| Production | https://cosmo-backend-691853413697.us-west1.run.app | us-west1 | TestFlight/Production |

---

**Last Updated**: 2025-10-20
**Current Production Revision**: cosmo-backend-00080-6s6 (us-west1)
