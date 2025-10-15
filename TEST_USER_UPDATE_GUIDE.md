# Test User Profile Update API Guide

This guide explains how to use the reusable API endpoint to update test user profiles without redeploying.

## Endpoint

```
POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles
```

## Overview

This endpoint allows you to update multiple profile fields for all test users at once:
- **Location** (random positions within a radius)
- **Gender** (all users to same gender)
- **Age** (random ages within a range)
- **Interests** (set specific interests)

You can update any combination of these fields in a single request!

---

## Usage Examples

### 1. Update Location Only (Your Current Need)

Update all test users to be within 10 miles of Placentia, CA:

```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "centerLat": 33.8722,
    "centerLng": -117.8703,
    "radiusMiles": 10
  }'
```

**Change location and radius anytime:**
```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "centerLat": 37.7749,
    "centerLng": -122.4194,
    "radiusMiles": 25
  }'
```

### 2. Update Gender Only

Set all test users to female:

```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "gender": "female",
    "updateLocation": false
  }'
```

Options: `"male"`, `"female"`, `"non-binary"`

### 3. Update Age Range Only

Set all test users to random ages between 25-35:

```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "minAge": 25,
    "maxAge": 35,
    "updateLocation": false
  }'
```

### 4. Update Interests Only

Set all test users to have the same interests:

```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["Hiking", "Coffee", "Photography", "Travel"],
    "updateLocation": false
  }'
```

### 5. Update Multiple Fields at Once

Update location, gender, and age together:

```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "centerLat": 33.8722,
    "centerLng": -117.8703,
    "radiusMiles": 15,
    "gender": "female",
    "minAge": 28,
    "maxAge": 38
  }'
```

Update everything:

```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "centerLat": 40.7128,
    "centerLng": -74.0060,
    "radiusMiles": 20,
    "gender": "male",
    "minAge": 22,
    "maxAge": 32,
    "interests": ["Gym", "Basketball", "Cooking", "Music"]
  }'
```

---

## Request Parameters

All parameters are **optional**. Only include the ones you want to update.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `updateLocation` | boolean | `true` | Whether to update user locations |
| `centerLat` | number | `33.8722` | Center latitude for location updates |
| `centerLng` | number | `-117.8703` | Center longitude for location updates |
| `radiusMiles` | number | `10` | Radius in miles for random location generation |
| `gender` | string | - | Gender to set all users to (`"male"`, `"female"`, `"non-binary"`) |
| `minAge` | number | - | Minimum age for random age generation |
| `maxAge` | number | - | Maximum age for random age generation |
| `interests` | string[] | - | Array of interests to set for all users |

---

## Response Format

```json
{
  "success": true,
  "message": "Updated 30 test users' profiles",
  "updatedCount": 30,
  "options": {
    "location": {
      "lat": 33.8722,
      "lng": -117.8703,
      "radiusMiles": 10
    },
    "gender": "female",
    "ageRange": { "min": 25, "max": 35 },
    "interests": "4 interests"
  },
  "updates": [
    {
      "userId": "test-user-1234567890-0",
      "changes": {
        "location": {
          "old": { "lat": 37.7749, "lng": -122.4194 },
          "new": { "lat": 33.8801, "lng": -117.8612 }
        },
        "gender": {
          "old": "male",
          "new": "female"
        },
        "age": {
          "old": 28,
          "new": 31
        }
      }
    }
    // ... first 5 users shown for verification
  ]
}
```

---

## Important Notes

### Reusability
- **No redeployment needed!** This endpoint is deployed once and can be called unlimited times.
- Simply change the request parameters to update different fields or values.
- Perfect for testing different scenarios quickly.

### Test User Targeting
- Automatically targets all users with `userId` starting with `"test-user-"`
- Real users are never affected.

### Batch Updates
- Uses Firestore batch writes for atomic updates.
- All test users are updated simultaneously.

### Random Generation
- **Location**: Random positions within the specified radius (uses polar coordinates)
- **Age**: Random integer between minAge and maxAge (inclusive)

### Skipping Updates
- To skip location updates, set `"updateLocation": false`
- To skip gender updates, omit the `gender` parameter
- To skip age updates, omit both `minAge` and `maxAge`
- To skip interests updates, omit the `interests` parameter

---

## Common Scenarios

### Testing Location-Based Matching
```bash
# Put all test users near your location
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "centerLat": 33.8722,
    "centerLng": -117.8703,
    "radiusMiles": 5
  }'
```

### Testing Gender Filters
```bash
# Set all to female for testing male user's feed
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "gender": "female",
    "updateLocation": false
  }'
```

### Testing Age Filters
```bash
# Set specific age range
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "minAge": 21,
    "maxAge": 25,
    "updateLocation": false
  }'
```

### Testing Interest Matching
```bash
# Give all users specific interests
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["Tennis", "Hiking", "Wine"],
    "updateLocation": false
  }'
```

### Reset Everything for New Test
```bash
# Complete reset with new location
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "centerLat": 34.0522,
    "centerLng": -118.2437,
    "radiusMiles": 15,
    "minAge": 22,
    "maxAge": 40
  }'
```

---

## Error Handling

If you get an error, the response will look like:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common issues:
- Invalid coordinates (lat: -90 to 90, lng: -180 to 180)
- Invalid age range (minAge must be less than maxAge)
- Invalid gender value (must be "male", "female", or "non-binary")
- Empty interests array

---

## Quick Reference

**Your most common command** (update location to Placentia, CA):
```bash
curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles \
  -H "Content-Type: application/json" \
  -d '{"centerLat": 33.8722, "centerLng": -117.8703, "radiusMiles": 10}'
```

**Save as an alias** for even faster usage:
```bash
# Add to ~/.zshrc or ~/.bashrc
alias update-test-users='curl -X POST https://cosmo-backend-691853413697.us-central1.run.app/api/v1/admin/update-test-user-profiles -H "Content-Type: application/json" -d'

# Then use like:
update-test-users '{"centerLat": 33.8722, "centerLng": -117.8703, "radiusMiles": 10}'
```

---

## Tips

1. **Start with defaults**: Just send an empty body `{}` to use all defaults
2. **Verify first 5**: The response shows the first 5 updates so you can verify changes
3. **Use jq for pretty output**: Add `| jq` to curl commands for formatted JSON
4. **Chain updates**: Run multiple curl commands to test different scenarios quickly
5. **Check logs**: Cloud Run logs show all updates in the console

---

That's it! You now have a fully reusable endpoint for updating test user profiles without any redeployment. Happy testing!
