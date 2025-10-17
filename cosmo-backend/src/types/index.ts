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
  pendingEvents?: PendingEventAssignment[];
  pendingEventCount?: number;
  joinedEvents?: string[];
  eventCancelCount?: number;
  eventBanUntil?: Timestamp;
}

export interface UserProfile {
  name: string;
  age: number;
  height?: string; // e.g., "5'5\""
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
  availability?: AvailabilityMap;
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
  eventType?: EventType;
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
  status: 'draft' | 'pending_join' | 'ready' | 'published' | 'ongoing' | 'confirmed' | 'completed' | 'canceled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  autoOrganized?: boolean;
  pendingPairMatchIds?: string[];
  requiredPairCount?: number;
  participantUserIds?: string[];
  participantStatuses?: Record<string, EventParticipantStatus>;
  venueOptions?: EventVenueOption[];
  venueVoteTotals?: Record<string, number>;
  finalVenueOptionId?: string | null;
  suggestedTimes?: EventSuggestedAvailability[];
  votesSubmittedCount?: number;
  chatRoomId?: string | null;
  reminderSent?: boolean;
  reminderSentAt?: Timestamp | null;
  confirmationsReceived?: number;
}

export type EventType =
  | 'coffee'
  | 'bar'
  | 'restaurant'
  | 'tennis'
  | 'dog_walking'
  | 'hiking';

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

export type AvailabilitySegment = 'morning' | 'afternoon' | 'evening' | 'night';

export interface AvailabilityEntry {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  night: boolean;
  blocked: boolean;
}

export type AvailabilityMap = Record<string, AvailabilityEntry>;

export interface AvailabilityOverlapSegment {
  date: string;
  segments: AvailabilitySegment[];
}

export type EventParticipantStatus =
  | 'pending_join'
  | 'joined'
  | 'declined'
  | 'canceled'
  | 'removed'
  | 'confirmed'
  | 'completed';

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  status: EventParticipantStatus;
  joinedAt?: Timestamp;
  canceledAt?: Timestamp;
  confirmedAt?: Timestamp;
  lastStatusAt: Timestamp;
  voteVenueOptionId?: string;
  voteSubmittedAt?: Timestamp;
}

export interface EventSuggestedAvailability {
  date: string;
  segments: AvailabilitySegment[];
}

export interface EventVenueOption {
  id: string;
  name: string;
  address: string;
  coordinates: GeoPoint;
  description?: string;
  photos: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  durationMinutes?: number;
  additionalInfo?: string | null;
}

export interface PendingEventAssignment {
  eventId: string;
  eventType: EventType;
  status: 'pending_join' | 'joined' | 'confirmed' | 'completed' | 'canceled';
  assignedAt: Timestamp;
  updatedAt: Timestamp;
}

export type PairMatchStatus = 'active' | 'inactive' | 'blocked';

export type PairMatchQueueStatus =
  | 'awaiting_availability'
  | 'awaiting_event_type'
  | 'queued'
  | 'in_event'
  | 'sidelined';

export interface PairMatch {
  id: string;
  pairKey: string;
  userIds: [string, string];
  status: PairMatchStatus;
  queueStatus: PairMatchQueueStatus;
  queueEventType?: EventType | null;
  sharedEventTypes: EventType[];
  suggestedEventType?: EventType | null;
  availabilityOverlapCount: number;
  availabilityOverlapSegments: AvailabilityOverlapSegment[];
  availabilityComputedAt?: Timestamp;
  hasSufficientAvailability: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
  pendingEventId?: string | null;
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
  height?: string;
  gender?: 'male' | 'female' | 'other';
  genderPreference?: 'male' | 'female' | 'both';
  bio?: string;
  lookingFor?: string;
  photos?: string[];
  interests?: string[];
  traits?: PersonalityTraits;
  radius?: number;
  location?: { lat: number; lng: number };
  verified?: boolean;
  verificationDate?: string;
  availability?: AvailabilityMap;
}
