import { db, Collections } from '../config/firebase';

async function checkUsers() {
  try {
    console.log('Fetching all users from Firestore...');
    const usersSnapshot = await db.collection(Collections.USERS).get();

    console.log(`\nTotal users: ${usersSnapshot.size}`);

    if (usersSnapshot.empty) {
      console.log('No users found in the database.');
    } else {
      console.log('\nUsers:');
      usersSnapshot.docs.forEach((doc) => {
        const user = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Email: ${user.email || 'N/A'}`);
        console.log(`  Phone: ${user.phone || 'N/A'}`);
        console.log(`  Provider: ${user.authProvider || 'N/A'}`);
        console.log(`  Created: ${user.createdAt?.toDate() || 'N/A'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error checking users:', error);
  }
  process.exit(0);
}

checkUsers();
