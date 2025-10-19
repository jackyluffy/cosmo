# pair_matches Table Quick Reference

## TL;DR - Events from pair_matches

1. **User swipes** → Mutual match detected → **pair_matches created**
2. **pair_matches determined** → `queueStatus = 'queued'` (if ready)
3. **Cron job** (`/cron/auto-organize-events`) runs every 15 minutes
4. **Event orchestration** groups queued pairs → **events created**
5. **Cascade updates** to pair_matches (`in_event`) and users (`pendingEvents`)

---

## pair_matches Document Fields

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `id` | string | (auto) | Firestore document ID |
| `pairKey` | string | "userA:userB" | Unique sorted pair identifier |
| `userIds` | [string, string] | ["userId1", "userId2"] | The two matched users |
| **Status** |
| `status` | enum | "active" | 'active' \| 'inactive' \| 'blocked' |
| `queueStatus` | enum | "queued" | 'awaiting_availability' \| 'awaiting_event_type' \| 'queued' \| 'in_event' \| 'sidelined' |
| **Event Type Info** |
| `sharedEventTypes` | EventType[] | ["coffee", "hiking"] | All event types pair can do together |
| `queueEventType` | EventType | "coffee" | Primary event type in queue |
| `suggestedEventType` | EventType | "coffee" | Recommended event type |
| **Availability** |
| `availabilityOverlapCount` | number | 3 | Total overlapping date-time segments |
| `availabilityOverlapSegments` | array | [{date: "2025-10-20", segments: ["morning"]}] | Detailed overlap breakdown |
| `availabilityComputedAt` | Timestamp | (date) | When availability was calculated |
| `hasSufficientAvailability` | boolean | true | >= 2 overlap segments? |
| **Event Linkage** |
| `pendingEventId` | string \| null | "event123" | Which event this pair is in |
| **Timestamps** |
| `createdAt` | Timestamp | (date) | When pair was created |
| `updatedAt` | Timestamp | (date) | Last update |
| `lastActivityAt` | Timestamp | (date) | Last status change |

---

## Queue Status Meanings

```
'awaiting_availability' 
  → Not enough availability overlap (< 2 date-time segments)
  → Wait for users to add more availability

'awaiting_event_type'
  → Sufficient availability BUT no shared event interests
  → Users need to add common interests

'queued' ✓
  → Ready! Enough availability + shared event type
  → Waiting for other pairs to batch together

'in_event'
  → Already assigned to an event
  → EventId stored in pendingEventId field

'sidelined'
  → Unmatched or blocked
  → No longer considered for event creation
```

---

## Event Types (6 total)

| EventType | Interest Match | Template Config |
|-----------|----------------|-----------------|
| `coffee` | "Coffee Date" | 4 people (2 pairs) |
| `bar` | "Bars" | 4 people (2 pairs) |
| `restaurant` | "Restaurant" | 6 people (3 pairs) |
| `tennis` | "Tennis" | 4 people (2 pairs) |
| `dog_walking` | "Dog Walking" | 4 people (2 pairs) |
| `hiking` | "Hiking" | 4-6 people (2-3 pairs) |

---

## Event Creation Threshold

```
pairsRequired = floor(template.groupSize / 2)

Examples:
- groupSize 4 → need 2 pairs (4 people)
- groupSize 6 → need 3 pairs (6 people)
```

Until `pairsRequired` pairs are queued for an event type, NO event is created.

---

## Availability Overlap Calculation

### Input: Two Users' Availability

```typescript
// User profile availability format
user1.profile.availability = {
  "2025-10-20": { morning: true, afternoon: false, evening: true, night: false },
  "2025-10-21": { morning: false, afternoon: true, evening: true, night: false },
  // ... more dates
}

user2.profile.availability = {
  "2025-10-20": { morning: true, afternoon: true, evening: false, night: false },
  "2025-10-21": { morning: false, afternoon: false, evening: true, night: true },
  // ... more dates
}
```

### Overlap Computation

For each date, find matching time segments:

```
2025-10-20:
  User1: morning ✓, afternoon ✗, evening ✓, night ✗
  User2: morning ✓, afternoon ✓, evening ✗, night ✗
  OVERLAP: morning ✓ (1 segment)

2025-10-21:
  User1: morning ✗, afternoon ✓, evening ✓, night ✗
  User2: morning ✗, afternoon ✗, evening ✓, night ✓
  OVERLAP: evening ✓ (1 segment)
```

### Output: Availability Overlap

```
availabilityOverlapCount: 2
availabilityOverlapSegments: [
  { date: "2025-10-20", segments: ["morning"] },
  { date: "2025-10-21", segments: ["evening"] }
]
hasSufficientAvailability: true (>= 2 segments)
```

---

