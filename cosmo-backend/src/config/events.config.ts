// Event venues and templates configuration for Placentia, CA area

export interface VenueConfig {
  name: string;
  address: string;
  lat: number;
  lng: number;
  photos: string[];
}

export interface EventTemplate {
  type: 'coffee' | 'bar' | 'restaurant' | 'tennis' | 'dog_walking' | 'hiking';
  category: 'date_activity';
  title: string;
  description: string;
  venue: VenueConfig;
  priceRange: { min: number; max: number };
  durationMinutes: number;
  ageRange: { min: number; max: number };
  groupSize: 4 | 6; // Number of people per group (must be even for 1:1 gender ratio)
}

// Venues in Placentia, CA and surrounding areas (within 20 miles)
export const VENUES: Record<string, VenueConfig> = {
  COFFEE_DATE: {
    name: 'Hidden House Coffee',
    address: '511 W Chapman Ave, Orange, CA 92866',
    lat: 33.7877,
    lng: -117.8551,
    photos: ['https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800'],
  },
  COCKTAIL_BAR: {
    name: 'The Blind Rabbit',
    address: '440 S Anaheim Blvd, Anaheim, CA 92805',
    lat: 33.832,
    lng: -117.912,
    photos: ['https://images.unsplash.com/photo-1514361892635-6e122620e884?w=800'],
  },
  DINNER_SPOT: {
    name: 'The Cellar Restaurant',
    address: '305 N Harbor Blvd, Fullerton, CA 92832',
    lat: 33.8725,
    lng: -117.9243,
    photos: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'],
  },
  TRI_CITY_TENNIS: {
    name: 'Tri-City Park Tennis Courts',
    address: '2301 N Kraemer Blvd, Placentia, CA 92870',
    lat: 33.8789,
    lng: -117.8547,
    photos: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800'],
  },
  DOG_PARK: {
    name: 'Yorba Linda Dog Park',
    address: '19001 Casa Loma Ave, Yorba Linda, CA 92886',
    lat: 33.8814,
    lng: -117.8133,
    photos: ['https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=800'],
  },
  HIKING_PARK: {
    name: 'Carbon Canyon Regional Park',
    address: '4442 Carbon Canyon Rd, Brea, CA 92823',
    lat: 33.9123,
    lng: -117.8456,
    photos: ['https://images.unsplash.com/photo-1551632811-561732d1e306?w=800'],
  },
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    type: 'coffee',
    category: 'date_activity',
    title: 'Cozy Coffee Meetup',
    description: 'Meet for artisan coffee and light pastries in a relaxed lounge setting.',
    venue: VENUES.COFFEE_DATE,
    priceRange: { min: 8, max: 18 },
    durationMinutes: 90,
    ageRange: { min: 21, max: 45 },
    groupSize: 4,
  },
  {
    type: 'bar',
    category: 'date_activity',
    title: 'Craft Cocktail Social',
    description: 'Gather in a speakeasy-style bar for signature cocktails and great conversation.',
    venue: VENUES.COCKTAIL_BAR,
    priceRange: { min: 25, max: 45 },
    durationMinutes: 120,
    ageRange: { min: 23, max: 45 },
    groupSize: 4,
  },
  {
    type: 'tennis',
    category: 'date_activity',
    title: 'Weekend Tennis Social',
    description: 'Saturday morning doubles tennis followed by smoothies and post-match chats.',
    venue: VENUES.TRI_CITY_TENNIS,
    priceRange: { min: 15, max: 25 },
    durationMinutes: 150,
    ageRange: { min: 21, max: 50 },
    groupSize: 6,
  },
  {
    type: 'dog_walking',
    category: 'date_activity',
    title: 'Dog Walk & Park Social',
    description: 'Bring your pup (or borrow one) for a relaxed walk and park hangout.',
    venue: VENUES.DOG_PARK,
    priceRange: { min: 0, max: 10 },
    durationMinutes: 90,
    ageRange: { min: 21, max: 50 },
    groupSize: 4,
  },
  {
    type: 'hiking',
    category: 'date_activity',
    title: 'Canyon Sunrise Hike',
    description: 'Early morning hike through scenic trails followed by optional coffee nearby.',
    venue: VENUES.HIKING_PARK,
    priceRange: { min: 0, max: 15 },
    durationMinutes: 150,
    ageRange: { min: 23, max: 55 },
    groupSize: 6,
  },
  {
    type: 'restaurant',
    category: 'date_activity',
    title: 'Chef’s Table Dinner',
    description: 'Intimate multi-course dinner with curated pairings in a historic cellar.',
    venue: VENUES.DINNER_SPOT,
    priceRange: { min: 60, max: 110 },
    durationMinutes: 180,
    ageRange: { min: 25, max: 55 },
    groupSize: 4,
  },
];

export function getRandomEventTemplate(): EventTemplate {
  return EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)];
}

export function getEventTemplatesByType(type: EventTemplate['type']): EventTemplate[] {
  return EVENT_TEMPLATES.filter(template => template.type === type);
}
