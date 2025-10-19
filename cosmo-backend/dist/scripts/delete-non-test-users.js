"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
async function deleteNonTestUsers() {
    try {
        console.log('🔍 Fetching all users...');
        const usersSnapshot = await firebase_1.db.collection(firebase_1.Collections.USERS).get();
        console.log(`Found ${usersSnapshot.size} total users`);
        const usersToDelete = [];
        const testUsers = [];
        usersSnapshot.docs.forEach(doc => {
            const userId = doc.id;
            if (!userId.startsWith('test')) {
                usersToDelete.push(userId);
            }
            else {
                testUsers.push(userId);
            }
        });
        console.log(`\n📊 Summary:`);
        console.log(`  - Test users (keeping): ${testUsers.length}`);
        console.log(`  - Non-test users (deleting): ${usersToDelete.length}`);
        if (usersToDelete.length === 0) {
            console.log('\n✓ No users to delete');
            return;
        }
        console.log(`\n🗑️  Deleting ${usersToDelete.length} non-test users...`);
        // Delete in batches of 500 (Firestore limit)
        const batchSize = 500;
        for (let i = 0; i < usersToDelete.length; i += batchSize) {
            const batch = firebase_1.db.batch();
            const batchUsers = usersToDelete.slice(i, i + batchSize);
            batchUsers.forEach(userId => {
                const userRef = firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId);
                batch.delete(userRef);
            });
            await batch.commit();
            console.log(`  ✓ Deleted batch ${Math.floor(i / batchSize) + 1} (${batchUsers.length} users)`);
        }
        console.log(`\n✅ Successfully deleted ${usersToDelete.length} non-test users`);
        console.log(`\nRemaining test users:`);
        testUsers.forEach((id, index) => {
            console.log(`  ${index + 1}. ${id}`);
        });
    }
    catch (error) {
        console.error('❌ Error deleting users:', error);
        throw error;
    }
}
// Run the script
deleteNonTestUsers()
    .then(() => {
    console.log('\n✓ Script completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=delete-non-test-users.js.map