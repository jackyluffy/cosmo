# Configuration Files Update Guide

This guide explains how to update the interests and events configuration files in your Cosmo app.

---

## 📋 Interests Configuration

### Files to Update:
1. **Backend**: `/cosmo-backend/src/config/interests.config.ts`
2. **Frontend**: `/cosmo/src/constants/interests.ts`

### How to Update Interests:

#### 1. Add a New Category

```typescript
{
  name: 'Your New Category',
  emoji: '🎯',  // Choose an emoji
  interests: [
    'Interest 1',
    'Interest 2',
    'Interest 3',
  ],
}
```

**Example**: Adding a "Sports" subcategory:
```typescript
{
  name: 'Water Sports',
  emoji: '🌊',
  interests: [
    'Swimming',
    'Surfing',
    'Kayaking',
    'Paddleboarding',
  ],
}
```

#### 2. Add Interests to Existing Category

Find the category in the `INTEREST_CATEGORIES` array and add to the `interests` array:

```typescript
{
  name: 'Food & Drink',
  emoji: '🍕',
  interests: [
    'Cooking',
    'Baking',
    'Coffee',
    'Wine',
    // ADD NEW INTERESTS HERE:
    'Matcha',
    'Tea Ceremonies',
    'Molecular Gastronomy',
  ],
}
```

#### 3. Update Interest Emojis

Add emoji mappings in the `INTEREST_EMOJI_MAP` object:

```typescript
export const INTEREST_EMOJI_MAP: { [key: string]: string } = {
  // ... existing mappings ...

  // ADD NEW MAPPINGS:
  'Matcha': '🍵',
  'Tea Ceremonies': '🍵',
  'Molecular Gastronomy': '🧪',
};
```

#### 4. Remove an Interest

Simply delete the interest string from the category:

```typescript
// BEFORE:
interests: [
  'Cooking',
  'Baking',
  'Coffee',  // ❌ Remove this
  'Wine',
]

// AFTER:
interests: [
  'Cooking',
  'Baking',
  'Wine',
]
```

**⚠️ Important**: When removing interests, also remove the emoji mapping!

#### 5. Sync Backend and Frontend

After updating interests:

1. Update **backend** file: `/cosmo-backend/src/config/interests.config.ts`
2. Update **frontend** file: `/cosmo/src/constants/interests.ts`
3. Make sure both files have **identical** interest lists
4. Compile backend TypeScript: `cd cosmo-backend && npx tsc`
5. Deploy backend: Use your deployment script
6. Rebuild mobile app: `cd cosmo && npx expo start`

---

## 🎉 Events Configuration

### File Location:
**Backend**: `/cosmo-backend/src/config/events.config.ts`

### How to Update Events:

#### 1. Add a New Venue

Add to the `VENUES` object:

```typescript
export const VENUES: Record<string, VenueConfig> = {
  // ... existing venues ...

  YOUR_NEW_VENUE: {
    name: 'The Cool Spot',
    address: '123 Main St, City, CA 12345',
    lat: 33.8789,  // Get from Google Maps
    lng: -117.8547,
    photos: ['https://images.unsplash.com/photo-xxxxx?w=800'],
  },
};
```

**How to get coordinates**:
1. Go to Google Maps
2. Right-click on the location
3. Click the coordinates to copy them
4. First number = latitude, Second number = longitude

**Photo URLs**:
- Use Unsplash for free stock photos: https://unsplash.com
- Format: `https://images.unsplash.com/photo-[ID]?w=800`
- Or use your own hosted images

#### 2. Add a New Event Template

Add to the `EVENT_TEMPLATES` array:

```typescript
{
  type: 'bar',  // Options: 'tennis' | 'bar' | 'brunch' | 'dinner' | 'hiking'
  category: 'food',  // Options: 'sports' | 'food' | 'music' | 'art' | 'games' | 'other'
  title: 'Wine Tasting Social',
  description: 'Sample fine wines and meet fellow wine enthusiasts.',
  venue: VENUES.YOUR_NEW_VENUE,
  priceRange: { min: 30, max: 50 },
  durationMinutes: 120,  // 2 hours
  ageRange: { min: 25, max: 45 },
  groupSize: 4,  // Must be 4 or 6
}
```

#### 3. Update Existing Event

Find the event in `EVENT_TEMPLATES` and modify:

```typescript
// BEFORE:
{
  type: 'brunch',
  category: 'food',
  title: 'Sunday Brunch & Coffee',
  priceRange: { min: 15, max: 25 },
  // ...
}

// AFTER:
{
  type: 'brunch',
  category: 'food',
  title: 'Bottomless Mimosa Brunch',  // ✅ Updated title
  priceRange: { min: 20, max: 35 },    // ✅ Updated price
  // ...
}
```

#### 4. Add New Event Type

To add a completely new event type (beyond tennis, bar, brunch, dinner, hiking):

1. Update the type union in the interface:
```typescript
export interface EventTemplate {
  type: 'tennis' | 'bar' | 'brunch' | 'dinner' | 'hiking' | 'yoga' | 'climbing';  // ✅ Added yoga & climbing
  // ...
}
```

2. Add the new event templates using the new type

