import { db } from '../config/firebase';

// Target location: Placentia, CA
const CENTER_LAT = 33.8722;
const CENTER_LNG = -117.8703;
const RADIUS_MILES = 10;

// Generate random location within specified radius
function generateRandomLocation(centerLat: number, centerLng: number, radiusMiles: number) {
  const radiusInDegrees = radiusMiles / 69; // 1 degree ≈ 69 miles
  const randomAngle = Math.random() * 2 * Math.PI;
  const randomRadius = Math.random() * radiusInDegrees;

  const lat = centerLat + randomRadius * Math.cos(randomAngle);
  const lng = centerLng + randomRadius * Math.sin(randomAngle);

  return { lat, lng };
}

async function updateTestUserLocations() {
  try {
    console.log('Fetching all test users...');

    // Query all users with userId starting with "test-user-"
    const usersSnapshot = await db.collection('users')
      .where('userId', '>=', 'test-user-')
      .where('userId', '<', 'test-user-~')
      .get();

    if (usersSnapshot.empty) {
      console.log('No test users found.');
      return;
    }

    console.log(`Found ${usersSnapshot.size} test users to update.`);

    const batch = db.batch();
    let updateCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = userData.userId;

      // Generate new random location within 10 miles
      const newLocation = generateRandomLocation(CENTER_LAT, CENTER_LNG, RADIUS_MILES);

      // Update the user document
      batch.update(doc.ref, {
        'profile.location': newLocation,
        updatedAt: new Date(),
      });

      updateCount++;
      console.log(`${updateCount}. Updating ${userId} to location: ${newLocation.lat.toFixed(4)}, ${newLocation.lng.toFixed(4)}`);
    }

    // Commit all updates
    await batch.commit();

    console.log(`\n✅ Successfully updated ${updateCount} test users' locations`);
    console.log(`All users are now within ${RADIUS_MILES} miles of ${CENTER_LAT}, ${CENTER_LNG}`);

  } catch (error) {
    console.error('Error updating test user locations:', error);
    throw error;
  }
}

// Run the script
updateTestUserLocations()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
