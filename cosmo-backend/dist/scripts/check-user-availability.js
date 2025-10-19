"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
async function checkUserAvailability() {
    try {
        const userId = 'bHzCB8AYCoHhj5N56aAG'; // Jason's ID
        console.log(`🔍 Checking user: ${userId}\n`);
        const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
        if (!userDoc.exists) {
            console.log('❌ User not found');
            return;
        }
        const userData = userDoc.data();
        console.log('📊 User Data:\n');
        console.log('Profile exists:', !!userData?.profile);
        console.log('Availability exists:', !!userData?.profile?.availability);
        console.log('\nFull profile object:');
        console.log(JSON.stringify(userData?.profile, null, 2));
        if (userData?.profile?.availability) {
            console.log('\n✅ Availability data:');
            console.log(JSON.stringify(userData.profile.availability, null, 2));
        }
        else {
            console.log('\n⚠️  No availability data found in profile');
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}
checkUserAvailability()
    .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
})
    .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=check-user-availability.js.map