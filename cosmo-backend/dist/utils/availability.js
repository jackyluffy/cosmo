"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAvailabilityMap = normalizeAvailabilityMap;
exports.computeAvailabilityOverlap = computeAvailabilityOverlap;
const SEGMENTS = ['morning', 'afternoon', 'evening', 'night'];
/**
 * Normalize availability map by coercing booleans, removing past dates, and
 * standardizing date keys to ISO (YYYY-MM-DD).
 */
function normalizeAvailabilityMap(availability) {
    if (!availability) {
        return {};
    }
    const normalized = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    Object.entries(availability).forEach(([rawDate, entry]) => {
        if (!entry) {
            return;
        }
        const parsedDate = new Date(rawDate);
        if (Number.isNaN(parsedDate.getTime())) {
            return;
        }
        parsedDate.setHours(0, 0, 0, 0);
        if (parsedDate < today) {
            return;
        }
        const dateKey = parsedDate.toISOString().split('T')[0];
        normalized[dateKey] = {
            morning: Boolean(entry.morning),
            afternoon: Boolean(entry.afternoon),
            evening: Boolean(entry.evening),
            night: Boolean(entry.night),
            blocked: Boolean(entry.blocked),
        };
    });
    return normalized;
}
function computeAvailabilityOverlap(availabilityA, availabilityB) {
    if (!availabilityA || !availabilityB) {
        return { segments: [], totalSegments: 0 };
    }
    const normalizedA = normalizeAvailabilityMap(availabilityA);
    const normalizedB = normalizeAvailabilityMap(availabilityB);
    const dates = new Set([
        ...Object.keys(normalizedA),
        ...Object.keys(normalizedB),
    ]);
    const overlapSegments = [];
    dates.forEach((dateKey) => {
        const entryA = normalizedA[dateKey];
        const entryB = normalizedB[dateKey];
        if (!entryA || !entryB) {
            return;
        }
        if (entryA.blocked || entryB.blocked) {
            return;
        }
        const matchingSegments = SEGMENTS.filter((segment) => entryA[segment] && entryB[segment]);
        if (matchingSegments.length > 0) {
            overlapSegments.push({
                date: dateKey,
                segments: matchingSegments,
            });
        }
    });
    return {
        segments: overlapSegments,
        totalSegments: overlapSegments.reduce((sum, item) => sum + item.segments.length, 0),
    };
}
//# sourceMappingURL=availability.js.map