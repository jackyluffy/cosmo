"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const storage_1 = require("@google-cloud/storage");
const firebase_1 = require("../config/firebase");
const storage = new storage_1.Storage();
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'cosmo-app-photos';
/**
 * Makes all existing photos in the bucket publicly readable and updates URLs in Firestore
 */
async function makeExistingPhotosPublic() {
    try {
        console.log('Starting to make existing photos public...');
        const bucket = storage.bucket(bucketName);
        // Get all users from Firestore
        const usersSnapshot = await firebase_1.db.collection(firebase_1.Collections.USERS).get();
        let updatedCount = 0;
        let errorCount = 0;
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            const photos = userData?.profile?.photos || [];
            if (photos.length === 0)
                continue;
            console.log(`\nProcessing user ${userId} with ${photos.length} photos...`);
            const updatedPhotos = [];
            for (const photoUrl of photos) {
                try {
                    // Extract filename from URL
                    const urlWithoutQuery = photoUrl.split('?')[0]; // Remove query params
                    const fileName = urlWithoutQuery.includes(bucketName)
                        ? urlWithoutQuery.split(`${bucketName}/`)[1]
                        : null;
                    if (!fileName) {
                        console.warn(`  ⚠️  Could not extract filename from: ${photoUrl.substring(0, 100)}`);
                        updatedPhotos.push(photoUrl); // Keep original
                        continue;
                    }
                    // Make file public
                    const file = bucket.file(fileName);
                    await file.makePublic();
                    // Generate new public URL
                    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                    updatedPhotos.push(publicUrl);
                    console.log(`  ✓ Made public: ${fileName}`);
                }
                catch (error) {
                    console.error(`  ✗ Error processing photo: ${error.message}`);
                    updatedPhotos.push(photoUrl); // Keep original on error
                    errorCount++;
                }
            }
            // Update user's photos in Firestore if any changed
            if (updatedPhotos.some((url, i) => url !== photos[i])) {
                await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                    'profile.photos': updatedPhotos,
                });
                console.log(`  ✓ Updated ${updatedPhotos.length} photo URLs for user ${userId}`);
                updatedCount++;
            }
        }
        console.log('\n======================');
        console.log('Migration complete!');
        console.log(`Users updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('======================\n');
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}
// Run the script
makeExistingPhotosPublic()
    .then(() => {
    console.log('Script finished successfully');
    process.exit(0);
})
    .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=make-photos-public.js.map