#### 5. Change Venue Details

```typescript
NOBLE_ALE_WORKS: {
  name: 'Noble Ale Works - Updated',  // ✅ Update name
  address: '1621 S Sinclair St #B, Anaheim, CA 92806',
  lat: 33.8089,
  lng: -117.9234,
  photos: [
    'https://images.unsplash.com/photo-xxxxx?w=800',  // ✅ Update photo
  ],
}
```

---

## 🚀 Deployment Checklist

### After Updating Interests:

- [ ] Update backend: `/cosmo-backend/src/config/interests.config.ts`
- [ ] Update frontend: `/cosmo/src/constants/interests.ts`
- [ ] Verify both files have identical interests
- [ ] Compile backend: `cd cosmo-backend && npx tsc`
- [ ] Deploy backend to Cloud Run
- [ ] Test on mobile app

### After Updating Events:

- [ ] Update: `/cosmo-backend/src/config/events.config.ts`
- [ ] Verify venue coordinates are correct
- [ ] Verify venue photos load
- [ ] Compile backend: `cd cosmo-backend && npx tsc`
- [ ] Deploy backend to Cloud Run
- [ ] Test event creation in admin panel

---

## 💡 Tips & Best Practices

### Interests:
1. **Keep it consistent**: Use title case (e.g., "Rock Climbing" not "rock climbing")
2. **Be specific**: "Craft Beer" is better than just "Beer"
3. **Avoid duplicates**: Check both backend and frontend before adding
4. **Test matching**: After adding interests, test the matching algorithm
5. **Use clear emojis**: Choose emojis that clearly represent the interest

### Events:
1. **Realistic prices**: Check actual venue pricing before setting ranges
2. **Accurate addresses**: Test addresses in Google Maps first
3. **Group sizes**: Only use 4 or 6 (must be even for gender ratio)
4. **Duration**: Consider travel time + activity time
5. **Age ranges**: Make sure they're inclusive but realistic for the venue

### General:
1. **Always sync**: Keep backend and frontend configs identical
2. **Test locally**: Test changes locally before deploying
3. **Version control**: Commit config changes with clear messages
4. **Document changes**: Note what you changed and why

---

## 🐛 Common Issues

### Issue: "Interest not showing in app"
**Solution**: Make sure you updated BOTH backend and frontend files

### Issue: "Emoji not displaying"
**Solution**: Check that the interest has an entry in `INTEREST_EMOJI_MAP`

### Issue: "Event creation fails"
**Solution**: Verify venue coordinates are valid and groupSize is 4 or 6

### Issue: "Changes not appearing after deployment"
**Solution**:
1. Clear app cache
2. Force close and reopen app
3. Check backend deployment succeeded
4. Verify TypeScript compiled without errors

---

## 📞 Quick Reference

### Interest Categories (8 total):
1. Sports & Fitness (💪)
2. Food & Drink (🍕)
3. Arts & Entertainment (🎨)
4. Travel & Adventure (✈️)
5. Learning & Culture (📚)
6. Wellness & Mindfulness (🧘)
7. Social & Lifestyle (🎉)
8. Professional & Business (💼)

### Event Types (5 total):
1. Tennis 🎾
2. Bar 🍺
3. Brunch 🥞
4. Dinner 🍽️
5. Hiking 🥾

### File Paths:
```
Backend Interests:  cosmo-backend/src/config/interests.config.ts
Frontend Interests: cosmo/src/constants/interests.ts
Events Config:      cosmo-backend/src/config/events.config.ts
```

---

## 🎯 Example: Complete Update Flow

Let's say you want to add "Wine Tasting" events with a new "Wine" interest:

### Step 1: Add Interest (Backend)
```typescript
// File: cosmo-backend/src/config/interests.config.ts
{
  name: 'Food & Drink',
  interests: [
    // ... existing ...
    'Wine Tasting',  // ✅ Added
  ],
}

// Add emoji mapping:
'Wine Tasting': '🍷',
```

### Step 2: Add Interest (Frontend)
```typescript
// File: cosmo/src/constants/interests.ts
// Copy the exact same changes from backend
```

### Step 3: Add Venue
```typescript
// File: cosmo-backend/src/config/events.config.ts
WINE_CELLAR: {
  name: 'The Wine Cellar',
  address: '456 Vineyard Rd, Napa, CA 94558',
  lat: 38.2975,
  lng: -122.2869,
  photos: ['https://images.unsplash.com/photo-wine-cellar?w=800'],
}
```

### Step 4: Add Event Template
```typescript
{
  type: 'bar',
  category: 'food',
  title: 'Wine Tasting Evening',
  description: 'Sample premium wines and meet fellow wine enthusiasts.',
  venue: VENUES.WINE_CELLAR,
  priceRange: { min: 40, max: 60 },
  durationMinutes: 150,
  ageRange: { min: 25, max: 55 },
  groupSize: 6,
}
```

### Step 5: Deploy
```bash
# Compile TypeScript
cd cosmo-backend
npx tsc

# Deploy backend (example)
gcloud run deploy cosmo-backend --region us-central1

# Restart mobile app
cd ../cosmo
npx expo start
```

Done! 🎉
