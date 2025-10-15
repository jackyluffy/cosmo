# Cosmo Backend - GCP Cloud Functions

A serverless backend for the Cosmo dating app built with Google Cloud Platform services.

## Architecture

- **Cloud Functions**: Serverless compute for API endpoints
- **Firestore**: NoSQL database for user data and real-time updates
- **Cloud Storage**: Object storage for photos and media
- **Cloud Scheduler**: Cron jobs for matching algorithm
- **Firebase Auth**: JWT-based authentication

## Features

### Authentication
- Phone/Email OTP verification
- JWT token-based authentication
- Session management

### User Management
- Profile creation and updates
- Photo uploads (up to 6 photos)
- Interest and personality trait tracking
- Location-based features

### Event System
- Event creation and management
- Join/leave events
- Age and location-based filtering
- Category-based event discovery

### Matching Algorithm
- AI-powered group formation
- Compatibility scoring based on:
  - Shared interests (30% weight)
  - Age compatibility (20% weight)
  - Location proximity (20% weight)
  - Personality traits (20% weight)
  - Activity level (10% weight)
- Optimal group size: 4-6 people
- Daily automatic matching runs

### Subscription Management
- Free trial (1 event)
- Basic tier ($19.99/month - 4 events)
- Premium tier ($39.99/month - unlimited events)

## Setup Instructions

### Prerequisites

1. Node.js 18+
2. Firebase CLI: `npm install -g firebase-tools`
3. Google Cloud SDK
4. A GCP project with billing enabled

### Installation

1. Clone the repository:
```bash
cd cosmo-backend
npm install
cd functions
npm install
```

2. Set up Firebase:
```bash
firebase login
firebase use --add
# Select your GCP project
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Set Firebase Functions config:
```bash
firebase functions:config:set \
  jwt.secret="your-secret" \
  twilio.sid="your-sid" \
  twilio.token="your-token" \
  twilio.phone="+1234567890" \
  sendgrid.key="your-key" \
  sendgrid.from="noreply@cosmo.app"
```

### Local Development

1. Start the Firebase emulators:
```bash
npm run serve
```

2. The API will be available at:
- Functions: http://localhost:5001/your-project/us-central1/api
- Firestore UI: http://localhost:4000
- Storage: http://localhost:9199

### Deployment

1. Deploy all services:
```bash
firebase deploy
```

2. Deploy only functions:
```bash
firebase deploy --only functions
```

3. Deploy specific function:
```bash
firebase deploy --only functions:api
```

## API Endpoints

### Authentication
- `POST /auth/otp/request` - Request OTP code
- `POST /auth/otp/verify` - Verify OTP and get JWT
- `POST /auth/validate` - Validate JWT token
- `POST /auth/logout` - Logout user

### Profile
- `GET /profile/me` - Get current user profile
- `PUT /profile` - Update profile
- `PUT /profile/location` - Update location
- `PUT /profile/interests` - Update interests
- `POST /profile/photo` - Upload photo
- `DELETE /profile/photo` - Delete photo

### Events
- `GET /events` - List available events
- `GET /events/:id` - Get event details
- `POST /events` - Create new event
- `POST /events/:id/join` - Join event
- `DELETE /events/:id/leave` - Leave event

## Database Schema

### Collections

#### users
- Personal information
- Profile data
- Subscription status
- Preferences

#### events
- Event details
- Location and time
- Organizer info
- Group associations

#### groups
- Group members
- Match scores
- Chat room reference
- Status

#### matches
- User-event associations
- Preferences
- Match status
- Scores

#### messages
- Chat messages
- Media attachments
- Read receipts

## Security

### Firestore Rules
- Users can only read/write their own data
- Group data visible only to members
- Events publicly readable to authenticated users

### Storage Rules
- 5MB max file size for images
- Profile photos: user-owned only
- Event photos: organizer-owned only
- Chat media: group members only

## Monitoring

### Logs
```bash
firebase functions:log
```

### Specific function logs:
```bash
firebase functions:log --only api
```

## Testing

Run tests:
```bash
npm test
```

## Production Checklist

- [ ] Change JWT secret
- [ ] Set up Twilio account for SMS
- [ ] Set up SendGrid for emails
- [ ] Configure Stripe for payments
- [ ] Set up Cloud Storage bucket
- [ ] Enable Firestore indexes
- [ ] Configure custom domain
- [ ] Set up monitoring alerts
- [ ] Enable backup policies
- [ ] Configure rate limiting

## Cost Optimization

1. Use Cloud Scheduler instead of always-running services
2. Implement caching for frequently accessed data
3. Use Firestore batch operations
4. Optimize image sizes before storage
5. Set up budget alerts in GCP

## Support

For issues or questions, contact the development team.

## License

Proprietary - All rights reserved