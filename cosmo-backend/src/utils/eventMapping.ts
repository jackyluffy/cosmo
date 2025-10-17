import type { EventTemplate } from '../config/events.config';

const INTEREST_TO_EVENT_TYPE: Record<string, EventTemplate['type']> = {
  'Hiking': 'hiking',
  'Dog Walking': 'dog_walking',
  'Tennis': 'tennis',
  'Coffee Date': 'coffee',
  'Bars': 'bar',
  'Restaurant': 'restaurant',
};

export function getEventTypesForInterests(interests: string[] = []): EventTemplate['type'][] {
  const eventTypes = new Set<EventTemplate['type']>();
  interests.forEach((interest) => {
    const mapped = INTEREST_TO_EVENT_TYPE[interest];
    if (mapped) {
      eventTypes.add(mapped);
    }
  });
  return Array.from(eventTypes);
}

export function getSharedEventTypes(
  interestsA: string[] = [],
  interestsB: string[] = []
): EventTemplate['type'][] {
  const typesA = getEventTypesForInterests(interestsA);
  const typesB = new Set(getEventTypesForInterests(interestsB));
  return typesA.filter((type) => typesB.has(type));
}
