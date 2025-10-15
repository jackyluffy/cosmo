// Mock API service for testing without backend
// This replaces the real API calls with mock data

const mockProfiles = [
  {
    id: '1',
    name: 'Alex',
    age: 28,
    bio: 'Adventure seeker, coffee enthusiast, and weekend chef. Looking for fun group activities!',
    photos: ['https://picsum.photos/400/600?random=1'],
    interests: ['Hiking', 'Coffee', 'Cooking', 'Board Games'],
    distance: 2.5,
  },
  {
    id: '2',
    name: 'Sam',
    age: 25,
    bio: 'Love exploring new restaurants, game nights, and outdoor concerts.',
    photos: ['https://picsum.photos/400/600?random=2'],
    interests: ['Food', 'Music', 'Games', 'Art'],
    distance: 3.8,
  },
  {
    id: '3',
    name: 'Jordan',
    age: 30,
    bio: 'Fitness enthusiast, book lover, always up for trying something new!',
    photos: ['https://picsum.photos/400/600?random=3'],
    interests: ['Fitness', 'Reading', 'Yoga', 'Travel'],
    distance: 1.2,
  },
  {
    id: '4',
    name: 'Taylor',
    age: 27,
    bio: 'Artist by day, foodie by night. Let\'s explore the city together!',
    photos: ['https://picsum.photos/400/600?random=4'],
    interests: ['Art', 'Photography', 'Food', 'Museums'],
    distance: 4.5,
  },
  {
    id: '5',
    name: 'Morgan',
    age: 26,
    bio: 'Tech geek, board game champion, and craft beer connoisseur.',
    photos: ['https://picsum.photos/400/600?random=5'],
    interests: ['Technology', 'Board Games', 'Beer', 'Startups'],
    distance: 2.0,
  },
];

const mockEvents = [
  {
    id: '1',
    title: 'Wine & Paint Night',
    description: 'Join us for a creative evening of wine tasting and painting!',
    photos: ['https://picsum.photos/400/300?random=10'],
    venue_name: 'Downtown Art Studio',
    venue_address: '123 Art Street, Downtown',
    starts_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    capacity: 20,
    attendees: 12,
    price: 45,
    category: 'art',
    rsvp_status: null,
    attendees_preview: [
      {
        name: 'Alex',
        photo: 'https://picsum.photos/64/64?random=1'
      },
      {
        name: 'Sam',
        photo: 'https://picsum.photos/64/64?random=2'
      },
      {
        name: 'Jordan',
        photo: 'https://picsum.photos/64/64?random=3'
      }
    ]
  },
  {
    id: '2',
    title: 'Escape Room Challenge',
    description: 'Work together to solve puzzles and escape in 60 minutes!',
    photos: ['https://picsum.photos/400/300?random=11'],
    venue_name: 'Mystery Mansion',
    venue_address: '456 Puzzle Ave, Uptown',
    starts_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    capacity: 12,
    attendees: 8,
    price: 30,
    category: 'games',
    rsvp_status: null,
    attendees_preview: [
      {
        name: 'Taylor',
        photo: 'https://picsum.photos/64/64?random=4'
      },
      {
        name: 'Morgan',
        photo: 'https://picsum.photos/64/64?random=5'
      }
    ]
  },
  {
    id: '3',
    title: 'Group Cooking Class',
    description: 'Learn to cook Italian cuisine with a professional chef.',
    photos: ['https://picsum.photos/400/300?random=12'],
    venue_name: 'Chef\'s Kitchen',
    venue_address: '789 Culinary Blvd, Midtown',
    starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    capacity: 16,
    attendees: 10,
    price: 65,
    category: 'food',
    rsvp_status: null,
    attendees_preview: [
      {
        name: 'Casey',
        photo: 'https://picsum.photos/64/64?random=6'
      },
      {
        name: 'Riley',
        photo: 'https://picsum.photos/64/64?random=7'
      },
      {
        name: 'Avery',
        photo: 'https://picsum.photos/64/64?random=8'
      },
      {
        name: 'Jamie',
        photo: 'https://picsum.photos/64/64?random=9'
      }
    ]
  },
];

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const authAPI = {
  requestOTP: async (phone?: string, email?: string) => {
    await delay(500);
    console.log('Mock OTP request for:', phone || email);
    return { data: { success: true } };
  },

  verifyOTP: async (code: string, phone?: string, email?: string) => {
    await delay(500);
    console.log('Mock OTP verification:', code);
    return {
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: 'user123',
          phone: phone || '',
          email: email || '',
        },
      },
    };
  },
};

