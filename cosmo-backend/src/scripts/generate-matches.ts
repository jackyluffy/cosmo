import { db, Collections } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

interface GenerateMatchesOptions {
  matchCount: number;
  requiredInterests: string[];
}

const SAMPLE_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Elijah', 'Sophia', 'James',
  'Isabella', 'William', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Henry',
  'Harper', 'Theodore', 'Evelyn', 'Jack', 'Abigail', 'Sebastian', 'Emily', 'Owen',
  'Elizabeth', 'Alexander', 'Sofia', 'Michael', 'Avery', 'Daniel', 'Grace', 'Matthew'
];

const SAMPLE_BIOS = [
  'Adventure seeker | Coffee enthusiast',
  'Living life one adventure at a time',
  'Passionate about travel and good food',
  'Dog lover | Outdoor enthusiast',
  'Foodie | Always exploring new places',
  'Music and art lover | Beach person',
  'Fitness junkie | Coffee addict',
  'Love to laugh and make memories',
  'Wanderlust | Photography enthusiast',
  'Life is better with good company',
  'Nature enthusiast | Weekend hiker',
  'Dog parent | Always up for new adventures',
];

const SAMPLE_PHOTO_URLS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400',
];

const ALL_INTERESTS = [
  'Hiking', 'Photography', 'Cooking', 'Travel', 'Music', 'Reading', 'Yoga',
  'Gaming', 'Art', 'Coffee', 'Wine', 'Movies', 'Running', 'Cycling', 'Dancing',
  'Fitness', 'Meditation', 'Food', 'Nature', 'Beach', 'Mountains', 'Fashion',
  'Technology', 'Sports', 'Concerts', 'Camping', 'Surfing', 'Skiing', 'Dog Walking'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateUserId(): string {
  return `test-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function generateUser(requiredInterests: string[]) {
  const userId = generateUserId();
  const name = getRandomElement(SAMPLE_NAMES);
  const gender = Math.random() > 0.5 ? 'male' : 'female';
  const age = 22 + Math.floor(Math.random() * 16); // 22-37

  // Generate 3 random photos
  const photos = getRandomElements(SAMPLE_PHOTO_URLS, 3);

  // Include required interests plus 2-4 random additional interests
  const additionalInterestCount = 2 + Math.floor(Math.random() * 3);
  const otherInterests = getRandomElements(
    ALL_INTERESTS.filter(i => !requiredInterests.includes(i)),
    additionalInterestCount
  );
  const interests = [...requiredInterests, ...otherInterests];

  // Random location in SF Bay Area
  const baseLat = 37.7749;
  const baseLng = -122.4194;
  const lat = baseLat + (Math.random() - 0.5) * 0.5;
  const lng = baseLng + (Math.random() - 0.5) * 0.5;

  const now = Timestamp.now();

  return {
    userId,
    userData: {
      phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
      email: `${name.toLowerCase()}.test${Math.floor(Math.random() * 1000)}@example.com`,
      authProvider: 'phone' as const,
      profile: {
        name,
        age,
        gender,
        genderPreference: 'both' as const,
        bio: getRandomElement(SAMPLE_BIOS),
        photos,
        interests,
        traits: {
          extroversion: Math.floor(Math.random() * 100),
          adventurous: Math.floor(Math.random() * 100),
          spontaneous: Math.floor(Math.random() * 100),
          organized: Math.floor(Math.random() * 100),
          creative: Math.floor(Math.random() * 100),
        },
        location: {
          _latitude: lat,
          _longitude: lng,
        },
        radius: 50,
        verified: false,
        completedAt: now,
      },
      subscription: {
        status: 'active' as const,
        tier: 'basic' as const,
        trialEventUsed: false,
      },
      preferences: {
        notifications: {
          push: true,
          email: true,
          sms: false,
        },
        privacy: {
          showProfile: true,
          showLocation: true,
        },
      },
      createdAt: now,
      updatedAt: now,
      isActive: true,
      isVerified: true,
    }
  };
}

async function generateMatchesForUsers(options: GenerateMatchesOptions) {
  try {
    console.log('🔧 Generating matches with options:');
    console.log(`   - Match count: ${options.matchCount}`);
    console.log(`   - Required interests: ${options.requiredInterests.join(', ')}`);
    console.log('');

    const generatedUsers: string[] = [];
    const batch = db.batch();

    // Generate users
    for (let i = 0; i < options.matchCount * 2; i++) {
      const { userId, userData } = generateUser(options.requiredInterests);
      const userRef = db.collection(Collections.USERS).doc(userId);
      batch.set(userRef, userData);
      generatedUsers.push(userId);
      console.log(`✓ Created user ${i + 1}/${options.matchCount * 2}: ${userData.profile.name} (${userId})`);
      console.log(`  Interests: ${userData.profile.interests.join(', ')}`);
    }

    // Commit users first
    await batch.commit();
    console.log(`\n✅ Successfully created ${generatedUsers.length} users`);

    // Generate matches (pair them up)
    console.log(`\n🔗 Creating ${options.matchCount} matches...`);
    const matchBatch = db.batch();
    const createdMatches: string[] = [];

    for (let i = 0; i < options.matchCount; i++) {
      const user1Id = generatedUsers[i * 2];
      const user2Id = generatedUsers[i * 2 + 1];

      // Create pair match
      const matchId = `${user1Id}_${user2Id}`;
      const matchRef = db.collection(Collections.PAIR_MATCHES).doc(matchId);

      matchBatch.set(matchRef, {
        user1Id,
        user2Id,
        status: 'matched',
        matchScore: 75 + Math.floor(Math.random() * 25), // 75-100
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        interests: options.requiredInterests,
      });

      createdMatches.push(matchId);
      console.log(`✓ Match ${i + 1}: ${user1Id} ↔ ${user2Id}`);
    }

    await matchBatch.commit();
    console.log(`\n✅ Successfully created ${options.matchCount} pair matches`);

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   - Users created: ${generatedUsers.length}`);
    console.log(`   - Matches created: ${createdMatches.length}`);
    console.log(`   - Required interests: ${options.requiredInterests.join(', ')}`);

    console.log('\n📝 Generated User IDs:');
    generatedUsers.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });

    console.log('\n🔗 Generated Match IDs:');
    createdMatches.forEach((id, index) => {
      console.log(`   ${index + 1}. ${id}`);
    });

    return {
      users: generatedUsers,
      matches: createdMatches,
    };
  } catch (error) {
    console.error('❌ Error generating matches:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: npx ts-node generate-matches.ts <matchCount> <interest1> [interest2] [interest3] ...');
  console.log('\nExample:');
  console.log('  npx ts-node generate-matches.ts 2 "Dog Walking"');
  console.log('  npx ts-node generate-matches.ts 5 "Hiking" "Photography" "Travel"');
  process.exit(1);
}

const matchCount = parseInt(args[0], 10);
const requiredInterests = args.slice(1);

if (isNaN(matchCount) || matchCount < 1) {
  console.error('❌ Error: matchCount must be a positive number');
  process.exit(1);
}

if (requiredInterests.length === 0) {
  console.error('❌ Error: At least one interest must be provided');
  process.exit(1);
}

// Run the script
generateMatchesForUsers({
  matchCount,
  requiredInterests,
})
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
