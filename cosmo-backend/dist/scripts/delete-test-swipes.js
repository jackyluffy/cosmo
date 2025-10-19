"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
async function deleteTestSwipes() {
    try {
        console.log('🗑️  Deleting swipes from test users to bHzCB8AYCoHhj5N56aAG...\n');
        const targetUserId = 'bHzCB8AYCoHhj5N56aAG';
        // Get all swipes to the target user where userId starts with "test"
        const allSwipesSnapshot = await firebase_1.db.collection(firebase_1.Collections.SWIPES).get();
        const swipesToDelete = [];
        allSwipesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const targetField = data.targetUserId || data.targetId;
            if (data.userId?.startsWith('test') && targetField === targetUserId) {
                swipesToDelete.push(doc.id);
            }
        });
        console.log(`Found ${swipesToDelete.length} swipes to delete\n`);
        if (swipesToDelete.length === 0) {
            console.log('✓ No swipes to delete');
            return;
        }
        // Delete in batches
        const batchSize = 500;
        for (let i = 0; i < swipesToDelete.length; i += batchSize) {
            const batch = firebase_1.db.batch();
            const batchIds = swipesToDelete.slice(i, i + batchSize);
            batchIds.forEach(id => {
                const swipeRef = firebase_1.db.collection(firebase_1.Collections.SWIPES).doc(id);
                batch.delete(swipeRef);
            });
            await batch.commit();
            console.log(`✓ Deleted batch ${Math.floor(i / batchSize) + 1} (${batchIds.length} swipes)`);
        }
        console.log(`\n✅ Successfully deleted ${swipesToDelete.length} swipes`);
    }
    catch (error) {
        console.error('❌ Error deleting swipes:', error);
        throw error;
    }
}
deleteTestSwipes()
    .then(() => {
    console.log('\n✓ Script completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=delete-test-swipes.js.map