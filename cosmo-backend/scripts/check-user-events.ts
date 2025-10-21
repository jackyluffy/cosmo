import { db } from '../src/config/firebase';

async function checkUserEvents() {
  const userId = 'bHzCB8AYCoHhj5N56aAG';
  
  console.log('=== Checking user events ===');
  
  // Get user data
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) {
    console.log('User not found');
    return;
  }
  
  const userData = userSnap.data();
  console.log('\n=== User Pending Events ===');
  console.log(JSON.stringify(userData?.pendingEvents, null, 2));
  console.log('\nPending Event Count:', userData?.pendingEventCount);
  
  // Get all events this user is assigned to
  const eventsSnap = await db.collection('events')
    .where('participantUserIds', 'array-contains', userId)
    .get();
  
  console.log('\n=== Events User is Assigned To ===');
  console.log('Total events:', eventsSnap.size);
  
  const dogWalkingEvents = [];
  eventsSnap.docs.forEach(doc => {
    const event = doc.data();
    console.log('\nEvent ID:', doc.id);
    console.log('Title:', event.title);
    console.log('Type:', event.eventType);
    console.log('Status:', event.status);
    console.log('User Status:', event.participantStatuses?.[userId]);
    
    if (event.eventType === 'dog_walking') {
      dogWalkingEvents.push({
        id: doc.id,
        title: event.title,
        status: event.status,
        userStatus: event.participantStatuses?.[userId],
      });
    }
  });
  
  console.log('\n=== Dog Walking Events ===');
  console.log('Count:', dogWalkingEvents.length);
  dogWalkingEvents.forEach(event => {
    console.log('\nEvent ID:', event.id);
    console.log('Title:', event.title);
    console.log('Event Status:', event.status);
    console.log('User Status:', event.userStatus);
  });
}

checkUserEvents().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
