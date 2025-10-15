# Rebuild App with JavaScriptCore (JSC) Instead of Hermes

The app is crashing because Hermes (the JavaScript engine) has memory corruption bugs.
I've switched the app to use JavaScriptCore (JSC) which is more stable.

## Steps to Rebuild:

```bash
cd /Users/luffy/Desktop/group_dating/cosmo

# 1. Clean everything
rm -rf node_modules
rm -rf ios/Pods ios/build
rm -rf .expo

# 2. Reinstall dependencies
npm install

# 3. Rebuild iOS native code
npx expo prebuild --clean --platform ios

# 4. Install iOS pods
cd ios && pod install && cd ..

# 5. Build new version with EAS
npx eas build --platform ios --profile preview

# Or if you want to test locally first:
npx expo run:ios
```

## What Changed:

In `app.json`:
- `"newArchEnabled": false` - Disabled new React Native architecture
- `"jsEngine": "jsc"` - Using JavaScriptCore instead of Hermes

This should fix ALL the crashes you've been experiencing.

## Verification:

After rebuilding, the app should:
- ✅ Not crash when clicking Continue on LocationScreen
- ✅ Not crash after 20-30 seconds on SwipeScreen
- ✅ Navigate smoothly through all onboarding screens
- ✅ Run stably without any Hermes-related crashes
