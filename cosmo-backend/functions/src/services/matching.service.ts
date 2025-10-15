import { db, Collections } from '../config/firebase';
import { User, Match, Group, GroupMember, PersonalityTraits } from '../types';
import { Constants } from '../config/constants';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';

interface MatchCandidate {
  userId: string;
  user: User;
  match: Match;
  score?: number;
}

export class MatchingService {
  /**
   * Run matching algorithm for an event
   * This should be triggered periodically or before event date
   */
  static async runMatchingForEvent(eventId: string): Promise<void> {
    try {
      // Get all pending matches for the event
      const matchesSnapshot = await db.collection(Collections.MATCHES)
        .where('eventId', '==', eventId)
        .where('status', '==', 'pending')
        .get();

      if (matchesSnapshot.empty) {
        console.log(`No pending matches for event ${eventId}`);
        return;
      }

      // Get user details for all matches
      const candidates: MatchCandidate[] = await Promise.all(
        matchesSnapshot.docs.map(async (matchDoc) => {
          const matchData = matchDoc.data() as Match;
          const userDoc = await db.collection(Collections.USERS)
            .doc(matchData.userId)
            .get();

          if (!userDoc.exists || !userDoc.data()?.profile) {
            return null;
          }

          return {
            userId: matchData.userId,
            user: { id: userDoc.id, ...userDoc.data() } as User,
            match: { id: matchDoc.id, ...matchData },
          };
        })
      ).then(results => results.filter(r => r !== null) as MatchCandidate[]);

      // Group candidates by preferences (age, gender)
      const groups = await this.formOptimalGroups(candidates);

      // Create group documents
      for (const group of groups) {
        await this.createGroup(eventId, group);
      }

      console.log(`Created ${groups.length} groups for event ${eventId}`);
    } catch (error) {
      console.error('Matching algorithm error:', error);
      throw error;
    }
  }

  /**
   * Form optimal groups based on compatibility
   */
  private static async formOptimalGroups(
    candidates: MatchCandidate[]
  ): Promise<MatchCandidate[][]> {
    const groups: MatchCandidate[][] = [];
    const used = new Set<string>();

    // Calculate compatibility scores between all candidates
    const scores = this.calculateAllScores(candidates);

    // Sort candidates by average compatibility score
    candidates.sort((a, b) => {
      const aScore = this.getAverageScore(a.userId, scores);
      const bScore = this.getAverageScore(b.userId, scores);
      return bScore - aScore;
    });

    // Form groups
    for (const candidate of candidates) {
      if (used.has(candidate.userId)) continue;

      const group = [candidate];
      used.add(candidate.userId);

      // Find best matching candidates for this group
      const potentialMembers = candidates
        .filter(c => !used.has(c.userId))
        .map(c => ({
          candidate: c,
          score: this.getGroupCompatibility(group, c, scores),
        }))
        .sort((a, b) => b.score - a.score);

      // Add members to group
      for (const { candidate: member } of potentialMembers) {
        if (group.length >= Constants.MAX_GROUP_SIZE) break;

        // Check if member is compatible with all group members
        const isCompatible = this.isGroupCompatible(group, member);
        if (isCompatible) {
          group.push(member);
          used.add(member.userId);
        }
      }

      // Only keep groups that meet minimum size
      if (group.length >= Constants.MIN_GROUP_SIZE) {
        groups.push(group);
      } else {
        // Return members to pool
        group.forEach(m => used.delete(m.userId));
      }
    }

    return groups;
  }

