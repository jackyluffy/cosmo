import { db } from '../src/config/firebase';

async function cleanupPairMatches() {
  console.log('=== Starting pair_matches cleanup ===\n');

  try {
    // Get all pair_matches documents
    const pairMatchesSnap = await db.collection('pair_matches').get();

    console.log(`Total pair_matches found: ${pairMatchesSnap.size}\n`);

    if (pairMatchesSnap.size === 0) {
      console.log('No pair_matches to clean up');
      return;
    }

    let updatedCount = 0;
    let alreadyCleanCount = 0;
    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH_SIZE = 500;

    for (const doc of pairMatchesSnap.docs) {
      const data = doc.data();
      const needsUpdate = data.pendingEventId || data.queueStatus !== 'queued';

      if (needsUpdate) {
        console.log(`Cleaning up pair_match ${doc.id}:`);
        console.log(`  - Current status: ${data.queueStatus}`);
        console.log(`  - Current pendingEventId: ${data.pendingEventId || 'null'}`);
        console.log(`  - Event type: ${data.eventType}`);

        batch.update(doc.ref, {
          pendingEventId: null,
          queueStatus: 'queued',
        });

        updatedCount++;
        batchCount++;

        // Commit batch if we hit the limit
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          console.log(`\nCommitted batch of ${batchCount} updates\n`);
          batchCount = 0;
        }
      } else {
        alreadyCleanCount++;
      }
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\nCommitted final batch of ${batchCount} updates\n`);
    }

    console.log('=== Cleanup Summary ===');
    console.log(`Total pair_matches: ${pairMatchesSnap.size}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Already clean: ${alreadyCleanCount}`);

    // Verify the cleanup
    console.log('\n=== Verifying cleanup ===');
    const queuedSnap = await db.collection('pair_matches')
      .where('queueStatus', '==', 'queued')
      .get();

    const queuedByType: any = {};
    queuedSnap.docs.forEach(doc => {
      const data = doc.data();
      if (!data.pendingEventId) {
        const eventType = data.eventType || 'unknown';
        queuedByType[eventType] = (queuedByType[eventType] || 0) + 1;
      }
    });

    console.log('Queued pair_matches by event type (eligible for events):');
    console.log(JSON.stringify(queuedByType, null, 2));

  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

cleanupPairMatches().then(() => {
  console.log('\n=== Cleanup completed successfully ===');
  process.exit(0);
}).catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
