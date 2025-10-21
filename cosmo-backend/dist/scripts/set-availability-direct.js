"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
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
    await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
        'profile.availability': availability,
        'profile.availabilityUpdatedAt': firestore_1.Timestamp.now(),
        updatedAt: firestore_1.Timestamp.now(),
    });
    console.log('✅ Availability set successfully!');
    // Verify
    const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
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
//# sourceMappingURL=set-availability-direct.js.map