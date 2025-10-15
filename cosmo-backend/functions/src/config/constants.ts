export const Constants = {
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
  JWT_EXPIRES_IN: '30d',

  // OTP
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 10,

  // Twilio (for SMS)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

  // SendGrid (for email)
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@cosmo.app',

  // App settings
  MAX_GROUP_SIZE: 6,
  MIN_GROUP_SIZE: 4,
  MAX_PHOTO_UPLOADS: 6,
  MAX_EVENT_DISTANCE_KM: 50,
  FREE_TRIAL_EVENTS: 1,

  // Subscription tiers
  SUBSCRIPTION_TIERS: {
    TRIAL: {
      name: 'trial',
      events_per_month: 1,
      price: 0,
    },
    BASIC: {
      name: 'basic',
      events_per_month: 4,
      price: 19.99,
    },
    PREMIUM: {
      name: 'premium',
      events_per_month: -1, // unlimited
      price: 39.99,
    },
  },

  // Matching algorithm weights
  MATCHING_WEIGHTS: {
    INTERESTS: 0.3,
    AGE_RANGE: 0.2,
    LOCATION: 0.2,
    PERSONALITY: 0.2,
    ACTIVITY_LEVEL: 0.1,
  },
} as const;

export const Regex = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  OTP: /^\d{6}$/,
} as const;