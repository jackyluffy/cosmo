#!/bin/bash

# You need to replace YOUR_AUTH_TOKEN with a real JWT token from your app
# To get it: Open the app, go to device logs in Xcode, and look for "Authorization: Bearer XXX"

AUTH_TOKEN="YOUR_AUTH_TOKEN"

echo "Testing availability endpoint..."
echo ""

# Test 1: Update availability
echo "=== Test 1: Sending availability data ==="
curl -X PUT https://cosmo-api-691853413697.us-west1.run.app/api/v1/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "availability": {
      "2025-10-18": {
        "morning": true,
        "afternoon": true,
        "evening": false,
        "night": false,
        "blocked": false
      },
      "2025-10-19": {
        "morning": false,
        "afternoon": true,
        "evening": true,
        "night": true,
        "blocked": false
      }
    }
  }' | jq .

echo ""
echo ""

# Test 2: Get profile to verify
echo "=== Test 2: Getting profile to verify availability was saved ==="
curl -X GET https://cosmo-api-691853413697.us-west1.run.app/api/v1/profile/me \
  -H "Authorization: Bearer $AUTH_TOKEN" | jq .

echo ""
