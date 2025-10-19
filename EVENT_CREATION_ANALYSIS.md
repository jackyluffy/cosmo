# Event Creation Flow from pair_matches Table

## Overview
Events are created automatically from pair matches through a multi-stage process. The system matches pairs of users, manages their availability and shared interests, queues them, and then orchestrates event creation when sufficient pairs are ready.

---

## 1. Data Flow Architecture

```
User Swipes
    ↓
SWIPES Collection
    ↓
Mutual Match Detected (User A likes User B + User B likes User A)
    ↓
PairMatchingService.upsertPairMatch()
    ↓
PAIR_MATCHES Collection
    ↓
[Queue Status Determination]
    ↓
Cron Job: /auto-organize-events (every 15 minutes)
    ↓
EventOrchestrationService.processAllQueues()
    ↓
EVENTS Collection Created
    ↓
USERS Collection Updated with pendingEvents
```

---

## 2. pair_matches Table Schema

Location: `/Users/luffy/Desktop/cosmo_app/cosmo-backend/src/types/index.ts`

```typescript
interface PairMatch {
  id: string;                                    // Firestore Document ID
  pairKey: string;                              // Sorted user IDs: "userId1:userId2"
  userIds: [string, string];                    // Sorted user ID pair
  
  // Status tracking
  status: PairMatchStatus;                      // 'active' | 'inactive' | 'blocked'
  queueStatus: PairMatchQueueStatus;            // See queue statuses below
  
  // Event type information
  queueEventType?: EventType | null;            // Primary event type
  sharedEventTypes: EventType[];                // All shared event types
  suggestedEventType?: EventType | null;        // Suggested event type
  
  // Availability
  availabilityOverlapCount: number;             // Total overlap segments
  availabilityOverlapSegments: AvailabilityOverlapSegment[];  // Date + segment combos
  availabilityComputedAt?: Timestamp;
  hasSufficientAvailability: boolean;           // >= 2 overlap segments
  
  // Event linkage
  pendingEventId?: string | null;               // Event ID once assigned to event
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}

// Queue Status Values
type PairMatchQueueStatus = 
  | 'awaiting_availability'    // Not enough availability overlap
  | 'awaiting_event_type'      // No shared event types
  | 'queued'                   // Ready for event creation
  | 'in_event'                 // Assigned to an event
  | 'sidelined';               // Unmatched/inactive

// Availability Overlap Segment
interface AvailabilityOverlapSegment {
  date: string;                // ISO format (YYYY-MM-DD)
  segments: AvailabilitySegment[];  // ['morning', 'afternoon', 'evening', 'night']
}
```

---

## 3. Event Types Supported

From `/Users/luffy/Desktop/cosmo_app/cosmo-backend/src/types/index.ts`:

```typescript
type EventType = 'coffee' | 'bar' | 'restaurant' | 'tennis' | 'dog_walking' | 'hiking';
```

**Interest-to-EventType Mapping** (from `eventMapping.ts`):
```
- 'Hiking' → 'hiking'
- 'Dog Walking' → 'dog_walking'
- 'Tennis' → 'tennis'
- 'Coffee Date' → 'coffee'
- 'Bars' → 'bar'
- 'Restaurant' → 'restaurant'
```

---

## 4. Stage 1: Pair Match Creation (from Swipes)

**File**: `/Users/luffy/Desktop/cosmo_app/cosmo-backend/src/controllers/swipe.controller.ts`

**Trigger**: When user swipes "like" and mutual match is detected

**Flow**:
```
1. User A swipes "like" on User B
2. Check if User B has already "liked" User A
3. If YES → Mutual Match Detected
4. Call: PairMatchingService.upsertPairMatch(userA, userB)
```

**PairMatchingService.upsertPairMatch() logic** (from `pair-matching.service.ts`):

