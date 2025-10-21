import { db } from '../src/config/firebase';

async function checkData() {
  const eventId = '18AqQAqck6zVChI9GIBZ';

  // Check event data
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) {
    console.log('Event not found');
    return;
  }
  const eventData = eventSnap.data();
  console.log('=== EVENT DATA ===');
  console.log('participantUserIds:', eventData?.participantUserIds);
  console.log('participantStatuses:', JSON.stringify(eventData?.participantStatuses, null, 2));

  // Find the chat for this event
  const chatSnap = await db.collection('group_chats').where('eventId', '==', eventId).limit(1).get();
  if (chatSnap.empty) {
    console.log('No chat found for this event');
    return;
  }

  const chatDoc = chatSnap.docs[0];
  const chatData = chatDoc.data();
  console.log('\n=== CHAT DATA ===');
  console.log('chatId:', chatDoc.id);
  console.log('participantIds:', chatData.participantIds);

  // Check user profiles
  console.log('\n=== USER PROFILES ===');
  const participantIds = chatData.participantIds || [];
  for (const userId of participantIds.slice(0, 5)) {
    const userSnap = await db.collection('users').doc(userId).get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      console.log(`User ${userId}:`, {
        name: userData?.profile?.name,
        photosCount: userData?.profile?.photos?.length || 0,
        hasPhotos: !!userData?.profile?.photos,
        photos: userData?.profile?.photos,
      });
    }
  }
}

checkData().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
