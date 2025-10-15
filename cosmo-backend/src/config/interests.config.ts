// Preset interests that users can select from
// This ensures consistent matching and prevents typos/duplicates

export interface InterestCategory {
  name: string;
  emoji: string;
  interests: string[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
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
export const ALL_INTERESTS = INTEREST_CATEGORIES.flatMap(category => category.interests);

// Helper function to validate if an interest is in the preset list
export function isValidInterest(interest: string): boolean {
  return ALL_INTERESTS.includes(interest);
}

// Helper function to get category for an interest
export function getCategoryForInterest(interest: string): string | null {
  const category = INTEREST_CATEGORIES.find(cat =>
    cat.interests.includes(interest)
  );
  return category ? category.name : null;
}

// Map interests to emojis (used in UI)
export const INTEREST_EMOJI_MAP: { [key: string]: string } = {
  // Sports & Fitness
  'Gym': '🏋️',
  'Yoga': '🧘',
  'Running': '🏃',
  'Hiking': '🥾',
  'Cycling': '🚴',
  'Swimming': '🏊',
  'Basketball': '🏀',
  'Football': '⚽',
  'Tennis': '🎾',
  'Soccer': '⚽',
  'Rock Climbing': '🧗',
  'Surfing': '🏄',
  'Skiing': '⛷️',
  'Volleyball': '🏐',
  'CrossFit': '💪',
  'Pilates': '🤸',
  'Boxing': '🥊',
  'Martial Arts': '🥋',

  // Food & Drink
  'Cooking': '👨‍🍳',
  'Baking': '🧁',
  'Coffee': '☕',
  'Wine': '🍷',
  'Craft Beer': '🍺',
  'Sushi': '🍣',
  'Pizza': '🍕',
  'Vegan Food': '🥗',
  'BBQ': '🍖',
  'Food Trucks': '🚚',
  'Brunch': '🥞',
  'Fine Dining': '🍽️',
  'Street Food': '🌮',
  'Whiskey': '🥃',
  'Cocktails': '🍸',

  // Arts & Entertainment
  'Music': '🎵',
  'Concerts': '🎪',
  'Live Music': '🎸',
  'Guitar': '🎸',
  'Piano': '🎹',
  'Singing': '🎤',
  'Dancing': '💃',
  'Movies': '🎬',
  'Theater': '🎭',
  'Stand-up Comedy': '😂',
  'Reading': '📚',
  'Writing': '✍️',
  'Photography': '📸',
  'Art': '🎨',
  'Painting': '🎨',
  'Drawing': '✏️',
  'Pottery': '🏺',
  'Gaming': '🎮',
  'Video Games': '🎮',
  'Board Games': '🎲',

  // Travel & Adventure
  'Travel': '✈️',
  'Camping': '⛺',
  'Backpacking': '🎒',
  'Road Trips': '🚗',
  'Beach': '🏖️',
  'Mountains': '⛰️',
  'National Parks': '🏞️',
  'International Travel': '🌍',
  'Adventure Sports': '🪂',
  'Kayaking': '🛶',
  'Sailing': '⛵',
  'Scuba Diving': '🤿',
  'Skydiving': '🪂',

  // Learning & Culture
  'Books': '📚',
  'History': '📜',
  'Science': '🔬',
  'Technology': '💻',
  'Podcasts': '🎙️',
  'Documentaries': '📺',
  'Museums': '🏛️',
  'Languages': '🗣️',
  'Philosophy': '🤔',
  'Astronomy': '🔭',
  'Psychology': '🧠',
  'Politics': '🏛️',

  // Wellness & Mindfulness
  'Meditation': '🧘‍♀️',
  'Mindfulness': '🧘',
  'Spirituality': '✨',
  'Self-improvement': '📈',
  'Mental Health': '💚',
  'Therapy': '🛋️',
  'Journaling': '📓',
  'Wellness': '🌿',

  // Social & Lifestyle
  'Fashion': '👗',
  'Shopping': '🛍️',
  'Volunteering': '❤️',
  'Charity Work': '🤝',
  'Environmentalism': '🌱',
  'Sustainability': '♻️',
  'Dogs': '🐕',
  'Cats': '🐱',
  'Pets': '🐾',
  'Gardening': '🌻',
  'Home Decor': '🏠',
  'DIY Projects': '🔨',
  'Nightlife': '🌃',
  'Karaoke': '🎤',
  'Trivia': '❓',
  'Escape Rooms': '🚪',

  // Professional & Business
  'Entrepreneurship': '💡',
  'Startups': '🚀',
  'Investing': '📈',
  'Real Estate': '🏘️',
  'Marketing': '📊',
  'Design': '🎨',
  'Coding': '💻',
  'AI/ML': '🤖',
  'Crypto': '₿',
  'Finance': '💰',
};

export function getInterestEmoji(interest: string): string {
  return INTEREST_EMOJI_MAP[interest] || '✨';
}
