import { Timestamp, GeoPoint } from 'firebase-admin/firestore';

// User types
export interface User {
  id: string;
  phone?: string;
  email?: string;
  authProvider: 'phone' | 'google' | 'facebook' | 'apple';
  providerId?: string; // The OAuth provider's user ID
  profile?: UserProfile;
  subscription: Subscription;
  preferences: UserPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActive?: Timestamp;
  isActive: boolean;
  isVerified: boolean;
  blockedUsers?: string[];
}

export interface UserProfile {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  genderPreference: 'male' | 'female' | 'both';
  bio: string;
  lookingFor?: string;
  photos: string[];
  interests: string[];
  traits: PersonalityTraits;
  location?: GeoPoint;
  radius: number; // in km
  verified: boolean;
  completedAt?: Timestamp;
}

export interface PersonalityTraits {
  extroversion?: number; // 0-100
  adventurous?: number;
  spontaneous?: number;
  organized?: number;
  creative?: number;
}

export interface Subscription {
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  tier?: 'basic' | 'premium';
  trialEventUsed: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Timestamp;
  renewsAt?: Timestamp;
  createdAt: Timestamp;
}

export interface UserPreferences {
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  privacy: {
    showProfile: boolean;
    showLocation: boolean;
  };
}

// Event types
export interface Event {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  date: Timestamp;
  location: {
    name: string;
    address: string;
    coordinates: GeoPoint;
  };
  photos: string[];
  organizer: {
    id: string;
    name: string;
  };
  groups: string[]; // Group IDs
  maxGroupsCount: number;
  groupSize: number; // Number of people per group (must be even for 1:1 ratio)
  pricePerPerson: number;
  ageRange: {
    min: number;
    max: number;
  };
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'canceled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type EventCategory =
  | 'restaurant'
  | 'bar'
  | 'club'
  | 'concert'
  | 'sports'
  | 'outdoor'
  | 'culture'
  | 'gaming'
  | 'other';

// Group types
export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  eventId: string;
  status: 'forming' | 'ready' | 'confirmed' | 'disbanded';
  matchScore?: number;
  chatRoomId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMember {
  userId: string;
  name: string;
  photo: string;
  role: 'leader' | 'member';
  joinedAt: Timestamp;
  status: 'pending' | 'accepted' | 'declined';
}

// Match types
export interface Match {
  id: string;
  userId: string;
  eventId: string;
  groupId?: string;
  status: 'pending' | 'matched' | 'rejected' | 'expired';
  preferences: MatchPreferences;
  score?: number;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export interface MatchPreferences {
  ageRange: {
    min: number;
    max: number;
  };
  genderPreference: ('male' | 'female' | 'other')[];
  interests: string[];
}

// Message types
export interface Message {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'location';
  readBy: string[];
  createdAt: Timestamp;
  editedAt?: Timestamp;
  deletedAt?: Timestamp;
}

// OTP types
export interface OTPCode {
  code: string;
  identifier: string; // phone or email
  type: 'phone' | 'email';
  expiresAt: Timestamp;
  attempts: number;
  verified: boolean;
  createdAt: Timestamp;
  verifiedAt?: Timestamp;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Request types
export interface AuthRequest {
  phone?: string;
  email?: string;
}

export interface VerifyOTPRequest {
  phone?: string;
  email?: string;
  code: string;
}

export interface UpdateProfileRequest {
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  genderPreference?: 'male' | 'female' | 'both';
  bio?: string;
  lookingFor?: string;
  photos?: string[];
  interests?: string[];
  traits?: PersonalityTraits;
  radius?: number;
  location?: { lat: number; lng: number };
}