"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
const uuid_1 = require("uuid");
const SAMPLE_NAMES = [
    'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Elijah', 'Sophia', 'James',
    'Isabella', 'William', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Henry',
    'Harper', 'Theodore', 'Evelyn', 'Jack', 'Abigail', 'Sebastian', 'Emily', 'Owen',
    'Elizabeth', 'Alexander', 'Sofia', 'Michael', 'Avery', 'Daniel'
];
const SAMPLE_INTERESTS = [
    'Hiking', 'Photography', 'Cooking', 'Travel', 'Music', 'Reading', 'Yoga',
    'Gaming', 'Art', 'Coffee', 'Wine', 'Movies', 'Running', 'Cycling', 'Dancing',
    'Fitness', 'Meditation', 'Food', 'Nature', 'Beach', 'Mountains', 'Fashion',
    'Technology', 'Sports', 'Concerts', 'Camping', 'Surfing', 'Skiing'
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
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}
function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}
function generateTestUser(index) {
    const name = SAMPLE_NAMES[index % SAMPLE_NAMES.length];
    const gender = index % 3 === 0 ? 'male' : index % 3 === 1 ? 'female' : 'non-binary';
    const age = 22 + Math.floor(Math.random() * 16); // 22-37
    // Generate 3 random photos
    const photos = getRandomElements(SAMPLE_PHOTO_URLS, 3);
    // Generate random interests
    const interests = getRandomElements(SAMPLE_INTERESTS, 3 + Math.floor(Math.random() * 5));
    // Random location in SF Bay Area
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    const lat = baseLat + (Math.random() - 0.5) * 0.5;
    const lng = baseLng + (Math.random() - 0.5) * 0.5;
    return {
        userId: `test-user-${(0, uuid_1.v4)()}`,
        phoneNumber: `+1555${index.toString().padStart(7, '0')}`,
        profile: {
            name,
            age,
            gender,
            bio: getRandomElement(SAMPLE_BIOS),
            photos,
            interests,
            lookingFor: 'everyone',
            ageRange: {
                min: 21,
                max: 40,
            },
            maxDistance: 50,
            location: {
                lat,
                lng,
            },
        },
        subscription: {
            status: 'trial',
            plan: 'free',
        },
        onboarding: {
            completed: true,
            currentStep: 'completed',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
async function generateTestUsers() {
    try {
        console.log('Generating 30 test users...');
        const batch = firebase_1.db.batch();
        const userIds = [];
        for (let i = 0; i < 30; i++) {
            const testUser = generateTestUser(i);
            const userRef = firebase_1.db.collection('users').doc(testUser.userId);
            batch.set(userRef, testUser);
            userIds.push(testUser.userId);
            console.log(`Created test user ${i + 1}/30: ${testUser.profile.name} (${testUser.userId})`);
        }
        await batch.commit();
        console.log('✓ Successfully created 30 test users');
        console.log('\nGenerated User IDs:');
        userIds.forEach((id, index) => {
            console.log(`${index + 1}. ${id}`);
        });
        return userIds;
    }
    catch (error) {
        console.error('Error generating test users:', error);
        throw error;
    }
}
async function createSwipes(userIds, targetUserId) {
    try {
        console.log(`\nCreating swipes for target user: ${targetUserId}`);
        // Select 15 random users to like the target
        const likingUsers = getRandomElements(userIds, 15);
        const batch = firebase_1.db.batch();
        for (const likerId of likingUsers) {
            const swipeId = `${likerId}_${targetUserId}`;
            const swipeRef = firebase_1.db.collection('swipes').doc(swipeId);
            batch.set(swipeRef, {
                swipeId,
                userId: likerId,
                targetUserId,
                direction: 'right',
                createdAt: new Date(),
            });
            console.log(`✓ ${likerId} liked ${targetUserId}`);
        }
        await batch.commit();
        console.log(`\n✓ Successfully created ${likingUsers.length} likes for target user`);
    }
    catch (error) {
        console.error('Error creating swipes:', error);
        throw error;
    }
}
async function main() {
    const targetUserId = 'nA4b1izLMYnGms4hPYJt';
    console.log('=== Test User Generator ===\n');
    // Generate 30 test users
    const userIds = await generateTestUsers();
    // Create swipes where 15 of them like the target user
    await createSwipes(userIds, targetUserId);
    console.log('\n=== Done! ===');
    process.exit(0);
}
// Run the script
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=generate-test-users.js.map