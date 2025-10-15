export declare class MatchingService {
    /**
     * Run matching algorithm for an event
     * This should be triggered periodically or before event date
     */
    static runMatchingForEvent(eventId: string): Promise<void>;
    /**
     * Form optimal groups based on compatibility
     */
    private static formOptimalGroups;
    /**
     * Calculate compatibility scores between all candidates
     */
    private static calculateAllScores;
    /**
     * Calculate compatibility between two candidates
     */
    private static calculateCompatibility;
    /**
     * Calculate personality match
     */
    private static calculatePersonalityMatch;
    /**
     * Get average compatibility score for a user
     */
    private static getAverageScore;
    /**
     * Calculate group compatibility
     */
    private static getGroupCompatibility;
    /**
     * Check if candidate is compatible with group
     */
    private static isGroupCompatible;
    /**
     * Create a group in database
     */
    private static createGroup;
    /**
     * Calculate distance between two points
     */
    private static calculateDistance;
}
//# sourceMappingURL=matching.service.d.ts.map