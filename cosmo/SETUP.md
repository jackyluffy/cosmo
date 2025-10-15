# Cosmo iOS Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
cd ios && pod install && cd ..
```

### 2. Launch Options

#### Option A: Xcode (Recommended)
```bash
open ios/Cosmo.xcworkspace
```
- Select a simulator or device
- Press ⌘+R to build and run

#### Option B: Expo CLI
```bash
npm run ios
```

#### Option C: React Native CLI
```bash
npx react-native run-ios
```

## Project Structure

### Main Files
- `ios/Cosmo.xcworkspace` - **OPEN THIS** in Xcode (not .xcodeproj)
- `ios/Cosmo/Info.plist` - App permissions and configuration
- `src/` - React Native source code
- `App.tsx` - Main app entry point

### Key Features Implemented
- ✅ OTP Authentication (SMS/Email)
- ✅ Interest Selection Onboarding
- ✅ Swipe-based Profile Discovery
- ✅ Event Recommendations with RSVP
- ✅ Subscription/Payment Integration (Stripe)
- ✅ Light Blue Theme (#3BA6FF)

## Testing

### Simulators
- iPhone 15 Pro (iOS 17+)
- iPhone 14 (iOS 16+)
- iPad Pro (for tablet support)

### Physical Device
1. Connect iPhone via USB
2. Trust development certificate in Settings > General > Device Management
3. Select device in Xcode and run

## Build Configurations

### Debug (Default)
- Fast compilation
- Hot reload enabled
- Network debugging allowed

### Release
- Optimized for App Store
- Minified JavaScript bundle
- Production API endpoints

## Troubleshooting

### Common Issues

1. **"No such file or directory: ios"**
   ```bash
   npx expo prebuild --platform ios --clean
   cd ios && pod install
   ```

2. **"Could not find Xcode project"**
   - Make sure to open `Cosmo.xcworkspace`, not `Cosmo.xcodeproj`

3. **CocoaPods errors**
   ```bash
   cd ios
   rm -rf Pods Podfile.lock
   pod install
   ```

4. **Build failures**
   ```bash
   npx react-native clean
   cd ios && rm -rf build && cd ..
   npm run ios
   ```

### Permissions Required
- Camera: Profile photos and verification
- Photo Library: Profile pictures
- Location: Find nearby events
- Microphone: Voice messages in group chats

## Development Workflow

1. **Code Changes**: Edit TypeScript files in `src/`
2. **Hot Reload**: Changes appear instantly in simulator
3. **Debug**: Use React Native Debugger or Xcode console
4. **Test**: Run on multiple devices/simulators
5. **Build**: Use Xcode for App Store deployment

## API Configuration

Set backend URL in `.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:8080
```

For production, update to your deployed backend URL.