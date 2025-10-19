import { db, Collections } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

async function setAvailabilityDirect() {
  const userId = 'bHzCB8AYCoHhj5N56aAG';

  const availability = {
    '2025-10-18': {
      morning: true,
      afternoon: true,
      evening: false,
      night: false,
      blocked: false,
    },
    '2025-10-19': {
      morning: false,
      afternoon: true,
      evening: true,
      night: true,
      blocked: false,
    },
    '2025-10-20': {
      morning: true,
      afternoon: false,
      evening: true,
      night: false,
      blocked: false,
    },
  };

  console.log('Setting availability for user:', userId);
  console.log('Availability data:', JSON.stringify(availability, null, 2));

  await db.collection(Collections.USERS).doc(userId).update({
    'profile.availability': availability,
    'profile.availabilityUpdatedAt': Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  console.log('✅ Availability set successfully!');

  // Verify
  const userDoc = await db.collection(Collections.USERS).doc(userId).get();
  const userData = userDoc.data();

  console.log('\nVerification:');
  console.log('Has availability:', !!userData?.profile?.availability);
  if (userData?.profile?.availability) {
    console.log('Availability:', JSON.stringify(userData.profile.availability, null, 2));
  }
}

setAvailabilityDirect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
