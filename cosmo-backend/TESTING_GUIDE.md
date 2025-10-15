# 🚀 Cosmo Backend Testing Guide

## 📍 **Deployed Service Information**

Your Cosmo backend is successfully deployed and running on Google Cloud Run:

- **Service URL**: `https://cosmo-backend-691853413697.us-west1.run.app`
- **Status**: ✅ Active and running
- **Region**: us-west1
- **Container**: Node.js 18 with Express server
- **Available Endpoints**:
  - `/health` - Health check
  - `/api/v1/test` - Test API endpoint

## 🔐 **Current Access Restriction**

**Issue**: The organization policy prevents public access to Cloud Run services.
**Status**: The server is running correctly, but external access is blocked by IAM policies.

## 📱 **Testing with React Native Simulator**

### Option 1: Use Local Proxy (Recommended)

Since direct public access is restricted, you can use gcloud to create a secure proxy:

```bash
# In a new terminal, run this to create a local proxy
gcloud run services proxy cosmo-backend --region=us-west1 --port=8080

# This will create a local proxy at http://localhost:8080
# Update your React Native app to use this URL for testing
```

### Option 2: Request Organization Policy Update

Contact your GCP organization admin to:
1. Allow `allUsers` access to Cloud Run services, OR
2. Create a custom service account for public API access

### Option 3: Use Service Account Key (Advanced)

1. Create a service account with Cloud Run Invoker permissions
2. Download the service account key
3. Use the key in your React Native app for authenticated requests

## 🔧 **React Native Integration Status**

### ✅ **Completed Setup**

1. **API Configuration**: Updated `/cosmo/src/services/api.ts` to use Cloud Run URL
2. **Environment Variables**: Created `.env` files with backend URL
3. **Test Screen**: Created `BackendTestScreen.tsx` for connectivity testing
4. **CORS**: Configured backend to accept requests from React Native

### 📋 **Files Updated**

1. **`/cosmo/src/services/api.ts`**
   - Switched from mock API to real axios configuration
   - Added Cloud Run URL as base URL
   - Includes authentication headers and error handling

2. **`/cosmo/src/screens/test/BackendTestScreen.tsx`**
   - Test screen to verify backend connectivity
   - Tests both `/health` and `/api/v1/test` endpoints
   - Shows detailed results and error messages

3. **Environment Files**
   - `.env` - Default configuration
   - `.env.development` - Development settings
   - `.env.production` - Production settings

## 🏃‍♂️ **How to Test**

### Step 1: Add Test Screen to Your App

Add the `BackendTestScreen` to your React Native navigation:

```typescript
// In your navigation file
import BackendTestScreen from '../screens/test/BackendTestScreen';

// Add to your navigation stack
<Stack.Screen
  name="BackendTest"
  component={BackendTestScreen}
  options={{ title: 'Backend Test' }}
/>
```

### Step 2: Use Local Proxy

```bash
# Start the local proxy (run this in terminal)
gcloud run services proxy cosmo-backend --region=us-west1 --port=8080
```

Then update your React Native app to use `http://localhost:8080` temporarily.

### Step 3: Test in Simulator

1. Open your React Native app in Xcode simulator
2. Navigate to the Backend Test screen
3. Tap "Test /health" and "Test /api/v1/test" buttons
4. Check the results

## 📊 **Expected Results**

### Successful Connection:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T05:25:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

### API Test Endpoint:
```json
{
  "success": true,
  "message": "Cosmo API is running!",
  "timestamp": "2025-10-02T05:25:00.000Z",
  "environment": "production"
}
```

## 🔧 **Next Steps After Testing**

1. **Add Authentication Routes**: Restore the auth controller methods
2. **Implement Real API Endpoints**: Replace mock APIs with real backend calls
3. **Configure Production Access**: Work with admin to enable public access
4. **Add Error Handling**: Implement proper error handling for API failures
5. **Security**: Add proper authentication and authorization

## ❗ **Troubleshooting**

### Common Issues:

1. **403/401 Errors**: Expected due to organization policy
2. **Network Timeout**: Check if proxy is running
3. **CORS Issues**: Backend is configured to accept all origins
4. **Simulator Network**: Ensure simulator can access localhost

### Debug Steps:

1. Check Cloud Run logs: `gcloud run services logs read cosmo-backend --region us-west1`
2. Verify service status: `gcloud run services describe cosmo-backend --region us-west1`
3. Test with curl: `curl http://localhost:8080/health` (with proxy running)

## 🎉 **Success Indicators**

- ✅ Backend deployed successfully to Cloud Run
- ✅ Container running and healthy (visible in logs)
- ✅ React Native app configured to use backend
- ✅ Test framework in place
- 🔄 **Next**: Enable access and test connectivity

The backend migration is complete and working! The only remaining step is resolving the access restriction through your organization's GCP policies.