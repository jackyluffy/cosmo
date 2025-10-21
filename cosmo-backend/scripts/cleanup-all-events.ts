import { db, Collections } from '../src/config/firebase';

async function cleanupAllEvents() {
  console.log('=== Starting cleanup of all events ===\n');

  try {
    // 1. Delete all events
    console.log('Step 1: Deleting all events from EVENTS collection...');
    const eventsSnapshot = await db.collection(Collections.EVENTS).get();
    const eventCount = eventsSnapshot.size;

    const eventDeletePromises = eventsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(eventDeletePromises);
    console.log(`✓ Deleted ${eventCount} events\n`);

    // 2. Reset user fields
    console.log('Step 2: Resetting user fields (pendingEvents, pendingEventCount)...');
    const usersSnapshot = await db.collection(Collections.USERS).get();
    let userUpdateCount = 0;

    const userUpdatePromises = usersSnapshot.docs.map(async (doc) => {
      const userData = doc.data();
      if (userData.pendingEvents?.length > 0 || userData.pendingEventCount > 0) {
        await doc.ref.update({
          pendingEvents: [],
          pendingEventCount: 0,
        });
        userUpdateCount++;
      }
    });

    await Promise.all(userUpdatePromises);
    console.log(`✓ Updated ${userUpdateCount} users\n`);

    // 3. Reset pair_matches fields
    console.log('Step 3: Resetting pair_matches fields (pendingEventId)...');
    const pairMatchesSnapshot = await db.collection(Collections.PAIR_MATCHES).get();
    let pairMatchUpdateCount = 0;

    const pairMatchUpdatePromises = pairMatchesSnapshot.docs.map(async (doc) => {
      const pairData = doc.data();
      if (pairData.pendingEventId) {
        await doc.ref.update({
          pendingEventId: null,
        });
        pairMatchUpdateCount++;
      }
    });

    await Promise.all(pairMatchUpdatePromises);
    console.log(`✓ Updated ${pairMatchUpdateCount} pair_matches\n`);

    // 4. Delete all event_participants
    console.log('Step 4: Deleting all event_participants...');
    const participantsSnapshot = await db.collection(Collections.EVENT_PARTICIPANTS).get();
    const participantCount = participantsSnapshot.size;

    const participantDeletePromises = participantsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(participantDeletePromises);
    console.log(`✓ Deleted ${participantCount} event_participants\n`);

    console.log('=== Cleanup completed successfully! ===');
    console.log('Summary:');
    console.log(`  - Events deleted: ${eventCount}`);
    console.log(`  - Users updated: ${userUpdateCount}`);
    console.log(`  - Pair matches updated: ${pairMatchUpdateCount}`);
    console.log(`  - Event participants deleted: ${participantCount}`);

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

cleanupAllEvents().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