  /**
   * Calculate compatibility scores between all candidates
   */
  private static calculateAllScores(
    candidates: MatchCandidate[]
  ): Map<string, Map<string, number>> {
    const scores = new Map<string, Map<string, number>>();

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const score = this.calculateCompatibility(
          candidates[i],
          candidates[j]
        );

        // Store score both ways
        if (!scores.has(candidates[i].userId)) {
          scores.set(candidates[i].userId, new Map());
        }
        if (!scores.has(candidates[j].userId)) {
          scores.set(candidates[j].userId, new Map());
        }

        scores.get(candidates[i].userId)!.set(candidates[j].userId, score);
        scores.get(candidates[j].userId)!.set(candidates[i].userId, score);
      }
    }

    return scores;
  }

  /**
   * Calculate compatibility between two candidates
   */
  private static calculateCompatibility(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): number {
    const user1 = candidate1.user;
    const user2 = candidate2.user;
    const profile1 = user1.profile!;
    const profile2 = user2.profile!;

    let score = 0;
    const weights = Constants.MATCHING_WEIGHTS;

    // Interest similarity
    const commonInterests = profile1.interests.filter(i =>
      profile2.interests.includes(i)
    ).length;
    const interestScore = commonInterests / Math.max(
      profile1.interests.length,
      profile2.interests.length,
      1
    );
    score += interestScore * weights.INTERESTS;

    // Age compatibility
    const ageDiff = Math.abs(profile1.age - profile2.age);
    const ageScore = Math.max(0, 1 - ageDiff / 20); // Max 20 years difference
    score += ageScore * weights.AGE_RANGE;

    // Location proximity
    if (profile1.location && profile2.location) {
      const distance = this.calculateDistance(profile1.location, profile2.location);
      const locationScore = Math.max(0, 1 - distance / 50); // Max 50km
      score += locationScore * weights.LOCATION;
    }

    // Personality traits compatibility
    if (profile1.traits && profile2.traits) {
      const personalityScore = this.calculatePersonalityMatch(
        profile1.traits,
        profile2.traits
      );
      score += personalityScore * weights.PERSONALITY;
    }

    // Activity level (based on events joined, messages, etc.)
    // TODO: Implement activity level calculation
    score += 0.5 * weights.ACTIVITY_LEVEL;

    return Math.min(1, score); // Normalize to 0-1
  }

  /**
   * Calculate personality match
   */
  private static calculatePersonalityMatch(
    traits1: PersonalityTraits,
    traits2: PersonalityTraits
  ): number {
    const dimensions = [
      'extroversion',
      'adventurous',
      'spontaneous',
      'organized',
      'creative',
    ] as const;

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
        } else {
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
  private static getAverageScore(
    userId: string,
    scores: Map<string, Map<string, number>>
  ): number {
    const userScores = scores.get(userId);
    if (!userScores || userScores.size === 0) return 0;

    let total = 0;
    userScores.forEach(score => total += score);
    return total / userScores.size;
  }

  /**
   * Calculate group compatibility
   */
  private static getGroupCompatibility(
    group: MatchCandidate[],
    candidate: MatchCandidate,
    scores: Map<string, Map<string, number>>
  ): number {
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
  private static isGroupCompatible(
    group: MatchCandidate[],
    candidate: MatchCandidate
  ): boolean {
    // Check age range
    const candidateAge = candidate.user.profile!.age;
    const groupAges = group.map(m => m.user.profile!.age);
    const minAge = Math.min(...groupAges);
    const maxAge = Math.max(...groupAges);

    // Allow max 10 year age range in group
    if (candidateAge < minAge - 5 || candidateAge > maxAge + 5) {
      return false;
    }

    // Check gender preferences
    const candidateGender = candidate.user.profile!.gender;
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
  private static async createGroup(
    eventId: string,
    members: MatchCandidate[]
  ): Promise<void> {
    // Calculate group score
    const groupScore = members.reduce((sum, m) => sum + (m.score || 0.5), 0) / members.length;

    // Create group members array
    const groupMembers: GroupMember[] = members.map((m, index) => ({
      userId: m.userId,
      name: m.user.profile!.name,
      photo: m.user.profile!.photos[0] || '',
      role: index === 0 ? 'leader' : 'member',
      joinedAt: Timestamp.now(),
      status: 'accepted',
    }));

    // Create group
    const groupData: Partial<Group> = {
      name: `Group ${Math.random().toString(36).substr(2, 9)}`,
      members: groupMembers,
      eventId,
      status: 'forming',
      matchScore: groupScore,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const groupDoc = await db.collection(Collections.GROUPS).add(groupData);

    // Update matches with group ID
    await Promise.all(
      members.map(m =>
        db.collection(Collections.MATCHES)
          .doc(m.match.id)
          .update({
            groupId: groupDoc.id,
            status: 'matched',
            score: groupScore,
            updatedAt: Timestamp.now(),
          })
      )
    );

    // Send notifications to members
    // TODO: Implement notification service
  }

  /**
   * Calculate distance between two points
   */
  private static calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
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