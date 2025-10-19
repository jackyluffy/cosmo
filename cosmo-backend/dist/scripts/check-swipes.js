"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
async function checkSwipes() {
    try {
        // Get a few swipe documents to see their structure
        const swipesSnapshot = await firebase_1.db.collection(firebase_1.Collections.SWIPES).limit(5).get();
        console.log(`Found ${swipesSnapshot.size} swipe documents\n`);
        console.log('Swipe document structure:\n');
        swipesSnapshot.docs.forEach((doc, index) => {
            console.log(`Swipe ${index + 1} (ID: ${doc.id}):`);
            console.log(JSON.stringify(doc.data(), null, 2));
            console.log('');
        });
        // Check for Jason's swipes
        const jasonId = 'bHzCB8AYCoHhj5N56aAG';
        const jasonSwipes = await firebase_1.db.collection(firebase_1.Collections.SWIPES)
            .where('userId', '==', jasonId)
            .get();
        console.log(`\n\nJason's swipes (userId = ${jasonId}): ${jasonSwipes.size}\n`);
        jasonSwipes.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`Jason swipe ${index + 1}:`);
            console.log(`  Direction: ${data.direction}`);
            console.log(`  Target: ${data.targetUserId || data.targetId}`);
            console.log(`  Created: ${data.createdAt?.toDate()}`);
            console.log('');
        });
        // Check for swipes TO Jason
        const swipesToJason = await firebase_1.db.collection(firebase_1.Collections.SWIPES)
            .where('targetUserId', '==', jasonId)
            .get();
        console.log(`\nSwipes TO Jason (targetUserId = ${jasonId}): ${swipesToJason.size}\n`);
        // Check pair_matches
        const pairMatches = await firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES).get();
        console.log(`\nTotal pair_matches: ${pairMatches.size}\n`);
        if (pairMatches.size > 0) {
            pairMatches.docs.slice(0, 3).forEach((doc, index) => {
                console.log(`Pair Match ${index + 1} (ID: ${doc.id}):`);
                console.log(JSON.stringify(doc.data(), null, 2));
                console.log('');
            });
        }
    }
    catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
checkSwipes()
    .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=check-swipes.js.map