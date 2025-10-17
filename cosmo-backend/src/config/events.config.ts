// Event venues and templates configuration for Placentia, CA area

export interface VenueConfig {
  name: string;
  address: string;
  lat: number;
  lng: number;
  photos: string[];
  description?: string;
  priceRange?: { min: number; max: number };
  durationMinutes?: number;
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
    description: 'Warm industrial cafe with rotating single-origin coffees and pastries.',
    priceRange: { min: 6, max: 15 },
    durationMinutes: 90,
  },
  COFFEE_DATE_TWO: {
    name: 'Portola Coffee Lab',
    address: '3313 Hyland Ave, Costa Mesa, CA 92626',
    lat: 33.6969,
    lng: -117.9187,
    photos: ['https://images.unsplash.com/photo-1481391319762-47c0dd58b6af?w=800'],
    description: 'Award-winning roaster with pour-over bar and airy seating.',
    priceRange: { min: 7, max: 18 },
    durationMinutes: 90,
  },
  COFFEE_DATE_THREE: {
    name: 'Contra Coffee & Tea',
    address: '115 N Harbor Blvd, Fullerton, CA 92832',
    lat: 33.8729,
    lng: -117.9242,
    photos: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800'],
    description: 'Nitro tea and coffee bar with cozy community tables.',
    priceRange: { min: 6, max: 14 },
    durationMinutes: 90,
  },
  COCKTAIL_BAR: {
    name: 'The Blind Rabbit',
    address: '440 S Anaheim Blvd, Anaheim, CA 92805',
    lat: 33.832,
    lng: -117.912,
    photos: ['https://images.unsplash.com/photo-1514361892635-6e122620e884?w=800'],
    description: 'Speakeasy-style bar with craft cocktails and intimate booths.',
    priceRange: { min: 20, max: 45 },
    durationMinutes: 120,
  },
  COCKTAIL_BAR_TWO: {
    name: 'Strong Water Anaheim',
    address: '270 S Clementine St, Anaheim, CA 92805',
    lat: 33.8332,
    lng: -117.9131,
    photos: ['https://images.unsplash.com/photo-1546171753-97d7676f45c1?w=800'],
    description: 'Tiki-inspired hideaway with tropical cocktails and small bites.',
    priceRange: { min: 18, max: 40 },
    durationMinutes: 120,
  },
  COCKTAIL_BAR_THREE: {
    name: 'Rembrandt’s Kitchen & Bar',
    address: '909 E Yorba Linda Blvd, Placentia, CA 92870',
    lat: 33.8896,
    lng: -117.8448,
    photos: ['https://images.unsplash.com/photo-1527169402691-feff5539e52c?w=800'],
    description: 'Neighborhood bar with live music nights and patio seating.',
    priceRange: { min: 16, max: 38 },
    durationMinutes: 120,
  },
  DINNER_SPOT: {
    name: 'The Cellar Restaurant',
    address: '305 N Harbor Blvd, Fullerton, CA 92832',
    lat: 33.8725,
    lng: -117.9243,
    photos: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'],
    description: 'Historic cellar serving multi-course fine dining with wine pairings.',
    priceRange: { min: 65, max: 120 },
    durationMinutes: 180,
  },
  DINNER_SPOT_TWO: {
    name: 'Summit House',
    address: '2000 E Bastanchury Rd, Fullerton, CA 92835',
    lat: 33.8915,
    lng: -117.901,
    photos: ['https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800'],
    description: 'Hilltop steakhouse with sunset views and classic California fare.',
    priceRange: { min: 55, max: 110 },
    durationMinutes: 150,
  },
  DINNER_SPOT_THREE: {
    name: 'The Ranch Restaurant',
    address: '1025 E Ball Rd, Anaheim, CA 92805',
    lat: 33.8179,
    lng: -117.8987,
    photos: ['https://images.unsplash.com/photo-1555992336-cbf3b55a620a?w=800'],
    description: 'Farm-to-table dining with seasonal tasting menus and live music.',
    priceRange: { min: 70, max: 130 },
    durationMinutes: 180,
  },
  TRI_CITY_TENNIS: {
    name: 'Tri-City Park Tennis Courts',
    address: '2301 N Kraemer Blvd, Placentia, CA 92870',
    lat: 33.8789,
    lng: -117.8547,
    photos: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800'],
    description: 'Six lighted courts surrounded by lake views and park amenities.',
    priceRange: { min: 0, max: 10 },
    durationMinutes: 150,
  },
  TENNIS_TWO: {
    name: 'Craig Regional Park Courts',
    address: '3300 N State College Blvd, Fullerton, CA 92835',
    lat: 33.9035,
    lng: -117.8888,
    photos: ['https://images.unsplash.com/photo-1542144582-1ba00456b5d5?w=800'],
    description: 'Shaded courts with nearby picnic areas for post-match hangs.',
    priceRange: { min: 0, max: 10 },
    durationMinutes: 150,
  },
  TENNIS_THREE: {
    name: 'Anaheim Tennis Center',
    address: '975 S State College Blvd, Anaheim, CA 92806',
    lat: 33.8238,
    lng: -117.8893,
    photos: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800'],
    description: 'Pro shop, ball machine rentals, and coffee bar on site.',
    priceRange: { min: 5, max: 20 },
    durationMinutes: 150,
  },
  DOG_PARK: {
    name: 'Yorba Linda Dog Park',
    address: '19001 Casa Loma Ave, Yorba Linda, CA 92886',
    lat: 33.8814,
    lng: -117.8133,
    photos: ['https://images.unsplash.com/photo-1525253086316-d0c936c814f8?w=800'],
    description: 'Three-acre off-leash park with separate areas for small and large dogs.',
    priceRange: { min: 0, max: 5 },
    durationMinutes: 90,
  },
  DOG_PARK_TWO: {
    name: 'Fullerton Pooch Park',
    address: '201 S Basque Ave, Fullerton, CA 92833',
    lat: 33.8707,
    lng: -117.956,
    photos: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800'],
    description: 'Shaded park with agility equipment and weekly social hours.',
    priceRange: { min: 0, max: 5 },
    durationMinutes: 90,
  },
  DOG_PARK_THREE: {
    name: 'La Palma Dog Park',
    address: '5062 La Palma Ave, La Palma, CA 90623',
    lat: 33.8466,
    lng: -118.0456,
    photos: ['https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=800'],
    description: 'Community-run dog park with fresh water stations and weekend meetups.',
    priceRange: { min: 0, max: 5 },
    durationMinutes: 90,
  },
  HIKING_PARK: {
    name: 'Carbon Canyon Regional Park',
    address: '4442 Carbon Canyon Rd, Brea, CA 92823',
    lat: 33.9123,
    lng: -117.8456,
    photos: ['https://images.unsplash.com/photo-1551632811-561732d1e306?w=800'],
    description: 'Redwood grove trails with gentle elevation and post-hike picnic spots.',
    priceRange: { min: 0, max: 10 },
    durationMinutes: 150,
  },
  HIKING_PARK_TWO: {
    name: 'Peters Canyon Regional Park',
    address: '8548 Canyon View Ave, Orange, CA 92869',
    lat: 33.787,
    lng: -117.7406,
    photos: ['https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800'],
    description: 'Wildlife-rich canyon with lake views and sunrise-friendly trails.',
    priceRange: { min: 0, max: 12 },
    durationMinutes: 150,
  },
  HIKING_PARK_THREE: {
    name: 'Chino Hills State Park',
    address: '4721 Sapphire Rd, Chino Hills, CA 91709',
    lat: 33.9502,
    lng: -117.7115,
    photos: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'],
    description: 'Rolling hills, wildflowers, and multiple trail difficulty options.',
    priceRange: { min: 0, max: 10 },
    durationMinutes: 180,
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

export const EVENT_VENUE_OPTIONS: Record<EventTemplate['type'], VenueConfig[]> = {
  coffee: [VENUES.COFFEE_DATE, VENUES.COFFEE_DATE_TWO, VENUES.COFFEE_DATE_THREE],
  bar: [VENUES.COCKTAIL_BAR, VENUES.COCKTAIL_BAR_TWO, VENUES.COCKTAIL_BAR_THREE],
  restaurant: [VENUES.DINNER_SPOT, VENUES.DINNER_SPOT_TWO, VENUES.DINNER_SPOT_THREE],
  tennis: [VENUES.TRI_CITY_TENNIS, VENUES.TENNIS_TWO, VENUES.TENNIS_THREE],
  dog_walking: [VENUES.DOG_PARK, VENUES.DOG_PARK_TWO, VENUES.DOG_PARK_THREE],
  hiking: [VENUES.HIKING_PARK, VENUES.HIKING_PARK_TWO, VENUES.HIKING_PARK_THREE],
};

export function getVenueOptionsForType(type: EventTemplate['type']): VenueConfig[] {
  return EVENT_VENUE_OPTIONS[type] || [];
}
