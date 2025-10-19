#!/usr/bin/env ts-node

/**
 * Reusable script to create random pair matches for testing
 * Creates pair_matches with specified event type and queued status
 *
 * Usage:
 *   npx ts-node src/scripts/create-test-pair-matches.ts [count] [eventType]
 *
 * Examples:
 *   npx ts-node src/scripts/create-test-pair-matches.ts 3 dog_walking
 *   npx ts-node src/scripts/create-test-pair-matches.ts 5 coffee
 *   npx ts-node src/scripts/create-test-pair-matches.ts 10 bar
 */

import { db, Collections } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { EventType, PairMatch, AvailabilityOverlapSegment } from '../types';

const COUNT = parseInt(process.argv[2]) || 3;
const EVENT_TYPE = (process.argv[3] as EventType) || 'dog_walking';
const USER_ID_PREFIX = 'test';

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Generate random availability overlap segments
function generateAvailabilityOverlap(): AvailabilityOverlapSegment[] {
  const segments: AvailabilityOverlapSegment[] = [];
  const numDays = 3; // Generate overlap for next 3 days

  for (let i = 0; i < numDays; i++) {
    const date = addDays(new Date(), i);
    const dateKey = formatDate(date);

    // Randomly select 2-4 time segments for each day
    const allSegments: Array<'morning' | 'afternoon' | 'evening' | 'night'> =
      ['morning', 'afternoon', 'evening', 'night'];
    const numSegments = 2 + Math.floor(Math.random() * 3); // 2-4 segments

    // Shuffle and pick
    const shuffled = allSegments.sort(() => Math.random() - 0.5);
    const selectedSegments = shuffled.slice(0, numSegments);

    segments.push({
      date: dateKey,
      segments: selectedSegments,
    });
  }

  return segments;
}

// Create pair key from two user IDs (alphabetically sorted)
function createPairKey(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

async function createTestPairMatches() {
  console.log(`\n🔧 Creating ${COUNT} random pair match(es) with event type: ${EVENT_TYPE}\n`);

  try {
    // Get all test users
    const usersSnapshot = await db.collection(Collections.USERS).get();

    const testUsers = usersSnapshot.docs.filter(doc =>
      doc.id.toLowerCase().startsWith(USER_ID_PREFIX.toLowerCase())
    );

    if (testUsers.length < 2) {
      console.log(`❌ Need at least 2 test users, found ${testUsers.length}`);
      return;
    }

    console.log(`✅ Found ${testUsers.length} test user(s) available for matching\n`);

    const createdMatches: string[] = [];
    const usedPairs = new Set<string>();

    // Create the specified number of matches
    for (let i = 0; i < COUNT; i++) {
      // Randomly select 2 different users
      let user1Idx: number;
      let user2Idx: number;
      let pairKey: string;
      let attempts = 0;

      // Try to find a unique pair (avoid duplicates)
      do {
        user1Idx = Math.floor(Math.random() * testUsers.length);
        user2Idx = Math.floor(Math.random() * testUsers.length);

        if (user1Idx !== user2Idx) {
          const user1Id = testUsers[user1Idx].id;
          const user2Id = testUsers[user2Idx].id;
          pairKey = createPairKey(user1Id, user2Id);
        }

        attempts++;
        if (attempts > 100) {
          console.log(`⚠️  Could not find unique pair after ${attempts} attempts`);
          break;
        }
      } while (user1Idx === user2Idx || usedPairs.has(pairKey!));

      if (attempts > 100) continue;

      usedPairs.add(pairKey!);

      const user1 = testUsers[user1Idx];
      const user2 = testUsers[user2Idx];
      const user1Data = user1.data();
      const user2Data = user2.data();

      // Generate availability overlap
      const availabilityOverlap = generateAvailabilityOverlap();
      const overlapCount = availabilityOverlap.reduce(
        (sum, day) => sum + day.segments.length,
        0
      );

      // Create the pair match document
      const matchId = db.collection(Collections.PAIR_MATCHES).doc().id;

      const pairMatch: Omit<PairMatch, 'id'> = {
        pairKey: pairKey!,
        userIds: [user1.id, user2.id],
        status: 'active',
        queueStatus: 'queued', // Ready to be picked up by event orchestration
        queueEventType: EVENT_TYPE,
        sharedEventTypes: [EVENT_TYPE],
        suggestedEventType: EVENT_TYPE,
        availabilityOverlapCount: overlapCount,
        availabilityOverlapSegments: availabilityOverlap,
        availabilityComputedAt: Timestamp.now(),
        hasSufficientAvailability: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastActivityAt: Timestamp.now(),
        pendingEventId: null,
      };

      // Write to Firestore
      await db.collection(Collections.PAIR_MATCHES).doc(matchId).set(pairMatch);

      console.log(`✅ Created match ${i + 1}/${COUNT}:`);
      console.log(`   ID: ${matchId}`);
      console.log(`   Users: ${user1Data.profile?.name || user1.id} ↔ ${user2Data.profile?.name || user2.id}`);
      console.log(`   Event Type: ${EVENT_TYPE}`);
      console.log(`   Availability Overlap: ${overlapCount} segments across ${availabilityOverlap.length} days`);
      console.log(`   Status: queued (ready for event creation)\n`);

      createdMatches.push(matchId);
    }

    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  ✅ Successfully created: ${createdMatches.length} pair match(es)`);
    console.log(`  📋 Event Type: ${EVENT_TYPE}`);
    console.log(`  🎯 Queue Status: queued (ready for auto-organize-events cron)`);
    console.log('='.repeat(60) + '\n');

    if (createdMatches.length > 0) {
      console.log('🎉 Pair matches successfully created!');
      console.log('💡 Tip: Run the auto-organize-events cron to create events from these matches:');
      console.log('   curl -X POST http://localhost:8080/api/v1/cron/auto-organize-events\n');

      console.log('📋 Created Match IDs:');
      createdMatches.forEach((id, idx) => {
        console.log(`   ${idx + 1}. ${id}`);
      });
      console.log('');
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
createTestPairMatches()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