export const profileAPI = {
  getMe: async () => {
    await delay(300);
    return {
      data: {
        id: 'user123',
        name: 'Test User',
        age: 25,
        profile: {
          bio: 'Testing the app',
          interests: ['Food', 'Music', 'Travel'],
          photos: [],
        },
      },
    };
  },

  updateProfile: async (profile: any) => {
    await delay(300);
    console.log('Mock profile update:', profile);
    return { data: profile };
  },

  updateInterests: async (interests: string[]) => {
    await delay(300);
    console.log('Mock interests update:', interests);
    return { data: { interests } };
  },

  updateTraits: async (traits: any) => {
    await delay(300);
    console.log('Mock traits update:', traits);
    return { data: traits };
  },

  uploadPhoto: async (photo: FormData) => {
    await delay(500);
    console.log('Mock photo upload');
    return { data: { url: 'https://picsum.photos/400/600?random=99' } };
  },

  verifyProfile: async (selfie: FormData) => {
    await delay(500);
    console.log('Mock profile verification');
    return { data: { verified: true } };
  },
};

export const swipeAPI = {
  getDeck: async () => {
    await delay(500);
    // Shuffle and return mock profiles
    const shuffled = [...mockProfiles].sort(() => Math.random() - 0.5);
    return { data: { profiles: shuffled } };
  },

  swipe: async (targetId: string, direction: 'like' | 'skip') => {
    await delay(200);
    console.log(`Mock swipe: ${direction} on profile ${targetId}`);
    const isMatch = direction === 'like' && Math.random() > 0.7;
    return { data: { match: isMatch } };
  },
};

export const eventsAPI = {
  getRecommended: async () => {
    await delay(400);
    return { data: { events: mockEvents } };
  },

  getEvent: async (id: string) => {
    await delay(300);
    const event = mockEvents.find(e => e.id === id);
    return { data: event || mockEvents[0] };
  },

  rsvp: async (id: string, response: 'yes' | 'no') => {
    await delay(300);
    console.log(`Mock RSVP: ${response} for event ${id}`);
    return { data: { success: true } };
  },

  getThread: async (id: string) => {
    await delay(300);
    return {
      data: {
        messages: [
          {
            id: '1',
            sender: 'Alex',
            message: 'Looking forward to this event!',
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  },

  sendMessage: async (id: string, message: string, attachments?: any[]) => {
    await delay(300);
    console.log(`Mock message sent to event ${id}: ${message}`);
    return { data: { success: true } };
  },
};

export const proposalsAPI = {
  getCurrent: async () => {
    await delay(300);
    return { data: { proposals: [] } };
  },

  submitAvailability: async (id: string, slots: any) => {
    await delay(300);
    console.log('Mock availability submitted:', slots);
    return { data: { success: true } };
  },

  vote: async (id: string, choice: string) => {
    await delay(300);
    console.log(`Mock vote: ${choice} for proposal ${id}`);
    return { data: { success: true } };
  },
};

export const billingAPI = {
  getStatus: async () => {
    await delay(300);
    return {
      data: {
        status: 'trial',
        trial_event_used: false,
        renewsAt: null,
      },
    };
  },

  createCheckoutSession: async () => {
    await delay(500);
    return {
      data: {
        url: 'https://checkout.stripe.com/mock-session',
      },
    };
  },

  cancelSubscription: async () => {
    await delay(300);
    console.log('Mock subscription cancelled');
    return { data: { success: true } };
  },
};

export const adminAPI = {
  createEvent: async (event: any) => {
    await delay(500);
    console.log('Mock event created:', event);
    return { data: { id: 'event-' + Date.now(), ...event } };
  },

  updateEvent: async (id: string, event: any) => {
    await delay(300);
    console.log(`Mock event ${id} updated:`, event);
    return { data: event };
  },

  createVenue: async (venue: any) => {
    await delay(300);
    console.log('Mock venue created:', venue);
    return { data: { id: 'venue-' + Date.now(), ...venue } };
  },

  reportUser: async (report: any) => {
    await delay(300);
    console.log('Mock user reported:', report);
    return { data: { success: true } };
  },
};

// Export a default mock API object that mimics axios
const mockApi = {
  get: async (url: string) => {
    console.log('Mock GET:', url);
    await delay(300);
    return { data: {} };
  },
  post: async (url: string, data: any) => {
    console.log('Mock POST:', url, data);
    await delay(300);
    return { data: { success: true } };
  },
  put: async (url: string, data: any) => {
    console.log('Mock PUT:', url, data);
    await delay(300);
    return { data: { success: true } };
  },
  delete: async (url: string) => {
    console.log('Mock DELETE:', url);
    await delay(300);
    return { data: { success: true } };
  },
};

export default mockApi;