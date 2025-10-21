import { db } from '../src/config/firebase';

async function checkPairMatches() {
  const userId = 'bHzCB8AYCoHhj5N56aAG';

  console.log('=== Checking pair_matches for user:', userId, '===\n');

  // Get all pair matches for this user
  const pairMatchesSnap = await db.collection('pair_matches')
    .where('userIds', 'array-contains', userId)
    .get();

  console.log('Total pair matches found:', pairMatchesSnap.size, '\n');

  if (pairMatchesSnap.size === 0) {
    console.log('No pair matches found for this user');
    return;
  }

  const queuedForEventType: any = {};

  pairMatchesSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log('Pair Match ID:', doc.id);
    console.log('User IDs:', data.userIds);
    console.log('Event Type:', data.eventType);
    console.log('Queue Status:', data.queueStatus);
    console.log('Pending Event ID:', data.pendingEventId);
    console.log('Availability Computed At:', data.availabilityComputedAt?.toDate());
    console.log('Created At:', data.createdAt?.toDate());
    console.log('---');

    // Count queued matches by event type
    if (data.queueStatus === 'queued' && !data.pendingEventId) {
      const eventType = data.queueEventType || 'unknown';
      queuedForEventType[eventType] = (queuedForEventType[eventType] || 0) + 1;
    }
  });

  console.log('\n=== Queued matches by event type (eligible for events) ===');
  console.log(JSON.stringify(queuedForEventType, null, 2));

  // Also check total queued matches across all users for each event type
  console.log('\n=== Checking all queued matches by event type ===');
  const allQueuedSnap = await db.collection('pair_matches')
    .where('queueStatus', '==', 'queued')
    .get();

  const allQueuedByType: any = {};
  allQueuedSnap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.pendingEventId) {
      const eventType = data.queueEventType || 'unknown';
      allQueuedByType[eventType] = (allQueuedByType[eventType] || 0) + 1;
    }
  });

  console.log('Total queued (no pendingEventId) by type:');
  console.log(JSON.stringify(allQueuedByType, null, 2));
}

checkPairMatches().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
