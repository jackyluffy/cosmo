import { db, Collections } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

async function createSwipesForUser(targetUserId: string) {
  try {
    console.log(`🎯 Target User: ${targetUserId}`);
    console.log('🔍 Fetching all test users...\n');

    // Get all users
    const usersSnapshot = await db.collection(Collections.USERS).get();

    // Filter test users
    const testUsers = usersSnapshot.docs.filter(doc =>
      doc.id.startsWith('test') && doc.id !== targetUserId
    );

    console.log(`📊 Found ${testUsers.length} test users\n`);

    if (testUsers.length === 0) {
      console.log('⚠️  No test users found to create swipes');
      return;
    }

    // Verify target user exists
    const targetUserDoc = await db.collection(Collections.USERS).doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      console.error(`❌ Error: Target user ${targetUserId} does not exist`);
      process.exit(1);
    }

    const targetUserData = targetUserDoc.data();
    console.log(`✓ Target user found: ${targetUserData?.profile?.name || 'Unknown'}`);
    console.log(`  Gender: ${targetUserData?.profile?.gender || 'Unknown'}`);
    console.log(`  Age: ${targetUserData?.profile?.age || 'Unknown'}\n`);

    console.log('💝 Creating swipes (all test users will like the target user)...\n');

    // Create swipes in batches (Firestore limit is 500 per batch)
    const batchSize = 500;
    let totalSwipesCreated = 0;

    for (let i = 0; i < testUsers.length; i += batchSize) {
      const batch = db.batch();
      const batchUsers = testUsers.slice(i, i + batchSize);

      for (const userDoc of batchUsers) {
        const swiperId = userDoc.id;
        const swiperData = userDoc.data();

        // Create swipe ID: swiperId_targetUserId
        const swipeId = `${swiperId}_${targetUserId}`;
        const swipeRef = db.collection(Collections.SWIPES).doc(swipeId);

        batch.set(swipeRef, {
          userId: swiperId,
          targetId: targetUserId,
          direction: 'like',
          createdAt: Timestamp.now(),
        });

        totalSwipesCreated++;
        console.log(`  ✓ ${swiperData?.profile?.name || swiperId} → ${targetUserData?.profile?.name || targetUserId}`);
      }

      await batch.commit();
      console.log(`\n  ✅ Batch ${Math.floor(i / batchSize) + 1} committed (${batchUsers.length} swipes)\n`);
    }

    console.log(`\n✅ Successfully created ${totalSwipesCreated} swipes!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Target User: ${targetUserId}`);
    console.log(`   - Test users who liked: ${totalSwipesCreated}`);
    console.log(`   - Collection: ${Collections.SWIPES}`);

  } catch (error) {
    console.error('❌ Error creating swipes:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: npx ts-node create-swipes-for-user.ts <targetUserId>');
  console.log('\nExample:');
  console.log('  npx ts-node create-swipes-for-user.ts bHzCB8AYCoHhj5N56aAG');
  console.log('\nThis will make all test users swipe right (like) the target user.');
  process.exit(1);
}

const targetUserId = args[0];

// Run the script
createSwipesForUser(targetUserId)
  .then(() => {
    console.log('\n✓ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