```typescript
static async upsertPairMatch(userA, userB): Promise<PairMatch> {
  // 1. Build pair key by sorting user IDs
  pairKey = sort([userA.id, userB.id]).join(':');
  
  // 2. Normalize availability from both users
  availabilityA = sanitizeAvailability(userA.profile?.availability);
  availabilityB = sanitizeAvailability(userB.profile?.availability);
  
  // 3. Compute availability overlap
  overlap = computeAvailabilityOverlap(availabilityA, availabilityB);
  hasSufficientAvailability = overlap.totalSegments >= 2;
  
  // 4. Get shared event types from interests
  sharedEventTypes = getSharedEventTypes(
    userA.profile?.interests,
    userB.profile?.interests
  );
  
  // 5. Determine queue status
  if (!hasSufficientAvailability) {
    queueStatus = 'awaiting_availability';
  } else if (sharedEventTypes.length === 0) {
    queueStatus = 'awaiting_event_type';
  } else {
    queueStatus = 'queued';  // Ready for event creation!
    queueEventType = sharedEventTypes[0];
  }
  
  // 6. Upsert document in pair_matches collection
  // (creates if new, updates if existing)
}
```

**pair_matches Document Created**:
```json
{
  "pairKey": "userId1:userId2",
  "userIds": ["userId1", "userId2"],
  "status": "active",
  "queueStatus": "queued",  // or 'awaiting_availability', 'awaiting_event_type'
  "queueEventType": "coffee",
  "sharedEventTypes": ["coffee", "hiking"],
  "suggestedEventType": "coffee",
  "availabilityOverlapCount": 3,
  "availabilityOverlapSegments": [
    { "date": "2025-10-20", "segments": ["morning", "evening"] },
    { "date": "2025-10-21", "segments": ["afternoon"] }
  ],
  "hasSufficientAvailability": true,
  "pendingEventId": null,
  "createdAt": Timestamp,
  "updatedAt": Timestamp,
  "lastActivityAt": Timestamp
}
```

---

## 5. Stage 2: Scheduled Queue Processing (Cron Job)

**Route**: `/Users/luffy/Desktop/cosmo_app/cosmo-backend/src/routes/cron.routes.ts`
**Endpoint**: `POST /cron/auto-organize-events`
**Schedule**: Should be called by Cloud Scheduler every 15 minutes

**Handler Code**:
```typescript
router.post('/auto-organize-events', async (req, res) => {
  const createdByType = await EventOrchestrationService.processAllQueues();
  // Returns: { coffee: [eventId1, ...], bar: [...], ... }
});
```

---

## 6. Stage 3: Event Orchestration Service

**File**: `/Users/luffy/Desktop/cosmo_app/cosmo-backend/src/services/event-orchestration.service.ts`

### 6.1 processAllQueues() Method

```typescript
static async processAllQueues(): Promise<Record<EventType, string[]>> {
  const createdEventsByType = {};
  
  // Process queue for each event type
  for (const eventType of ['coffee', 'bar', 'restaurant', 'tennis', 'dog_walking', 'hiking']) {
    createdEventsByType[eventType] = await this.processQueueForEventType(eventType);
  }
  
  return createdEventsByType;
}
```

### 6.2 processQueueForEventType() Method

