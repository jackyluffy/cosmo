import { db, Collections } from '../config/firebase';

async function checkUserActive() {
  const userId = 'bHzCB8AYCoHhj5N56aAG';

  const userDoc = await db.collection(Collections.USERS).doc(userId).get();

  if (!userDoc.exists) {
    console.log('❌ User does not exist');
    return;
  }

  const userData = userDoc.data();
  console.log('User ID:', userId);
  console.log('isActive:', userData?.isActive);
  console.log('User exists:', userDoc.exists);

  if (userData?.isActive === undefined) {
    console.log('\n⚠️  isActive field is missing! Setting it to true...');
    await userDoc.ref.update({ isActive: true });
    console.log('✅ Updated isActive to true');
  }
}

checkUserActive()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
