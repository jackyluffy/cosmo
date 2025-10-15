# Cosmo - Social Match iOS App

A social matching app that connects people through group events based on shared interests.

## Features

- **OTP Authentication**: Secure login via SMS or email
- **Interest-Based Matching**: Select hobbies during onboarding (required)
- **Swipe Discovery**: Like/skip full profiles with photos, bio, and interests
- **Event Recommendations**: Get 2-3 curated event suggestions (≤6 people each)
- **Direct RSVP**: Book events directly in-app
- **Group Chat**: Event-specific messaging for attendees
- **Subscription Model**: First event free, then $9.99/month

## Tech Stack

- **Frontend**: React Native + Expo + TypeScript
- **UI Theme**: Light blue primary palette (#3BA6FF)
- **Navigation**: React Navigation
- **State Management**: Zustand
- **API Client**: Axios
- **Forms**: React Hook Form
- **Payments**: Stripe integration ready

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Xcode) or physical iOS device
- Expo Go app (for device testing)

### Installation

1. Clone the repository:
```bash
cd cosmo
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file:
```
EXPO_PUBLIC_API_URL=http://localhost:8080
```

### Running the App

#### Option 1: Using Expo CLI (Recommended for Development)
1. Start the development server:
```bash
npm start
```

2. Run on iOS:
```bash
npm run ios
```

Or scan the QR code with Expo Go app on your iOS device.

#### Option 2: Using Xcode (Recommended for Testing & Debugging)
1. Open the iOS project in Xcode:
```bash
open ios/Cosmo.xcodeproj
```

2. Select your target device or simulator in Xcode
3. Click the "Play" button or press ⌘+R to build and run
4. Use Xcode's debugger, device logs, and performance profiler

#### Option 3: Using React Native CLI
```bash
npx react-native run-ios
```

### Xcode Project Structure
```
ios/
├── Cosmo.xcodeproj/     # Xcode project file (open this)
├── Cosmo/               # iOS app source
│   ├── Info.plist       # App configuration & permissions
│   ├── AppDelegate.swift # iOS app delegate
│   ├── Images.xcassets/ # App icons & assets
│   └── SplashScreen.storyboard # Launch screen
├── Pods/                # CocoaPods dependencies
└── Podfile              # CocoaPods configuration
```

## Project Structure

```
cosmo/
├── src/
│   ├── constants/      # Theme, colors, interests
│   ├── screens/        # All app screens
│   │   ├── auth/       # Login, OTP verification
│   │   ├── onboarding/ # Interest selection, profile setup
│   │   ├── swipe/      # Swipe deck interface
│   │   └── events/     # Event recommendations, RSVP
│   ├── services/       # API client and endpoints
│   ├── store/          # Zustand state management
│   └── components/     # Reusable components
├── App.tsx            # Main app entry point
├── app.json           # Expo configuration
└── package.json       # Dependencies
```

## Key Screens

1. **Login**: Phone/email OTP authentication
2. **Interests**: Required hobby selection (min 3)
3. **Swipe**: Dating-style profile discovery
4. **Events**: Browse and RSVP to recommended events
5. **Event Detail**: View attendees and access group chat
6. **Profile**: User settings and subscription management

## API Integration

The app expects a backend API at the URL specified in `EXPO_PUBLIC_API_URL`.

Key endpoints:
- `/auth/otp/request` - Request OTP
- `/auth/otp/verify` - Verify OTP and get JWT
- `/swipe/deck` - Get profiles to swipe
- `/events/recommended` - Get event recommendations
- `/events/{id}/rsvp` - RSVP to event
- `/billing/status` - Check subscription status

## Development Notes

- Uses React Native Reanimated for smooth animations
- Implements deck swiper for Tinder-like UX
- Light blue theme throughout (#3BA6FF primary)
- Max 6 people per event group
- First event free, then subscription required

## Building for Production

1. Configure app.json with proper bundle ID and version
2. Set production API URL
3. Build with Expo EAS:
```bash
eas build --platform ios
```

## License

Proprietary