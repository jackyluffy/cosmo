"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../config/firebase");
async function checkUserLocation() {
    try {
        // Get the most recent user
        const usersSnapshot = await firebase_1.db
            .collection(firebase_1.Collections.USERS)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (usersSnapshot.empty) {
            console.log('No users found');
            return;
        }
        const user = usersSnapshot.docs[0];
        const userData = user.data();
        console.log('\n=== Most Recent User ===');
        console.log('User ID:', user.id);
        console.log('Phone:', userData.phone);
        console.log('Profile:', JSON.stringify(userData.profile, null, 2));
        console.log('\n=== Location Details ===');
        console.log('Location object:', userData.profile?.location);
        console.log('Location type:', userData.profile?.location?.constructor?.name);
        console.log('Has _latitude:', userData.profile?.location?._latitude !== undefined);
        console.log('Has _longitude:', userData.profile?.location?._longitude !== undefined);
        console.log('Has lat:', userData.profile?.location?.lat !== undefined);
        console.log('Has lng:', userData.profile?.location?.lng !== undefined);
        if (userData.profile?.location?._latitude) {
            console.log('\nLocation value (GeoPoint):');
            console.log('  _latitude:', userData.profile.location._latitude);
            console.log('  _longitude:', userData.profile.location._longitude);
        }
        process.exit(0);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}
checkUserLocation();
//# sourceMappingURL=check-user-location.js.map