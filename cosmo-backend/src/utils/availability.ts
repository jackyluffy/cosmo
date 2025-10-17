import {
  AvailabilityEntry,
  AvailabilityMap,
  AvailabilityOverlapSegment,
  AvailabilitySegment,
} from '../types';

const SEGMENTS: AvailabilitySegment[] = ['morning', 'afternoon', 'evening', 'night'];

export interface AvailabilityOverlapResult {
  segments: AvailabilityOverlapSegment[];
  totalSegments: number;
}

/**
 * Normalize availability map by coercing booleans, removing past dates, and
 * standardizing date keys to ISO (YYYY-MM-DD).
 */
export function normalizeAvailabilityMap(availability?: AvailabilityMap | null): AvailabilityMap {
  if (!availability) {
    return {};
  }

  const normalized: AvailabilityMap = {};
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
      morning: Boolean((entry as AvailabilityEntry).morning),
      afternoon: Boolean((entry as AvailabilityEntry).afternoon),
      evening: Boolean((entry as AvailabilityEntry).evening),
      night: Boolean((entry as AvailabilityEntry).night),
      blocked: Boolean((entry as AvailabilityEntry).blocked),
    };
  });

  return normalized;
}

export function computeAvailabilityOverlap(
  availabilityA?: AvailabilityMap,
  availabilityB?: AvailabilityMap
): AvailabilityOverlapResult {
  if (!availabilityA || !availabilityB) {
    return { segments: [], totalSegments: 0 };
  }

  const normalizedA = normalizeAvailabilityMap(availabilityA);
  const normalizedB = normalizeAvailabilityMap(availabilityB);

  const dates = new Set<string>([
    ...Object.keys(normalizedA),
    ...Object.keys(normalizedB),
  ]);

  const overlapSegments: AvailabilityOverlapSegment[] = [];

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
