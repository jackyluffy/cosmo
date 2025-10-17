"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwipeController = void 0;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const pair_matching_service_1 = require("../services/pair-matching.service");
class SwipeController {
    /**
     * Get swipe deck (profiles to swipe on)
     * GET /swipe/deck
     */
    static async getDeck(req, res) {
        try {
            const userId = req.userId;
            const user = req.user;
            // Handle GeoPoint from Firestore (has _latitude and _longitude)
            const userLocation = user.profile?.location;
            const hasLocation = userLocation &&
                (userLocation.lat !== undefined || userLocation._latitude !== undefined);
            console.log('[getDeck] User profile:', {
                hasProfile: !!user.profile,
                hasLocation,
                location: userLocation,
                locationType: userLocation?.constructor?.name,
            });
            // Get user's profile to filter by preferences
            // In dev mode, skip location requirement
            const isDev = process.env.NODE_ENV === 'development';
            if (!user.profile || (!isDev && !hasLocation)) {
                console.log('[getDeck] Missing profile or location');
                return res.status(400).json({
                    success: false,
                    error: 'Please complete your profile and enable location',
                });
            }
            if (isDev && !hasLocation) {
                console.log('[getDeck] DEV MODE: Allowing access without location');
            }
            // Get users the current user has already swiped on
            const swipesSnapshot = await firebase_1.db
                .collection(firebase_1.Collections.SWIPES)
                .where('userId', '==', userId)
                .get();
            const swipedUserIds = swipesSnapshot.docs.map(doc => doc.data().targetId);
            // Get potential matches
            // For now, get all users except self and already swiped
            const usersSnapshot = await firebase_1.db
                .collection(firebase_1.Collections.USERS)
                .where('isActive', '==', true)
                .limit(50)
                .get();
            console.log(`[getDeck] Found ${usersSnapshot.docs.length} users with isActive=true`);
            const potentialMatches = usersSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => u.id !== userId && // Not self
                !swipedUserIds.includes(u.id) && // Not already swiped
                u.profile && // Has profile
                u.profile.photos && u.profile.photos.length > 0 // Has photos
            )
                .map(u => ({
                id: u.id,
                profile: {
                    name: u.profile.name,
                    age: u.profile.age,
                    gender: u.profile.gender,
                    bio: u.profile.bio,
                    photos: u.profile.photos,
                    interests: u.profile.interests,
                    location: u.profile.location,
                },
            }))
                .slice(0, 20); // Return max 20 profiles
            console.log(`[getDeck] Returning ${potentialMatches.length} potential matches`);
            console.log(`[getDeck] First profile:`, potentialMatches[0] ? {
                id: potentialMatches[0].id,
                hasProfile: !!potentialMatches[0].profile,
                profileName: potentialMatches[0].profile?.name,
                photosCount: potentialMatches[0].profile?.photos?.length
            } : 'No profiles');
            return res.status(200).json({
                success: true,
                data: {
                    profiles: potentialMatches,
                    remaining: potentialMatches.length,
                },
            });
        }
        catch (error) {
            console.error('Get deck error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get swipe deck',
            });
        }
    }
    /**
     * Record a swipe (like or skip)
     * POST /swipe/:targetId
     */
    static async swipe(req, res) {
        try {
            const userId = req.userId;
            const { targetId } = req.params;
            const { direction } = req.body; // 'like' or 'skip'
            if (userId === targetId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot swipe on yourself',
                });
            }
            // Check if target user exists
            const targetDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(targetId).get();
            if (!targetDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found',
                });
            }
            // Check if already swiped
            const existingSwipe = await firebase_1.db
                .collection(firebase_1.Collections.SWIPES)
                .where('userId', '==', userId)
                .where('targetId', '==', targetId)
                .get();
            if (!existingSwipe.empty) {
                return res.status(400).json({
                    success: false,
                    error: 'Already swiped on this user',
                });
            }
            // Record the swipe
            await firebase_1.db.collection(firebase_1.Collections.SWIPES).add({
                userId,
                targetId,
                direction,
                createdAt: firestore_1.Timestamp.now(),
            });
            // Check for match if it's a like
            let isMatch = false;
            let pairMatch = null;
            if (direction === 'like') {
                // Check if target user has also liked current user
                const reverseSwipe = await firebase_1.db
                    .collection(firebase_1.Collections.SWIPES)
                    .where('userId', '==', targetId)
                    .where('targetId', '==', userId)
                    .where('direction', '==', 'like')
                    .get();
                if (!reverseSwipe.empty) {
                    // It's a match!
                    isMatch = true;
                    const currentUser = req.user;
                    const targetData = targetDoc.data();
                    pairMatch = await pair_matching_service_1.PairMatchingService.upsertPairMatch({ id: currentUser.id, profile: currentUser.profile }, { id: targetDoc.id, profile: targetData.profile });
                }
            }
            return res.status(200).json({
                success: true,
                data: {
                    match: isMatch,
                    targetId,
                    direction,
                    pairMatch,
                },
                message: isMatch ? "It's a match!" : 'Swipe recorded',
            });
        }
        catch (error) {
            console.error('Swipe error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to record swipe',
            });
        }
    }
    /**
     * Get all matches for current user
     * GET /swipe/matches
     */
    static async getMatches(req, res) {
        try {
            const userId = req.userId;
            // Get all matches where user is involved
            const pairMatches = await pair_matching_service_1.PairMatchingService.getPairMatchesForUser(userId);
            const matches = await Promise.all(pairMatches.map(async (pairMatch) => {
                const otherUserId = pairMatch.userIds.find((id) => id !== userId);
                if (!otherUserId) {
                    return null;
                }
                const otherUserDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(otherUserId).get();
                if (!otherUserDoc.exists) {
                    return null;
                }
                const otherUser = otherUserDoc.data();
                return {
                    id: pairMatch.id,
                    user: {
                        id: otherUserId,
                        profile: {
                            name: otherUser.profile?.name,
                            age: otherUser.profile?.age,
                            gender: otherUser.profile?.gender,
                            bio: otherUser.profile?.bio,
                            photos: otherUser.profile?.photos || [],
                            interests: otherUser.profile?.interests || [],
                        },
                    },
                    createdAt: pairMatch.createdAt,
                    lastMessageAt: pairMatch.lastActivityAt,
                    sharedEventTypes: pairMatch.sharedEventTypes || [],
                    hasSufficientAvailability: pairMatch.hasSufficientAvailability,
                    suggestedEventType: pairMatch.suggestedEventType || null,
                    availabilityOverlapCount: pairMatch.availabilityOverlapCount || 0,
                    queueStatus: pairMatch.queueStatus,
                    queueEventType: pairMatch.queueEventType ?? null,
                };
            })).then(results => results.filter((result) => result !== null));
            return res.status(200).json({
                success: true,
                data: { matches },
            });
        }
        catch (error) {
            console.error('Get matches error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get matches',
            });
        }
    }
    /**
     * Unmatch with a user
     * DELETE /swipe/matches/:matchId
     */
    static async unmatch(req, res) {
        try {
            const userId = req.userId;
            const { matchId } = req.params;
            // Get match
            const matchDoc = await firebase_1.db.collection(firebase_1.Collections.PAIR_MATCHES).doc(matchId).get();
            if (!matchDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found',
                });
            }
            const matchData = matchDoc.data();
            // Verify user is part of this match
            if (!matchData?.userIds?.includes(userId)) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized to unmatch',
                });
            }
            const now = firestore_1.Timestamp.now();
            // Update match status to unmatched
            await matchDoc.ref.update({
                status: 'inactive',
                queueStatus: 'sidelined',
                unmatchedBy: userId,
                unmatchedAt: now,
                updatedAt: now,
                lastActivityAt: now,
            });
            return res.status(200).json({
                success: true,
                message: 'Unmatched successfully',
            });
        }
        catch (error) {
            console.error('Unmatch error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to unmatch',
            });
        }
    }
}
exports.SwipeController = SwipeController;
//# sourceMappingURL=swipe.controller.js.map