"use strict";
// Preset interests that users can select from
// This ensures consistent matching and prevents typos/duplicates
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTEREST_EMOJI_MAP = exports.ALL_INTERESTS = exports.INTEREST_CATEGORIES = void 0;
exports.isValidInterest = isValidInterest;
exports.getCategoryForInterest = getCategoryForInterest;
exports.getInterestEmoji = getInterestEmoji;
exports.INTEREST_CATEGORIES = [
    {
        name: 'Sports & Fitness',
        emoji: '💪',
        interests: [
            'Gym',
            'Yoga',
            'Running',
            'Hiking',
            'Cycling',
            'Swimming',
            'Basketball',
            'Football',
            'Tennis',
            'Soccer',
            'Rock Climbing',
            'Surfing',
            'Skiing',
            'Volleyball',
            'CrossFit',
            'Pilates',
            'Boxing',
            'Martial Arts',
        ],
    },
    {
        name: 'Food & Drink',
        emoji: '🍕',
        interests: [
            'Cooking',
            'Baking',
            'Coffee',
            'Wine',
            'Craft Beer',
            'Sushi',
            'Pizza',
            'Vegan Food',
            'BBQ',
            'Food Trucks',
            'Brunch',
            'Fine Dining',
            'Street Food',
            'Whiskey',
            'Cocktails',
        ],
    },
    {
        name: 'Arts & Entertainment',
        emoji: '🎨',
        interests: [
            'Music',
            'Concerts',
            'Live Music',
            'Guitar',
            'Piano',
            'Singing',
            'Dancing',
            'Movies',
            'Theater',
            'Stand-up Comedy',
            'Reading',
            'Writing',
            'Photography',
            'Art',
            'Painting',
            'Drawing',
            'Pottery',
            'Gaming',
            'Video Games',
            'Board Games',
        ],
    },
    {
        name: 'Travel & Adventure',
        emoji: '✈️',
        interests: [
            'Travel',
            'Camping',
            'Backpacking',
            'Road Trips',
            'Beach',
            'Mountains',
            'National Parks',
            'International Travel',
            'Adventure Sports',
            'Kayaking',
            'Sailing',
            'Scuba Diving',
            'Skydiving',
        ],
    },
    {
        name: 'Learning & Culture',
        emoji: '📚',
        interests: [
            'Books',
            'History',
            'Science',
            'Technology',
            'Podcasts',
            'Documentaries',
            'Museums',
            'Languages',
            'Philosophy',
            'Astronomy',
            'Psychology',
            'Politics',
        ],
    },
    {
        name: 'Wellness & Mindfulness',
        emoji: '🧘',
        interests: [
            'Meditation',
            'Mindfulness',
            'Spirituality',
            'Self-improvement',
            'Mental Health',
            'Therapy',
            'Journaling',
            'Wellness',
        ],
    },
    {
        name: 'Social & Lifestyle',
        emoji: '🎉',
        interests: [
            'Fashion',
            'Shopping',
            'Volunteering',
            'Charity Work',
            'Environmentalism',
            'Sustainability',
            'Dogs',
            'Cats',
            'Pets',
            'Gardening',
            'Home Decor',
            'DIY Projects',
            'Nightlife',
            'Karaoke',
            'Trivia',
            'Escape Rooms',
        ],
    },
    {
        name: 'Professional & Business',
        emoji: '💼',
        interests: [
            'Entrepreneurship',
            'Startups',
            'Investing',
            'Real Estate',
            'Marketing',
            'Design',
            'Coding',
            'AI/ML',
            'Crypto',
            'Finance',
        ],
    },
];
// Flatten all interests into a single array for validation
exports.ALL_INTERESTS = exports.INTEREST_CATEGORIES.flatMap(category => category.interests);
// Helper function to validate if an interest is in the preset list
function isValidInterest(interest) {
    return exports.ALL_INTERESTS.includes(interest);
}
// Helper function to get category for an interest
function getCategoryForInterest(interest) {
    const category = exports.INTEREST_CATEGORIES.find(cat => cat.interests.includes(interest));
    return category ? category.name : null;
}
// Map interests to emojis (used in UI)
exports.INTEREST_EMOJI_MAP = {
    'Coffee Date': '☕',
    'Bars': '🍺',
    'Restaurant': '🍽️',
    'Tennis': '🎾',
    'Dog Walking': '🐕',
    'Hiking': '🥾',
};
function getInterestEmoji(interest) {
    return exports.INTEREST_EMOJI_MAP[interest] || '✨';
}
//# sourceMappingURL=interests.config.js.map