#!/usr/bin/env ts-node

/**
 * Reusable script to set availability for test users
 * Sets all time segments to available for the next N days
 *
 * Usage:
 *   npx ts-node src/scripts/set-test-users-availability.ts [days]
 *
 * Example:
 *   npx ts-node src/scripts/set-test-users-availability.ts 5
 */

import { db, Collections } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const DAYS_TO_SET = parseInt(process.argv[2]) || 5;
const USER_ID_PREFIX = 'test';

interface AvailabilityEntry {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  night: boolean;
  blocked: boolean;
}

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

async function setTestUsersAvailability() {
  console.log(`\n🔧 Setting availability for users with ID starting with "${USER_ID_PREFIX}"`);
  console.log(`📅 Days to set: ${DAYS_TO_SET}\n`);

  try {
    // Query all users whose IDs start with "test"
    const usersSnapshot = await db
      .collection(Collections.USERS)
      .get();

    const testUsers = usersSnapshot.docs.filter(doc =>
      doc.id.toLowerCase().startsWith(USER_ID_PREFIX.toLowerCase())
    );

    if (testUsers.length === 0) {
      console.log(`❌ No users found with ID starting with "${USER_ID_PREFIX}"`);
      return;
    }

    console.log(`✅ Found ${testUsers.length} test user(s):\n`);
    testUsers.forEach(doc => {
      const userData = doc.data();
      console.log(`  - ${doc.id} (${userData.profile?.name || 'No name'})`);
    });
    console.log('');

    // Generate availability map for next N days (all available)
    const availability: Record<string, AvailabilityEntry> = {};

    for (let i = 0; i < DAYS_TO_SET; i++) {
      const date = addDays(new Date(), i);
      const dateKey = formatDate(date);

      availability[dateKey] = {
        morning: true,
        afternoon: true,
        evening: true,
        night: true,
        blocked: false,
      };
    }

    console.log(`📝 Availability pattern (${DAYS_TO_SET} days):`);
    Object.keys(availability).forEach(dateKey => {
      console.log(`  ${dateKey}: All segments available ✓`);
    });
    console.log('');

    // Update each test user
    let successCount = 0;
    let errorCount = 0;

    for (const userDoc of testUsers) {
      try {
        await db.collection(Collections.USERS).doc(userDoc.id).update({
          'profile.availability': availability,
          'profile.availabilityUpdatedAt': Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        console.log(`✅ Updated: ${userDoc.id}`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Failed to update ${userDoc.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`  Total users: ${testUsers.length}`);
    console.log(`  ✅ Successfully updated: ${successCount}`);
    console.log(`  ❌ Failed: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (successCount > 0) {
      console.log('🎉 Availability successfully set for test users!');
      console.log(`📅 All users are now available for the next ${DAYS_TO_SET} days.\n`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
setTestUsersAvailability()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