## Queued Pair → Event Creation Process

### 1. Query Queued Pairs (Cron Job)

```
FOR EACH eventType (coffee, bar, restaurant, tennis, dog_walking, hiking):
  Query pair_matches WHERE:
    ├─ queueStatus = 'queued'
    ├─ queueEventType = eventType
    └─ pendingEventId = null  (not already in event)
```

### 2. Check Threshold

```
queuedPairs.length >= pairsRequired ?
  YES → Create event
  NO  → Wait until more pairs queue up
```

### 3. Create Event

```
EXTRACT: First N pairs (where N = pairsRequired)
  └─ Sort by availabilityComputedAt (oldest first)
  └─ Take first N pairs

CREATE: events document with:
  ├─ eventType: [original type]
  ├─ pendingPairMatchIds: [pair1.id, pair2.id, ...]
  ├─ participantUserIds: [user1, user2, user3, user4, ...]
  ├─ participantStatuses: {user1: 'pending_join', user2: 'pending_join', ...}
  ├─ suggestedTimes: [aggregated from all pair availabilities]
  ├─ venueOptions: [3 venue choices]
  └─ status: 'pending_join'
```

### 4. Update pair_matches

```
FOR EACH pair in pairsForEvent:
  UPDATE pair_matches document:
    ├─ queueStatus: 'queued' → 'in_event'
    ├─ pendingEventId: null → 'event123'
    └─ lastActivityAt: [now]
```

### 5. Update users

```
FOR EACH unique participant:
  UPDATE users.pendingEvents:
    ├─ ADD: {
    │   eventId: 'event123',
    │   eventType: 'coffee',
    │   status: 'pending_join',
    │   assignedAt: [now],
    │   updatedAt: [now]
    │ }
    └─ Update pendingEventCount
```

---

## Cron Job Details

**Endpoint**: `POST /cron/auto-organize-events`
**Trigger**: Google Cloud Scheduler (every 15 minutes)
**Authentication**: Header `X-Cron-Secret: [env CRON_SECRET]`

**What it does**:
1. Calls `EventOrchestrationService.processAllQueues()`
2. For each event type, processes queued pairs
3. Creates new events when threshold met
4. Returns report of created events by type

**Return format**:
```json
{
  "success": true,
  "createdEvents": {
    "coffee": ["event123", "event456"],
    "bar": [],
    "restaurant": ["event789"],
    "tennis": [],
    "dog_walking": [],
    "hiking": []
  },
  "timestamp": "2025-10-18T14:30:00Z"
}
```

---

## Common Queries

### Query 1: Get all queued pairs for coffee events

```typescript
db.collection('pair_matches')
  .where('queueStatus', '==', 'queued')
  .where('queueEventType', '==', 'coffee')
  .orderBy('availabilityComputedAt', 'asc')
  .get()
```

### Query 2: Get pairs for a specific user

```typescript
db.collection('pair_matches')
  .where('userIds', 'array-contains', userId)
  .where('status', '==', 'active')
  .orderBy('lastActivityAt', 'desc')
  .get()
```

### Query 3: Get pairs waiting for availability

```typescript
db.collection('pair_matches')
  .where('queueStatus', '==', 'awaiting_availability')
  .orderBy('updatedAt', 'desc')
  .get()
```

### Query 4: Get pairs already in events

```typescript
db.collection('pair_matches')
  .where('queueStatus', '==', 'in_event')
  .where('pendingEventId', '!=', null)
  .get()
```

---

## Important Rules & Constraints

1. **Pair Creation**: Requires MUTUAL likes (both users swiped "like")
2. **Availability Must Be Future**: Past dates are automatically filtered
3. **Minimum Overlap**: 2 date-time segments required
4. **Shared Interests**: Must have at least 1 overlapping mapped event type
5. **User Deduplication**: Each user appears exactly once per event (even if in multiple pairs)
6. **FIFO Processing**: Pairs processed oldest-first (`availabilityComputedAt` sort)
7. **No Double Counting**: Pairs already in events (`in_event`) are skipped
8. **Group Size**: Determines how many pairs needed (groupSize / 2)

---

## State Machine

```
User A & B Swipe "Like" (mutual)
         ↓
PairMatchingService.upsertPairMatch()
         ↓
    Does overlap exist? (>= 2 segments)
    /                \
   NO                YES
   │                  │
   └→ 'awaiting_    Do shared event types exist?
       availability'   /              \
                     NO              YES
                     │               │
                     └→ 'awaiting_  └→ 'queued' ✓
                        event_type'   │
                                      ├─ Cron triggers
                                      │  every 15 mins
                                      │
                                      ├─ Enough pairs?
                                      │ /        \
                                      │ YES      NO (wait)
                                      │ │
                                      ├─→ Create event
                                      │   Update pair_matches
                                      │   to 'in_event'
                                      │
                                      └→ Link to event
                                         pendingEventId = 'event123'
```

