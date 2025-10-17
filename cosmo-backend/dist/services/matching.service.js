"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingService = void 0;
const firebase_1 = require("../config/firebase");
const constants_1 = require("../config/constants");
const firestore_1 = require("firebase-admin/firestore");
const notification_service_1 = require("./notification.service");
class MatchingService {
    /**
     * Run matching algorithm for an event
     * This should be triggered periodically or before event date
     */
    static async runMatchingForEvent(eventId) {
        try {
            // Get all pending matches for the event
            const matchesSnapshot = await firebase_1.db.collection(firebase_1.Collections.MATCHES)
                .where('eventId', '==', eventId)
                .where('status', '==', 'pending')
                .get();
            if (matchesSnapshot.empty) {
                console.log(`No pending matches for event ${eventId}`);
                return;
            }
            // Get user details for all matches
            const candidates = await Promise.all(matchesSnapshot.docs.map(async (matchDoc) => {
                const matchData = matchDoc.data();
                const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS)
                    .doc(matchData.userId)
                    .get();
                if (!userDoc.exists || !userDoc.data()?.profile) {
                    return null;
                }
                return {
                    userId: matchData.userId,
                    user: { id: userDoc.id, ...userDoc.data() },
                    match: { id: matchDoc.id, ...matchData },
                };
            })).then(results => results.filter(r => r !== null));
            // Group candidates by preferences (age, gender)
            const groups = await this.formOptimalGroups(candidates);
            // Create group documents
            for (const group of groups) {
                await this.createGroup(eventId, group);
            }
            console.log(`Created ${groups.length} groups for event ${eventId}`);
        }
        catch (error) {
            console.error('Matching algorithm error:', error);
            throw error;
        }
    }
    /**
     * Form optimal groups based on compatibility
     */
    static async formOptimalGroups(candidates) {
        const groups = [];
        const used = new Set();
        // Calculate compatibility scores between all candidates
        const scores = await this.calculateAllScores(candidates);
        // Separate candidates by gender
        const maleCandidates = candidates.filter(c => c.user.profile.gender === 'male');
        const femaleCandidates = candidates.filter(c => c.user.profile.gender === 'female');
        // Sort both groups by average compatibility score
        const sortByScore = (a, b) => {
            const aScore = this.getAverageScore(a.userId, scores);
            const bScore = this.getAverageScore(b.userId, scores);
            return bScore - aScore;
        };
        maleCandidates.sort(sortByScore);
        femaleCandidates.sort(sortByScore);
        // Form groups with 1:1 gender ratio
        while (maleCandidates.length > 0 && femaleCandidates.length > 0) {
            // Find unused candidates
            const availableMales = maleCandidates.filter(c => !used.has(c.userId));
            const availableFemales = femaleCandidates.filter(c => !used.has(c.userId));
            if (availableMales.length === 0 || availableFemales.length === 0) {
                break;
            }
            // Start with the highest-scoring available candidate (either gender)
            const topMale = availableMales[0];
            const topFemale = availableFemales[0];
            const maleScore = this.getAverageScore(topMale.userId, scores);
            const femaleScore = this.getAverageScore(topFemale.userId, scores);
            const starter = maleScore >= femaleScore ? topMale : topFemale;
            const starterGender = starter.user.profile.gender;
            const group = [starter];
            used.add(starter.userId);
            // Build group alternating genders, ensuring 1:1 ratio
            const maxPairsPerGroup = Math.floor(constants_1.Constants.MAX_GROUP_SIZE / 2); // 3 pairs for size 6
            const minPairsPerGroup = Math.floor(constants_1.Constants.MIN_GROUP_SIZE / 2); // 2 pairs for size 4
            let maleCount = starterGender === 'male' ? 1 : 0;
            let femaleCount = starterGender === 'female' ? 1 : 0;
            // Try to build up to max group size with 1:1 ratio
            while (maleCount < maxPairsPerGroup || femaleCount < maxPairsPerGroup) {
                // Determine which gender to add next to maintain 1:1 ratio
                const needMale = maleCount < femaleCount || (maleCount === femaleCount && starterGender === 'female');
                const candidatePool = needMale ? availableMales : availableFemales;
                // Find best compatible candidate from the needed gender
                let bestCandidate = null;
                let bestScore = -1;
                for (const candidate of candidatePool) {
                    if (used.has(candidate.userId))
                        continue;
                    // Check compatibility with all group members
                    const isCompatible = this.isGroupCompatible(group, candidate);
                    if (!isCompatible)
                        continue;
                    // Check if all group members have mutual likes with this candidate
                    let allMutualLikes = true;
                    for (const member of group) {
                        const mutualLikes = await this.haveMutualLikes(member.userId, candidate.userId);
                        if (!mutualLikes) {
                            allMutualLikes = false;
                            break;
                        }
                    }
                    if (!allMutualLikes)
                        continue;
                    const groupScore = this.getGroupCompatibility(group, candidate, scores);
                    if (groupScore > bestScore) {
                        bestScore = groupScore;
                        bestCandidate = candidate;
                    }
                }
                if (bestCandidate) {
                    group.push(bestCandidate);
                    used.add(bestCandidate.userId);
                    if (needMale) {
                        maleCount++;
                    }
                    else {
                        femaleCount++;
                    }
                }
                else {
                    // Can't find compatible candidate of needed gender
                    break;
                }
            }
            // Only keep groups that meet minimum size AND have 1:1 ratio
            if (group.length >= constants_1.Constants.MIN_GROUP_SIZE && maleCount === femaleCount) {
                groups.push(group);
            }
            else {
                // Return members to pool if group doesn't meet requirements
                group.forEach(m => used.delete(m.userId));
                // Remove the starter from consideration to avoid infinite loop
                if (starterGender === 'male') {
                    maleCandidates.shift();
                }
                else {
                    femaleCandidates.shift();
                }
            }
        }
        return groups;
    }
    /**
     * Check if two users have mutually liked each other
     */
    static async haveMutualLikes(userId1, userId2) {
        // Check if user1 liked user2
        const user1LikesUser2 = await firebase_1.db
            .collection(firebase_1.Collections.SWIPES)
            .where('userId', '==', userId1)
            .where('targetId', '==', userId2)
            .where('direction', '==', 'like')
            .get();
        if (user1LikesUser2.empty) {
            return false;
        }
        // Check if user2 liked user1
        const user2LikesUser1 = await firebase_1.db
            .collection(firebase_1.Collections.SWIPES)
            .where('userId', '==', userId2)
            .where('targetId', '==', userId1)
            .where('direction', '==', 'like')
            .get();
        return !user2LikesUser1.empty;
    }
    /**
     * Calculate compatibility scores between all candidates
     */
    static async calculateAllScores(candidates) {
        const scores = new Map();
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                // Check for mutual likes first
                const mutualLikes = await this.haveMutualLikes(candidates[i].userId, candidates[j].userId);
                // Only calculate score if they have mutual likes
                const score = mutualLikes
                    ? this.calculateCompatibility(candidates[i], candidates[j])
                    : 0;
                // Store score both ways
                if (!scores.has(candidates[i].userId)) {
                    scores.set(candidates[i].userId, new Map());
                }
                if (!scores.has(candidates[j].userId)) {
                    scores.set(candidates[j].userId, new Map());
                }
                scores.get(candidates[i].userId).set(candidates[j].userId, score);
                scores.get(candidates[j].userId).set(candidates[i].userId, score);
            }
        }
        return scores;
    }
    /**
     * Calculate compatibility between two candidates
     */
    static calculateCompatibility(candidate1, candidate2) {
        const user1 = candidate1.user;
        const user2 = candidate2.user;
        const profile1 = user1.profile;
        const profile2 = user2.profile;
        let score = 0;
        const weights = constants_1.Constants.MATCHING_WEIGHTS;
        // Interest similarity - must have at least 2 common interests
        const commonInterests = profile1.interests.filter(i => profile2.interests.includes(i)).length;
        // Reject if less than 2 common interests
        if (commonInterests < 2) {
            return 0;
        }
        const interestScore = commonInterests / Math.max(profile1.interests.length, profile2.interests.length, 1);
        score += interestScore * weights.INTERESTS;
        // Age compatibility - max 6 years difference
        const ageDiff = Math.abs(profile1.age - profile2.age);
        if (ageDiff > 6) {
            return 0; // Reject if age difference is more than 6 years
        }
        const ageScore = Math.max(0, 1 - ageDiff / 6);
        score += ageScore * weights.AGE_RANGE;
        return Math.min(1, score); // Normalize to 0-1
    }
    /**
     * Calculate personality match
     */
    static calculatePersonalityMatch(traits1, traits2) {
        const dimensions = [
            'extroversion',
            'adventurous',
            'spontaneous',
            'organized',
            'creative',
        ];
        let totalDiff = 0;
        let count = 0;
        for (const dimension of dimensions) {
            const val1 = traits1[dimension];
            const val2 = traits2[dimension];
            if (val1 !== undefined && val2 !== undefined) {
                // Some traits are better when similar, others when complementary
                if (dimension === 'extroversion' || dimension === 'organized') {
                    // Complementary is good
                    totalDiff += Math.abs(val1 - val2) / 100;
                }
                else {
                    // Similar is good
                    totalDiff += (100 - Math.abs(val1 - val2)) / 100;
                }
                count++;
            }
        }
        return count > 0 ? totalDiff / count : 0.5;
    }
    /**
     * Get average compatibility score for a user
     */
    static getAverageScore(userId, scores) {
        const userScores = scores.get(userId);
        if (!userScores || userScores.size === 0)
            return 0;
        let total = 0;
        userScores.forEach(score => total += score);
        return total / userScores.size;
    }
    /**
     * Calculate group compatibility
     */
    static getGroupCompatibility(group, candidate, scores) {
        let total = 0;
        for (const member of group) {
            const score = scores.get(member.userId)?.get(candidate.userId) || 0;
            total += score;
        }
        return total / group.length;
    }
    /**
     * Check if candidate is compatible with group
     */
    static isGroupCompatible(group, candidate) {
        // Check age range
        const candidateAge = candidate.user.profile.age;
        const groupAges = group.map(m => m.user.profile.age);
        const minAge = Math.min(...groupAges);
        const maxAge = Math.max(...groupAges);
        // Allow max 10 year age range in group
        if (candidateAge < minAge - 5 || candidateAge > maxAge + 5) {
            return false;
        }
        // Check gender preferences
        const candidateGender = candidate.user.profile.gender;
        for (const member of group) {
            const prefs = member.match.preferences?.genderPreference || [];
            if (prefs.length > 0 && !prefs.includes(candidateGender)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Create a group in database
     */
    static async createGroup(eventId, members) {
        // Calculate group score
        const groupScore = members.reduce((sum, m) => sum + (m.score || 0.5), 0) / members.length;
        // Create group members array
        const groupMembers = members.map((m, index) => ({
            userId: m.userId,
            name: m.user.profile.name,
            photo: m.user.profile.photos[0] || '',
            role: index === 0 ? 'leader' : 'member',
            joinedAt: firestore_1.Timestamp.now(),
            status: 'accepted',
        }));
        // Create group
        const groupData = {
            name: `Group ${Math.random().toString(36).substr(2, 9)}`,
            members: groupMembers,
            eventId,
            status: 'forming',
            matchScore: groupScore,
            createdAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        };
        const groupDoc = await firebase_1.db.collection(firebase_1.Collections.GROUPS).add(groupData);
        // Update matches with group ID
        await Promise.all(members.map(m => firebase_1.db.collection(firebase_1.Collections.MATCHES)
            .doc(m.match.id)
            .update({
            groupId: groupDoc.id,
            status: 'matched',
            score: groupScore,
            updatedAt: firestore_1.Timestamp.now(),
        })));
        // Send notifications to members
        const memberNotifications = members.map((member) => notification_service_1.NotificationService.sendGroupFormed(member.userId, {
            title: 'You have a new match group!',
            body: 'A new group has been formed. Head to Events to see who you matched with.',
            data: {
                eventId,
                groupId: groupDoc.id,
            },
        }));
        await Promise.all(memberNotifications);
    }
    /**
     * Calculate distance between two points
     */
    static calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const lat1Rad = point1.latitude * Math.PI / 180;
        const lat2Rad = point2.latitude * Math.PI / 180;
        const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
        const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
exports.MatchingService = MatchingService;
//# sourceMappingURL=matching.service.js.map