import { db, Collections } from '../src/config/firebase';

async function checkEvents() {
  const eventIds = [
    'SaHXC4ZLTEeTMi0yyT39',
    'nsHxXMTEbOUle5cjrqUy',
    'xvt2f1W9jxQap7e3grx9',
  ];

  console.log('=== Checking if events exist ===\n');

  for (const eventId of eventIds) {
    const eventSnap = await db.collection(Collections.EVENTS).doc(eventId).get();

    if (eventSnap.exists) {
      const eventData = eventSnap.data();
      console.log(`Event ${eventId}:`);
      console.log(`  Exists: YES`);
      console.log(`  Status: ${eventData?.status}`);
      console.log(`  Event Type: ${eventData?.eventType}`);
      console.log(`  Participants: ${eventData?.participantUserIds?.length || 0}`);
      console.log(`  Pending Pair Match IDs: ${JSON.stringify(eventData?.pendingPairMatchIds)}`);
    } else {
      console.log(`Event ${eventId}:`);
      console.log(`  Exists: NO (deleted)`);
    }
    console.log();
  }
}

checkEvents().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
