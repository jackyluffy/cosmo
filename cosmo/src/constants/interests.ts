// Preset interests that users can select from
// This ensures consistent matching and prevents typos/duplicates

export interface InterestCategory {
  name: string;
  emoji: string;
  interests: string[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    name: 'Date Activities',
    emoji: '💝',
    interests: [
      'Coffee Date',
      'Bars',
      'Restaurant',
      'Tennis',
      'Dog Walking',
      'Hiking',
    ],
  },
];

// Flatten all interests into a single array
export const ALL_INTERESTS = INTEREST_CATEGORIES.flatMap(category => category.interests);

// Map interests to emojis (used in UI)
export const INTEREST_EMOJI_MAP: { [key: string]: string } = {
  'Coffee Date': '☕',
  'Bars': '🍺',
  'Restaurant': '🍽️',
  'Tennis': '🎾',
  'Dog Walking': '🐕',
  'Hiking': '🥾',
};

export function getInterestEmoji(interest: string): string {
  return INTEREST_EMOJI_MAP[interest] || '✨';
}

export function getCategoryForInterest(interest: string): InterestCategory | null {
  return INTEREST_CATEGORIES.find(cat => cat.interests.includes(interest)) || null;
}

// Format interests for the onboarding InterestsScreen (with id, label, emoji)
export const INTERESTS = ALL_INTERESTS.map(interest => ({
  id: interest,
  label: interest,
  emoji: INTEREST_EMOJI_MAP[interest] || '✨'
}));
