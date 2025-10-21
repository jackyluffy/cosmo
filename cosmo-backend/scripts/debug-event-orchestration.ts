import { db, Collections } from '../src/config/firebase';
import { EventType, PairMatch, User } from '../src/types';

const ACTIVE_ASSIGNMENT_STATUSES = new Set(['pending_join', 'joined', 'confirmed']);

async function userHasActiveEventOfType(userId: string, eventType: EventType): Promise<boolean> {
  try {
    const userSnap = await db.collection(Collections.USERS).doc(userId).get();
    if (!userSnap.exists) {
      console.log(`  User ${userId} does not exist`);
      return false;
    }
    const userData = userSnap.data() as User;
    const assignments = userData.pendingEvents || [];
    const hasActive = assignments.some(
      (assignment) =>
        assignment.eventType === eventType &&
        ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status as any)
    );
    console.log(`  User ${userId} has active ${eventType} event: ${hasActive}`);
    if (hasActive) {
      console.log(`    Assignments:`, JSON.stringify(assignments, null, 2));
    }
    return hasActive;
  } catch (error) {
    console.warn('Failed to evaluate user assignments', { userId, error });
    return false;
  }
}

async function filterEligiblePairsForEventType(
  pairs: PairMatch[],
  eventType: EventType
): Promise<PairMatch[]> {
  const filtered: PairMatch[] = [];
  for (const pair of pairs) {
    console.log(`\nChecking pair ${pair.id}:`);
    console.log(`  Users: ${pair.userIds.join(', ')}`);

    const conflicts = await Promise.all(
      pair.userIds.map((userId) => userHasActiveEventOfType(userId, eventType))
    );

    if (conflicts.some(Boolean)) {
      console.log(`  ❌ Pair filtered out due to conflicts`);
      continue;
    }
    console.log(`  ✅ Pair is eligible`);
    filtered.push(pair);
  }
  return filtered;
}

async function debugEventOrchestration() {
  const eventType: EventType = 'dog_walking';

  console.log('=== Debugging Event Orchestration for dog_walking ===\n');

  // Get queued pairs
  console.log('Step 1: Fetching queued pairs...');
  const queuedSnap = await db
    .collection(Collections.PAIR_MATCHES)
    .where('queueStatus', '==', 'queued')
    .where('queueEventType', '==', eventType)
    .get();

  console.log(`Found ${queuedSnap.size} queued pairs for ${eventType}\n`);

  const pairs: PairMatch[] = queuedSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as PairMatch));

  // Show all pairs
  pairs.forEach((pair, index) => {
    console.log(`Pair ${index + 1} (${pair.id}):`);
    console.log(`  Users: ${pair.userIds?.join(', ') || 'N/A'}`);
    console.log(`  Status: ${pair.queueStatus}`);
    console.log(`  Event Type: ${pair.queueEventType}`);
    console.log(`  Pending Event ID: ${pair.pendingEventId || 'null'}`);
  });

  // Filter out pairs with pendingEventId
  console.log('\n\nStep 2: Filtering out pairs with pendingEventId...');
  const eligiblePairs = pairs.filter((match) => !match.pendingEventId);
  console.log(`${eligiblePairs.length} pairs without pendingEventId\n`);

  // Calculate required pairs
  const pairsRequired = 2; // dog_walking requires groupSize 4, so 2 pairs
  console.log(`\nStep 3: Checking if we have enough pairs...`);
  console.log(`Required: ${pairsRequired} pairs`);
  console.log(`Available: ${eligiblePairs.length} pairs`);

  if (eligiblePairs.length < pairsRequired) {
    console.log(`\n❌ Not enough pairs! Need ${pairsRequired}, have ${eligiblePairs.length}`);
    return;
  }

  console.log(`✅ We have enough pairs!\n`);

  // Check user eligibility
  console.log('\nStep 4: Filtering pairs by user eligibility...');
  const filteredPairs = await filterEligiblePairsForEventType(eligiblePairs, eventType);

  console.log(`\n\n=== FINAL RESULT ===`);
  console.log(`Eligible pairs after all filtering: ${filteredPairs.length}`);
  console.log(`Required pairs for one event: ${pairsRequired}`);

  if (filteredPairs.length >= pairsRequired) {
    console.log(`\n✅ SUCCESS: Can create ${Math.floor(filteredPairs.length / pairsRequired)} event(s)!`);
  } else {
    console.log(`\n❌ FAILURE: Not enough eligible pairs after filtering`);
    console.log(`This is why events are not being created.`);
  }
}

debugEventOrchestration().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
