"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventTypesForInterests = getEventTypesForInterests;
exports.getSharedEventTypes = getSharedEventTypes;
const INTEREST_TO_EVENT_TYPE = {
    'Hiking': 'hiking',
    'Dog Walking': 'dog_walking',
    'Tennis': 'tennis',
    'Coffee Date': 'coffee',
    'Bars': 'bar',
    'Restaurant': 'restaurant',
};
function getEventTypesForInterests(interests = []) {
    const eventTypes = new Set();
    interests.forEach((interest) => {
        const mapped = INTEREST_TO_EVENT_TYPE[interest];
        if (mapped) {
            eventTypes.add(mapped);
        }
    });
    return Array.from(eventTypes);
}
function getSharedEventTypes(interestsA = [], interestsB = []) {
    const typesA = getEventTypesForInterests(interestsA);
    const typesB = new Set(getEventTypesForInterests(interestsB));
    return typesA.filter((type) => typesB.has(type));
}
//# sourceMappingURL=eventMapping.js.map