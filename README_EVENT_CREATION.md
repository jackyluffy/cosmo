# Cosmo Event Creation System - Complete Documentation

This folder contains comprehensive documentation on how events are created from the `pair_matches` table in the Cosmo backend.

## Quick Start

If you're in a hurry, start here:
- **PAIR_MATCHES_QUICK_REFERENCE.md** - TL;DR guide with essential info and tables

## Complete Documentation

For detailed understanding, read in this order:

1. **PAIR_MATCHES_QUICK_REFERENCE.md** (10 min read)
   - Quick overview
   - pair_matches schema
   - Queue status meanings
   - Common queries and debugging tips

2. **EVENT_CREATION_DIAGRAM.txt** (15 min read)
   - Visual flow diagrams
   - Stage-by-stage breakdown
   - ASCII art representations
   - Collection relationships

3. **EVENT_CREATION_ANALYSIS.md** (30 min read)
   - Comprehensive analysis
   - Complete code walkthroughs
   - Data flow architecture
   - File-by-file breakdown
   - End-to-end examples

## Architecture Overview

```
STAGE 1: PAIR MATCH CREATION
  User A + User B mutual swipe "like"
  └─ SwipeController.swipe()
     └─ PairMatchingService.upsertPairMatch()
        └─ Create pair_matches document

STAGE 2: QUEUE STATUS DETERMINATION
  ├─ Check availability overlap (>= 2 segments)
  ├─ Check shared event types
  └─ Set queueStatus: 'queued' | 'awaiting_availability' | 'awaiting_event_type'

STAGE 3: SCHEDULED PROCESSING
  Google Cloud Scheduler (every 15 minutes)
  └─ POST /cron/auto-organize-events
     └─ EventOrchestrationService.processAllQueues()
        ├─ Query queued pairs by event type
        ├─ Check threshold (enough pairs?)
        └─ If YES: Create event

STAGE 4: CASCADE UPDATES
  ├─ Create events document
  ├─ Update pair_matches: queueStatus → 'in_event'
  └─ Update users: add to pendingEvents[]
```

## Key Files

### Core Services
- `/src/services/pair-matching.service.ts` - Pair creation and querying
- `/src/services/event-orchestration.service.ts` - Event creation from queues

### Controllers & Routes
- `/src/controllers/swipe.controller.ts` - Swipe handling
- `/src/routes/cron.routes.ts` - Cron job endpoint

### Configuration
- `/src/config/firebase.ts` - Collection definitions
- `/src/config/events.config.ts` - Event templates

### Utilities
- `/src/utils/availability.ts` - Availability overlap logic
- `/src/utils/eventMapping.ts` - Interest to event type mapping

## Critical Concepts

### Queue Status
- `awaiting_availability` - Not enough availability overlap
- `awaiting_event_type` - Availability OK, but no shared interests
- `queued` - Ready for event creation
- `in_event` - Already assigned to event
- `sidelined` - Unmatched/inactive

### Event Creation Threshold
```
Events created when:
  queuedPairs.length >= floor(template.groupSize / 2)

Example:
  groupSize 4 → need 2 pairs (4 people)
  groupSize 6 → need 3 pairs (6 people)
```

### Availability Overlap
```
Minimum required: 2 date-time segments

A segment = 1 date + 1 time period (morning/afternoon/evening/night)

Example:
  2025-10-20 morning = 1 segment
  2025-10-20 evening = 1 segment (different time)
  2025-10-21 afternoon = 1 segment (different date)
```

## Common Questions

**Q: How often are events created?**
A: Cron job runs every 15 minutes. Events created when enough queued pairs exist.

**Q: Why is my pair stuck in 'awaiting_availability'?**
A: Pairs need 2+ overlapping date-time segments. Check user availability profiles.

**Q: Why hasn't my pair moved to 'queued' status?**
A: Either:
1. Insufficient availability overlap (< 2 segments)
2. No shared event interests mapped

**Q: How long until an event is created after matching?**
A: 
- Pair created immediately upon mutual like
- Event created when threshold met (could be 15 min to hours)
- Depends on queue status and other pairs

**Q: Can a user be in multiple pair_matches?**
A: Yes! A user can match with multiple people. Each match is a separate pair_match document.

**Q: Can a user be in multiple events?**
A: Yes! A user's pendingEvents array holds multiple event assignments.

## Database Collections

### PAIR_MATCHES
```
{
  id, pairKey, userIds,
  status, queueStatus,
  sharedEventTypes, queueEventType,
  availabilityOverlapCount, availabilityOverlapSegments,
  hasSufficientAvailability,
  pendingEventId,
  createdAt, updatedAt, lastActivityAt
}
```

### EVENTS
```
{
  id, title, eventType,
  status,
  pendingPairMatchIds,
  participantUserIds,
  participantStatuses,
  suggestedTimes,
  venueOptions,
  createdAt, updatedAt, autoOrganized
  ... (many more fields)
}
```

### USERS (relevant fields)
```
{
  id, profile: {
    interests, availability, ...
  },
  pendingEvents: [{
    eventId, eventType, status, ...
  }],
  pendingEventCount,
  ...
}
```

## Troubleshooting Checklist

- [ ] Users have complete profiles with interests
- [ ] Users have availability dates set (in future)
- [ ] Swipes are mutual (both liked each other)
- [ ] Cron job endpoint is reachable
- [ ] CRON_SECRET header matches environment variable
- [ ] Database has write permissions
- [ ] Availability overlap is >= 2 segments
- [ ] Shared interests map to event types
- [ ] Enough queued pairs for event threshold

## Monitoring & Debugging

### View pair_matches in Firestore
```
Collection: pair_matches
Filter: queueStatus == 'queued'
```

### View created events
```
Collection: events
Filter: autoOrganized == true
```

### Check user pending events
```
Collection: users
Select any user document
View: pendingEvents array
```

### Test cron job manually
```
curl -X POST http://localhost:3000/cron/auto-organize-events \
  -H "X-Cron-Secret: your-cron-secret"
```

## Performance Considerations

- Cron job processes all 6 event types sequentially
- Database queries filter by queueStatus and queueEventType
- Firestore indexes required for efficient querying
- Batch updates reduce write operations
- Consider implementing rate limiting for high-volume scenarios

## Future Enhancements

1. Advanced matching algorithms based on personality traits
2. ML-based compatibility scoring
3. Time zone handling for global users
4. Group formation preferences
5. Event cancellation and rescheduling logic
6. User feedback loop for matching improvement

## Support & Questions

Refer to the detailed analysis documents:
- See specific code: `EVENT_CREATION_ANALYSIS.md` (Section 12: File Locations)
- See visual flow: `EVENT_CREATION_DIAGRAM.txt` (Stages 1-4)
- See quick lookup: `PAIR_MATCHES_QUICK_REFERENCE.md` (Debugging Tips)

---

Generated: 2025-10-18
Last Updated: Current
