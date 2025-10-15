import { db } from '../config/firebase';
import { GeoPoint, Timestamp } from 'firebase-admin/firestore';

// Center location: Placentia, CA
const CENTER_LAT = 33.8722;
const CENTER_LNG = -117.8703;
const MAX_RADIUS_MILES = 20;

// Convert miles to degrees (approximate)
const MILES_TO_DEGREES = 1 / 69;

// Generate random location within radius
function generateRandomLocation(): GeoPoint {
  const radiusInDegrees = MAX_RADIUS_MILES * MILES_TO_DEGREES;
  const randomAngle = Math.random() * 2 * Math.PI;
  const randomRadius = Math.random() * radiusInDegrees;
  
  const lat = CENTER_LAT + randomRadius * Math.cos(randomAngle);
  const lng = CENTER_LNG + randomRadius * Math.sin(randomAngle);
  
  return new GeoPoint(lat, lng);
}

// Sample data
const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery',
  'Quinn', 'Reese', 'Blake', 'Drew', 'Sage', 'River', 'Phoenix', 'Skylar',
  'Rowan', 'Finley', 'Emerson', 'Hayden'
];

const bios = [
  'Love exploring new coffee shops and hiking trails ☕🥾',
  'Foodie, adventurer, and tennis enthusiast 🎾',
  'Always up for trying new restaurants or catching live music 🎵',
  'Weekend warrior who loves brunch and beach days 🌊',
  'Fitness junkie and craft beer connoisseur 🍺',
  'Bookworm by day, social butterfly by night 📚',
  'Passionate about cooking and outdoor adventures 🍳',
  'Tennis player looking for doubles partners and fun people 🎾',
  'Brunch lover who enjoys good company and great food 🥞',
  'Hiking enthusiast who also loves a good bar crawl 🏔️',
  'Yoga instructor who loves trying new restaurants 🧘',
  'Software engineer who needs to get out more 💻',
  'Dog lover, runner, and amateur photographer 📸',
  'Music festival addict and taco enthusiast 🌮',
  'Rock climber who also enjoys fine dining 🧗',
  'Beach volleyball player and sunset chaser 🏐',
  'Wine lover who enjoys hiking and live music 🍷',
  'Foodie explorer always seeking the next best meal 🍜',
  'Outdoor enthusiast who loves group adventures 🚵',
  'Social connector who brings people together 🤝'
];

const interests = [
  'tennis', 'hiking', 'coffee', 'brunch', 'craft beer', 'wine tasting',
  'live music', 'yoga', 'running', 'beach', 'cooking', 'photography',
  'travel', 'fitness', 'food', 'reading', 'movies', 'art', 'dancing',
  'volleyball', 'cycling', 'kayaking', 'rock climbing', 'meditation'
];

const photos = [
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
  'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400',
  'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400',
];

async function seedUsers() {
  console.log('Starting to seed 20 users...');
  
  const batch = db.batch();
  const userIds: string[] = [];

  for (let i = 0; i < 20; i++) {
    const userRef = db.collection('users').doc();
    userIds.push(userRef.id);
    
    const location = generateRandomLocation();
    const age = 21 + Math.floor(Math.random() * 24); // 21-44
    const gender = i % 2 === 0 ? 'male' : 'female';
    const name = firstNames[i];
    
    // Select 3-6 random interests
    const numInterests = 3 + Math.floor(Math.random() * 4);
    const userInterests = [...interests]
      .sort(() => Math.random() - 0.5)
      .slice(0, numInterests);
    
    // Select 3 random photos
    const userPhotos = [...photos]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    const userData = {
      phone: `+1555000${String(i).padStart(4, '0')}`,
      profile: {
        name,
        age,
        gender,
        bio: bios[i],
        photos: userPhotos,
        interests: userInterests,
        lookingFor: ['male', 'female'],
        location,
        radius: 25,
        verified: true,
        traits: {
          extroversion: Math.floor(Math.random() * 100),
          openness: Math.floor(Math.random() * 100),
          agreeableness: Math.floor(Math.random() * 100),
          conscientiousness: Math.floor(Math.random() * 100),
        },
      },
      subscription: {
        status: 'active',
        tier: 'premium',
        trialEventUsed: false,
        expiresAt: Timestamp.fromDate(new Date('2026-12-31')),
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    batch.set(userRef, userData);
    console.log(`Created user ${i + 1}/20: ${name} (${gender}, ${age})`);
  }

  await batch.commit();
  console.log('✅ Successfully seeded 20 users to Firebase!');
  console.log('User IDs:', userIds);
}

// Run the seed function
seedUsers()
  .then(() => {
    console.log('Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
