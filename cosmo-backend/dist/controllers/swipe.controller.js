"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwipeController = void 0;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const pair_matching_service_1 = require("../services/pair-matching.service");
const notification_service_1 = require("../services/notification.service");
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
            const normalizedUserInterests = (user.profile?.interests || [])
                .filter((interest) => typeof interest === 'string')
                .map((interest) => interest.trim().toLowerCase())
                .filter((interest) => interest.length > 0);
            if (normalizedUserInterests.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Please add interests to your profile to see potential matches',
                });
            }
            const userInterestSet = new Set(normalizedUserInterests);
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
                .filter((u) => {
                const rawInterests = Array.isArray(u.profile?.interests) ? u.profile?.interests : [];
                const candidateInterests = rawInterests
                    .filter((interest) => typeof interest === 'string')
                    .map((interest) => interest.trim().toLowerCase())
                    .filter((interest) => interest.length > 0);
                const hasSharedInterest = candidateInterests.some((interest) => userInterestSet.has(interest));
                return (u.id !== userId && // Not self
                    !swipedUserIds.includes(u.id) && // Not already swiped
                    u.profile && // Has profile
                    u.profile.photos && u.profile.photos.length > 0 && // Has photos
                    hasSharedInterest);
            })
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
            let missedPotential = false;
            let missedLikerName;
            // Record the swipe
            await firebase_1.db.collection(firebase_1.Collections.SWIPES).add({
                userId,
                targetId,
                direction,
                createdAt: firestore_1.Timestamp.now(),
            });
            if (direction === 'like') {
                try {
                    const likerName = req.user?.profile?.name;
                    await notification_service_1.NotificationService.sendIncomingLike(targetId, likerName);
                }
                catch (notifyError) {
                    console.error('Failed to send incoming like notification:', notifyError);
                }
            }
            if (direction === 'skip') {
                const incomingLike = await firebase_1.db
                    .collection(firebase_1.Collections.SWIPES)
                    .where('userId', '==', targetId)
                    .where('targetId', '==', userId)
                    .where('direction', '==', 'like')
                    .limit(1)
                    .get();
                if (!incomingLike.empty) {
                    const likeDoc = incomingLike.docs[0];
                    await likeDoc.ref.set({
                        dismissedByTarget: true,
                        dismissedAt: firestore_1.Timestamp.now(),
                    }, { merge: true });
                    missedPotential = true;
                    const likerData = targetDoc.data();
                    missedLikerName = likerData?.profile?.name;
                }
            }
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
                    try {
                        const reverseDoc = reverseSwipe.docs[0];
                        await reverseDoc.ref.set({
                            matched: true,
                            matchedAt: firestore_1.Timestamp.now(),
                        }, { merge: true });
                    }
                    catch (matchUpdateError) {
                        console.error('Failed to flag reverse swipe as matched:', matchUpdateError);
                    }
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
                    missedPotential,
                    missedLikerName,
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
     * Get summary information about likes received by the current user
     * GET /swipe/likes/summary
     */
    static async getLikeSummary(req, res) {
        try {
            const userId = req.userId;
            const likesSnapshot = await firebase_1.db
                .collection(firebase_1.Collections.SWIPES)
                .where('targetId', '==', userId)
                .where('direction', '==', 'like')
                .get();
            const likerIds = new Set();
            let likesLast24h = 0;
            const nowMs = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;
            likesSnapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data?.dismissedByTarget || data?.matched) {
                    return;
                }
                if (data?.userId) {
                    likerIds.add(String(data.userId));
                }
                const createdAt = data?.createdAt;
                if (createdAt?.toDate) {
                    const diffMs = nowMs - createdAt.toDate().getTime();
                    if (diffMs <= oneDayMs) {
                        likesLast24h += 1;
                    }
                }
            });
            return res.status(200).json({
                success: true,
                data: {
                    totalLikes: likerIds.size,
                    likesLast24h,
                },
            });
        }
        catch (error) {
            console.error('getLikeSummary error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to load like summary',
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