```typescript
static async processQueueForEventType(eventType: EventType): Promise<string[]> {
  // 1. Get all queued pairs for this event type
  const queuedPairs = await PairMatchingService.getQueuedPairsForEventType(eventType);
  
  // 2. Calculate minimum pairs needed per event
  const template = selectTemplate(eventType);  // Get event template
  const pairsRequired = Math.floor(template.groupSize / 2);
  
  // Example: if groupSize = 4, need 2 pairs (4 people)
  //          if groupSize = 6, need 3 pairs (6 people)
  
  // 3. Check if enough pairs exist
  if (queuedPairs.length < pairsRequired) {
    return [];  // Not enough pairs yet
  }
  
  // 4. Remove pairs already assigned to events
  const eligiblePairs = queuedPairs
    .filter(match => !match.pendingEventId)
    .sort((a, b) => {
      // Sort by availability computation time (oldest first)
      return a.availabilityComputedAt - b.availabilityComputedAt;
    });
  
  // 5. Create events while we have enough pairs
  const createdEventIds = [];
  while (eligiblePairs.length >= pairsRequired) {
    // Extract next batch of pairs
    const pairsForEvent = eligiblePairs.splice(0, pairsRequired);
    
    // Create event document
    const eventId = await createPendingEventDocument(eventType, pairsForEvent);
    
    // Link pairs to event
    await updatePairMatchesWithEvent(pairsForEvent, eventId);
    
    // Assign pending event to all participants
    const uniqueUserIds = new Set();
    pairsForEvent.forEach(pair => {
      pair.userIds.forEach(id => uniqueUserIds.add(id));
    });
    
    for (const userId of uniqueUserIds) {
      await assignPendingEventToUser(userId, {
        eventId,
        eventType,
        status: 'pending_join'
      });
    }
    
    createdEventIds.push(eventId);
  }
  
  return createdEventIds;
}
```

---

## 7. Event Document Creation

**Function**: `createPendingEventDocument()`

### 7.1 Created Event Structure

```json
{
  "title": "Coffee Date",
  "description": "Meet new people over coffee",
  "category": "restaurant",
  "eventType": "coffee",
  "date": Timestamp,
  "location": {
    "name": "Coffee Venue",
    "address": "...",
    "coordinates": GeoPoint
  },
  "photos": [...],
  "organizer": {
    "id": "cosmo-system-organizer",
    "name": "Cosmo Events"
  },
  "groups": [],
  "maxGroupsCount": 1,
  "groupSize": 4,
  "pricePerPerson": 15,
  "ageRange": { "min": 21, "max": 60 },
  "status": "pending_join",
  "createdAt": Timestamp,
  "updatedAt": Timestamp,
  "autoOrganized": true,
  
  // Pair match tracking
  "pendingPairMatchIds": ["pairMatchId1", "pairMatchId2"],
  "requiredPairCount": 2,
  
  // Participants
  "participantUserIds": ["userId1", "userId2", "userId3", "userId4"],
  "participantStatuses": {
    "userId1": "pending_join",
    "userId2": "pending_join",
    "userId3": "pending_join",
    "userId4": "pending_join"
  },
  
  // Venue voting
  "venueOptions": [
    {
      "id": "coffee-0-blue-bottle",
      "name": "Blue Bottle Coffee",
      "address": "...",
      "coordinates": GeoPoint,
      "photos": [...]
    },
    { ... }  // Up to 3 venue options
  ],
  "venueVoteTotals": {
    "coffee-0-blue-bottle": 0,
    "coffee-1-...": 0
  },
  "finalVenueOptionId": null,
  
  // Suggested times from availability overlap
  "suggestedTimes": [
    {
      "date": "2025-10-20",
      "segments": ["morning", "evening"]
    }
  ],
  
  // Other fields
  "votesSubmittedCount": 0,
  "chatRoomId": null,
  "reminderSent": false,
  "reminderSentAt": null,
  "confirmationsReceived": 0
}
```

### 7.2 Key Transformations

1. **Suggested Times**: Aggregates availability overlap from all pair matches
2. **Venue Options**: Selected from event template configuration
3. **Participant Statuses**: All start as "pending_join"
4. **Pair Match Linkage**: Records which pair matches comprise the event

---

## 8. pair_matches Updates

When pairs are assigned to an event, the pair_matches document is updated:

```typescript
await updatePairMatchesWithEvent(pairMatches, eventId) {
  // For each pair match:
  await pairMatch.update({
    queueStatus: 'in_event',      // Now linked to event
    pendingEventId: eventId,        // Track which event
    updatedAt: Timestamp.now(),
    lastActivityAt: Timestamp.now()
  });
}
```