---

## Files to Review

### Core Logic
- `/src/services/pair-matching.service.ts` - Creates/updates pair_matches
- `/src/services/event-orchestration.service.ts` - Orchestrates events from queues

### Controllers/Routes
- `/src/controllers/swipe.controller.ts` - Handles swipes and triggers pair creation
- `/src/routes/cron.routes.ts` - Cron job endpoint

### Utilities
- `/src/utils/availability.ts` - Overlap computation
- `/src/utils/eventMapping.ts` - Interest to event type mapping

### Config
- `/src/config/firebase.ts` - Collection definitions
- `/src/config/events.config.ts` - Event templates and venues

### Types
- `/src/types/index.ts` - PairMatch, Event, User interfaces

---

## Debugging Tips

**Issue: Pair stuck in 'awaiting_availability'**
- Check: User profiles have availability dates in future
- Check: Both users have at least 2 overlapping date-segments

**Issue: Pair stuck in 'awaiting_event_type'**
- Check: Both users share at least one interest
- Check: Shared interests map to an event type (see eventMapping.ts)

**Issue: No events created despite queued pairs**
- Check: Cron job URL is correct and authorized
- Check: CRON_SECRET header is set
- Check: Number of queued pairs >= pairsRequired for that event type

**Issue: pair_matches never created after mutual like**
- Check: Both users have complete profiles with availability
- Check: SwipeController.swipe() is being called
- Check: Database doesn't have write restrictions

**Issue: Users not getting pendingEvents**
- Check: Event creation ran successfully (check cron logs)
- Check: assignPendingEventToUser() ran without errors
- Verify: USERS collection has write permissions

---

## Example: Coffee Event Creation

```
Step 1 (User Action - ~T0s):
  Alice swipes "like" on Bob
  Bob already swiped "like" on Alice
  → MUTUAL MATCH

Step 2 (Pair Creation - ~T1s):
  PairMatchingService.upsertPairMatch(alice, bob)
  ├─ Availability overlap: 2 segments
  ├─ Shared interests: ["Coffee Date", "Hiking"]
  ├─ Mapped event types: ["coffee", "hiking"]
  └─ Creates pair_matches doc:
      {
        queueStatus: "queued",
        queueEventType: "coffee",
        pendingEventId: null
      }

Step 3 (Waiting - T1s to T600s):
  System waits for more pairs...
  Charlie & Diana also match → 2nd pair queued
  (Now have 2 pairs for coffee event, which needs exactly 2)

Step 4 (Cron Triggers - ~T600s):
  Google Cloud Scheduler calls /cron/auto-organize-events

Step 5 (Event Creation - ~T601s):
  EventOrchestrationService.processAllQueues()
  ├─ Query coffee pairs: finds 2 queued pairs
  ├─ Threshold check: 2 >= 2 ✓
  ├─ Creates events doc:
  │   {
  │     eventType: "coffee",
  │     pendingPairMatchIds: [pair1.id, pair2.id],
  │     participantUserIds: [alice, bob, charlie, diana],
  │     status: "pending_join"
  │   }
  └─ Returns eventId: "evt_abc123"

Step 6 (Pair Update - ~T602s):
  Updates both pair_matches docs:
  ├─ pair1: queueStatus "queued" → "in_event", pendingEventId → "evt_abc123"
  └─ pair2: queueStatus "queued" → "in_event", pendingEventId → "evt_abc123"

Step 7 (User Update - ~T603s):
  Updates users docs:
  ├─ alice.pendingEvents += {eventId: "evt_abc123", eventType: "coffee"}
  ├─ bob.pendingEvents += {eventId: "evt_abc123", eventType: "coffee"}
  ├─ charlie.pendingEvents += {eventId: "evt_abc123", eventType: "coffee"}
  └─ diana.pendingEvents += {eventId: "evt_abc123", eventType: "coffee"}

Result:
  ✓ Event created
  ✓ 4 users notified of pending event
  ✓ Pairs linked to event
```

---

## Collection Growth Pattern

```
Normal healthy state:

PAIR_MATCHES collection size grows as:
  └─ Mutual matches accumulate
  └─ Most will be in 'queued' state
  └─ Periodically consumed by cron job
  └─ Status changed to 'in_event'

EVENTS collection size grows as:
  └─ Cron job creates events from queued pairs
  └─ Multiple events per day per event type
  └─ Eventually marked 'completed' or 'canceled'

USERS.pendingEvents grows as:
  └─ Users assigned to events
  └─ Array keeps building until event is resolved
  └─ Entry status changes: pending_join → joined → completed
```

---