**Updated pair_matches Document**:
```json
{
  "queueStatus": "in_event",        // Changed from 'queued'
  "pendingEventId": "event123",     // Now linked to event
  "updatedAt": Timestamp,
  "lastActivityAt": Timestamp
}
```

---

## 9. User Updates (pendingEvents)

When an event is created, each participant user document is updated:

```typescript
await assignPendingEventToUser(userId, assignment) {
  // assignment = { eventId, eventType, status: 'pending_join', ... }
  
  userRef.update({
    pendingEvents: [...existing, assignment],
    pendingEventCount: count
  });
}
```

**Updated USERS Document**:
```json
{
  "pendingEvents": [
    {
      "eventId": "event123",
      "eventType": "coffee",
      "status": "pending_join",
      "assignedAt": Timestamp,
      "updatedAt": Timestamp
    }
  ],
  "pendingEventCount": 1
}
```

---

## 10. Queue Status Determination Logic

### Determining Queue Status

Located in `pair-matching.service.ts`:

```typescript
function deriveQueueStatus(
  hasSufficientAvailability: boolean,
  sharedEventTypes: EventType[]
) {
  // If no availability overlap
  if (!hasSufficientAvailability) {
    return {
      queueStatus: 'awaiting_availability',
      queueEventType: null,
      suggestedEventType: null
    };
  }
  
  // If no shared event types
  if (sharedEventTypes.length === 0) {
    return {
      queueStatus: 'awaiting_event_type',
      queueEventType: null,
      suggestedEventType: null
    };
  }
  
  // Ready for event creation!
  const [primary] = sharedEventTypes;
  return {
    queueStatus: 'queued',
    queueEventType: primary,
    suggestedEventType: primary
  };
}
```

### Minimum Availability Required

```typescript
const MIN_OVERLAP_SEGMENTS = 2;
// hasSufficientAvailability = (overlap.totalSegments >= 2)
```

**What is a segment?**
- Date: YYYY-MM-DD
- Time period: 'morning', 'afternoon', 'evening', or 'night'

Example: 2 segments could be:
- 2025-10-20 morning
- 2025-10-21 afternoon

---

## 11. Cron Job Configuration

**Current Implementation**: Manual route-based approach
**Route**: `POST /cron/auto-organize-events`

**Should be triggered by Google Cloud Scheduler with**:
```
URL: https://your-backend.com/cron/auto-organize-events
Method: POST
Authentication: Custom header
Header: X-Cron-Secret: [CRON_SECRET env var]
Schedule: Every 15 minutes (*/15 * * * *)
```

**Related Cron Jobs** (in same `cron.routes.ts`):
- `/daily-matching` - Match algorithm for events (2 AM PST)
- `/cleanup-otp` - Delete expired OTP codes (midnight)
- `/daily-notifications` - Send engagement notifications
- `/update-subscriptions` - Update subscription statuses
- `/weekly-analytics` - Generate analytics reports
- `/event-reminders` - Send 48-hour event reminders

---

## 12. File Locations Summary

```
/Users/luffy/Desktop/cosmo_app/cosmo-backend/src/

├── controllers/
│   └── swipe.controller.ts           # SwipeController.swipe() - initial match detection
│
├── services/
│   ├── pair-matching.service.ts      # PairMatchingService - creates/updates pair_matches
│   ├── event-orchestration.service.ts # EventOrchestrationService - creates events from pairs
│   ├── matching.service.ts           # MatchingService - group formation (alternative flow)
│   └── notification.service.ts       # Sends notifications
│
├── routes/
│   ├── cron.routes.ts               # Cron job endpoints
│   └── event.routes.ts              # Event management endpoints
│
├── types/
│   └── index.ts                     # All TypeScript interfaces
│
├── config/
│   ├── firebase.ts                  # Collections definition
│   └── events.config.ts             # Event templates & venue options
│
├── utils/
│   ├── availability.ts              # Availability overlap computation
│   └── eventMapping.ts              # Interest-to-EventType mapping
│
└── scripts/
    ├── generate-matches.ts          # Test data generation
    └── check-swipes.ts              # Debugging script
```

---

## 13. Collection Dependencies

```
USERS
  ├── profile.interests (→ eventTypes)
  ├── profile.availability (→ overlap segments)
  └── pendingEvents (← assigned from EVENTS)

SWIPES
  ├── userId
  ├── targetId
  └── direction ('like' or 'skip')

PAIR_MATCHES (Core Queue)
  ├── userIds[2]
  ├── queueStatus
  ├── sharedEventTypes
  ├── availabilityOverlapSegments
  └── pendingEventId (→ EVENTS)

EVENTS
  ├── pendingPairMatchIds (→ PAIR_MATCHES)
  ├── participantUserIds (→ USERS)
  ├── status
  └── eventType
```

---

## 14. Key Constraints & Rules

1. **Pair Creation**: Only mutual likes create pairs
2. **Queue Requirement**: At least 2 availability overlap segments
3. **Event Threshold**: Minimum pairs = groupSize / 2
4. **Availability Normalization**: 
   - Only future dates (today onwards)
   - ISO format (YYYY-MM-DD)
   - Boolean coercion
5. **Pair Sorting**: By `availabilityComputedAt` (oldest first - FIFO)
6. **User Deduplication**: Set ensures each user appears once per event
7. **Queue Status Priorities**:
   - `awaiting_availability` - needs more date overlap
   - `awaiting_event_type` - needs shared interests
   - `queued` - ready for event creation

---

## 15. Example End-to-End Flow

```
Timeline:
---------

T0: User A (interests: hiking, coffee) swipes "like" on User B
    User B already swiped "like" on User A
    → MATCH DETECTED

T0+1s: SwipeController.swipe() calls:
       PairMatchingService.upsertPairMatch(userA, userB)
       
T0+2s: pair_matches document created:
       {
         pairKey: "userA:userB",
         queueStatus: "queued",  (they share hiking, coffee)
         queueEventType: "hiking",
         hasSufficientAvailability: true,
         pendingEventId: null
       }

T0+600s: Cloud Scheduler triggers POST /cron/auto-organize-events

T0+601s: EventOrchestrationService.processAllQueues() runs:
         For each event type (coffee, hiking, etc...):
           - Query pair_matches where queueStatus='queued' && queueEventType='hiking'
           - If >= 2 pairs (for groupSize 4), create event
           
         Creates EVENTS document:
         {
           eventType: "hiking",
           status: "pending_join",
           pendingPairMatchIds: ["pairId1", "pairId2"],
           participantUserIds: ["userA", "userB", "userC", "userD"],
           suggestedTimes: [...from availability overlap]
         }

T0+602s: pair_matches documents updated:
         {
           queueStatus: "in_event",
           pendingEventId: "eventId123"
         }

T0+603s: USERS documents updated for all 4 participants:
         {
           pendingEvents: [{
             eventId: "eventId123",
             eventType: "hiking",
             status: "pending_join"
           }]
         }

Later: Users join/decline event
       Event confirmed when all accept
       Event marked as 'completed' after occurrence
```

---

## 16. Future Event Filtering

Users can see their pending events through:
- `users.pendingEvents[]` array
- `events` collection filtered by `participantUserIds`

---

## 17. Troubleshooting pair_matches Issues

**Pairs stuck in "awaiting_availability"**:
- Check users' availability has 2+ overlapping date-segments
- Ensure availability dates are not in the past

**Pairs stuck in "awaiting_event_type"**:
- Verify users have shared interests
- Check interest-to-eventType mapping in `eventMapping.ts`

**Event not creating despite queued pairs**:
- Check cron job is being triggered
- Verify `CRON_SECRET` header matches environment variable
- Ensure Cloud Scheduler has correct URL and authentication

**pair_matches never created after mutual like**:
- Check SwipeController.swipe() logic
- Verify both users have profiles with availability
- Check `normalizeAvailabilityMap()` isn't filtering all dates

