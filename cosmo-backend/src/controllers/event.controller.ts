import { Request, Response } from 'express';
import { db, Collections } from '../config/firebase';
import { ApiResponse, Event, EventCategory, EventParticipant, PendingEventAssignment, User } from '../types';
import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { getEventTemplatesByType } from '../config/events.config';
import { EventParticipationService } from '../services/event-participation.service';

export class EventController {
  /**
   * Get all available events
   * GET /events
   */
  static async getEvents(req: Request, res: Response) {
    try {
      const { category, maxDistance, minAge, maxAge } = req.query;
      const userLocation = req.user?.profile?.location;

      // For now, return empty array if there are no events
      // The query requires a composite index on (status, date)
      // If you want to use this, create the index first
      let events: Event[] = [];

      try {
        let query = db.collection(Collections.EVENTS)
          .where('status', '==', 'published')
          .where('date', '>', Timestamp.now())
          .orderBy('date', 'asc')
          .limit(50);

        // Filter by category if provided
        if (category) {
          query = query.where('category', '==', category);
        }

        const snapshot = await query.get();
        events = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[];

        // Filter by distance if location is available
        if (userLocation && maxDistance) {
          const maxDistanceKm = Number(maxDistance);
          events = events.filter(event => {
            const distance = this.calculateDistance(
              userLocation,
              event.location.coordinates
            );
            return distance <= maxDistanceKm;
          });
        }

        // Filter by age range
        if (minAge || maxAge) {
          events = events.filter(event => {
            const userAge = req.user?.profile?.age || 25;
            return userAge >= (event.ageRange?.min || 18) &&
                   userAge <= (event.ageRange?.max || 100);
          });
        }
      } catch (queryError: any) {
        // If index doesn't exist, just return empty array
        console.log('Events query failed (likely missing index):', queryError.message);
        events = [];
      }

      return res.status(200).json({
        success: true,
        data: events,
      } as ApiResponse);
    } catch (error: any) {
      console.error('Get events error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch events',
      } as ApiResponse);
    }
  }

  /**
   * Get event by ID
   * GET /events/:id
   */
  static async getEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const eventDoc = await db.collection(Collections.EVENTS).doc(id).get();

      if (!eventDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        } as ApiResponse);
      }

      const event = { id: eventDoc.id, ...eventDoc.data() } as Event;

      // Get groups for this event
      const groupsSnapshot = await db.collection(Collections.GROUPS)
        .where('eventId', '==', id)
        .get();

      const groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({
        success: true,
        data: { ...event, groups },
      } as ApiResponse);
    } catch (error: any) {
      console.error('Get event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch event',
      } as ApiResponse);
    }
  }

  /**
   * Create new event (for organizers)
   * POST /events
   *
   * Supports two modes:
   * 1. Template-based: Pass { useTemplate: true, templateType: 'tennis' | 'bar' | 'brunch' | 'dinner' | 'hiking', date }
   * 2. Custom: Pass { title, description, category, date, location, ... }
   */
  static async createEvent(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { useTemplate, templateType } = req.body;

      let eventData: Partial<Event>;

      if (useTemplate) {
        // Template-based event creation
        if (!templateType) {
          return res.status(400).json({
            success: false,
            error: 'templateType is required when useTemplate is true',
          } as ApiResponse);
        }

        if (!req.body.date) {
          return res.status(400).json({
            success: false,
            error: 'date is required',
          } as ApiResponse);
        }

        // Get random template of specified type
        const templates = getEventTemplatesByType(templateType);
        if (templates.length === 0) {
          return res.status(400).json({
            success: false,
            error: `No templates found for type: ${templateType}`,
          } as ApiResponse);
        }

        const template = templates[Math.floor(Math.random() * templates.length)];
        const eventDate = new Date(req.body.date);

        // Validate date is in future
        if (eventDate <= new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Event date must be in the future',
          } as ApiResponse);
        }

        // Build event from template
        eventData = {
          title: template.title,
          description: template.description,
          category: template.category as EventCategory,
          date: Timestamp.fromDate(eventDate),
          location: {
            name: template.venue.name,
            address: template.venue.address,
            coordinates: new GeoPoint(template.venue.lat, template.venue.lng),
          },
          organizer: {
            id: userId,
            name: req.user.profile?.name || 'Organizer',
          },
          groups: [],
          maxGroupsCount: 10,
          pricePerPerson: Math.floor(Math.random() * (template.priceRange.max - template.priceRange.min + 1)) + template.priceRange.min,
          ageRange: template.ageRange,
          status: 'draft',
          photos: template.venue.photos,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          reminderSent: false,
          reminderSentAt: null,
          chatRoomId: null,
          confirmationsReceived: 0,
        };
      } else {
        // Custom event creation
        const {
          title,
          description,
          category,
          date,
          location,
          maxGroupsCount,
          pricePerPerson,
          ageRange,
        } = req.body;

        // Validate required fields
        if (!title || !description || !category || !date || !location) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields',
          } as ApiResponse);
        }

        // Validate date is in future
        const eventDate = new Date(date);
        if (eventDate <= new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Event date must be in the future',
          } as ApiResponse);
        }

        // Create event from request body
        eventData = {
          title,
          description,
          category: category as EventCategory,
          date: Timestamp.fromDate(eventDate),
          location: {
            name: location.name,
            address: location.address,
            coordinates: new GeoPoint(location.lat, location.lng),
          },
          organizer: {
            id: userId,
            name: req.user.profile?.name || 'Organizer',
          },
          groups: [],
          maxGroupsCount: maxGroupsCount || 10,
          pricePerPerson: pricePerPerson || 0,
          ageRange: ageRange || { min: 18, max: 100 },
          status: 'draft',
          photos: [],
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          reminderSent: false,
          reminderSentAt: null,
          chatRoomId: null,
          confirmationsReceived: 0,
        };
      }

      const eventDoc = await db.collection(Collections.EVENTS).add(eventData);

      return res.status(201).json({
        success: true,
        data: { id: eventDoc.id, ...eventData },
        message: 'Event created successfully',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Create event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create event',
      } as ApiResponse);
    }
  }

  /**
   * Join event
   * POST /events/:id/join
   */
  static async joinEvent(req: Request, res: Response) {
    try {
      const user = req.user as User;
      const userId = user.id;
      const { id: eventId } = req.params;
      const { venueOptionId } = req.body;

      const subscription = user.subscription;
      const canJoin =
        subscription?.status === 'active' ||
        (subscription?.status === 'trial' &&
          !(
            subscription?.trialEventUsed ||
            (subscription as any)?.trial_event_used
          ));

      if (!canJoin) {
        return res.status(403).json({
          success: false,
          error: 'An active subscription is required to join events.',
        } as ApiResponse);
      }

      const { event, participant } = await EventParticipationService.joinEvent(eventId, user);

      let voteParticipant: EventParticipant | null = null;
      let updatedEvent = event;

      if (venueOptionId) {
        const voteResult = await EventParticipationService.submitVote(eventId, userId, venueOptionId);
        updatedEvent = voteResult.event;
        voteParticipant = voteResult.participant;
      }

      if (subscription.status === 'trial' && !subscription.trialEventUsed) {
        await db.collection(Collections.USERS).doc(userId).update({
          'subscription.trialEventUsed': true,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          event: updatedEvent,
          participant: voteParticipant || participant,
        },
        message: venueOptionId
          ? 'Joined event and recorded vote.'
          : 'Joined event successfully.',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Join event error:', error);
      const errorMessage = error?.message || 'Failed to join event';
      if (errorMessage.includes('temporarily unable')) {
        return res.status(403).json({
          success: false,
          error: errorMessage,
        } as ApiResponse);
      }
      return res.status(500).json({
        success: false,
        error: errorMessage,
      } as ApiResponse);
    }
  }

  /**
   * Leave event
   * DELETE /events/:id/leave
   */
  static async leaveEvent(req: Request, res: Response) {
    try {
      const user = req.user as User;
      const { id: eventId } = req.params;

      await EventParticipationService.cancelParticipation(eventId, user);

      return res.status(200).json({
        success: true,
        message: 'Successfully left the event',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Leave event error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to leave event',
      } as ApiResponse);
    }
  }

  /**
   * Submit a venue vote for an event
   * POST /events/:id/votes
   */
  static async voteOnEvent(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { id: eventId } = req.params;
      const { venueOptionId } = req.body;

      const { event, participant } = await EventParticipationService.submitVote(
        eventId,
        userId,
        venueOptionId
      );

      return res.status(200).json({
        success: true,
        data: {
          event,
          participant,
        },
        message: 'Vote recorded successfully.',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Vote on event error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to record vote',
      } as ApiResponse);
    }
  }

  /**
   * Confirm or cancel attendance after reminder
   * POST /events/:id/confirm
   */
  static async confirmAttendance(req: Request, res: Response) {
    try {
      const user = req.user as User;
      const { id: eventId } = req.params;
      const { action } = req.body as { action: 'confirm' | 'cancel' };

      const normalizedAction = action === 'cancel' ? 'cancel' : 'confirm';

      const { event, participant } = await EventParticipationService.respondToReminder(
        eventId,
        user,
        normalizedAction
      );

      return res.status(200).json({
        success: true,
        data: {
          event,
          participant,
        },
        message:
          normalizedAction === 'confirm'
            ? 'Attendance confirmed. See you there!'
            : 'We saved your cancellation. We will find a replacement.',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Confirm attendance error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to update attendance',
      } as ApiResponse);
    }
  }

  /**
   * Get pending event assignments for the current user
   * GET /events/assignments/me
   */
  static async getAssignments(req: Request, res: Response) {
    try {
      const user = req.user as User;
      const assignments = (user.pendingEvents || []) as PendingEventAssignment[];

      type AssignmentView = {
        assignment: PendingEventAssignment;
        event: Event;
        participant: EventParticipant | null;
      };

      const enrichedAssignments = await Promise.all(
        assignments.map(async (assignment) => {
          const eventSnap = await db.collection(Collections.EVENTS).doc(assignment.eventId).get();
          if (!eventSnap.exists) {
            return null;
          }
          const event = { id: eventSnap.id, ...eventSnap.data() } as Event;

          const participantDocId = `${assignment.eventId}_${user.id}`;
          const participantSnap = await db
            .collection(Collections.EVENT_PARTICIPANTS)
            .doc(participantDocId)
            .get();

          const participant = participantSnap.exists
            ? ({ id: participantSnap.id, ...participantSnap.data() } as EventParticipant)
            : null;

          return {
            assignment,
            event,
            participant,
          } as AssignmentView;
        })
      );

      const results = enrichedAssignments.filter(
        (item): item is AssignmentView => item !== null
      );

      const subscription = user.subscription;
      const trialUsed =
        subscription?.trialEventUsed ||
        (subscription as any)?.trial_event_used ||
        false;
      const canJoinSubscription =
        subscription?.status === 'active' ||
        (subscription?.status === 'trial' && !trialUsed);

      const banUntil = user.eventBanUntil?.toDate?.();
      const canJoin = canJoinSubscription && (!banUntil || banUntil <= new Date());

      return res.status(200).json({
        success: true,
        data: {
          assignments: results,
          pendingEventCount: user.pendingEventCount ?? results.length,
          canJoin,
        },
      } as ApiResponse);
    } catch (error: any) {
      console.error('Get assignments error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to fetch assignments',
      } as ApiResponse);
    }
  }

  /**
   * Update event
   */
  static async updateEvent(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const eventId = req.params.id;
      const updates = req.body;

      // Get event
      const eventDoc = await db.collection(Collections.EVENTS).doc(eventId).get();

      if (!eventDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        });
      }

      const event = eventDoc.data() as any;

      // Check if user is creator
      if (event.createdBy !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only event creator can update the event',
        });
      }

      // Update event
      await eventDoc.ref.update({
        ...updates,
        updatedAt: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully',
      });
    } catch (error: any) {
      console.error('Update event error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update event',
      });
    }
  }

  /**
   * Cancel event
   */
  static async cancelEvent(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const eventId = req.params.id;

      // Get event
      const eventDoc = await db.collection(Collections.EVENTS).doc(eventId).get();

      if (!eventDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        });
      }

      const event = eventDoc.data() as any;

      // Check if user is creator
      if (event.createdBy !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only event creator can cancel the event',
        });
      }

      // Cancel event (soft delete)
      await eventDoc.ref.update({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      });

      return res.status(200).json({
        success: true,
        message: 'Event cancelled successfully',
      });
    } catch (error: any) {
      console.error('Cancel event error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to cancel event',
      });
    }
  }

  /**
   * Get recommended events for user
   */
  static async getRecommendedEvents(req: Request, res: Response) {
    try {
      const userId = req.userId!;

      // Get user profile
      const userDoc = await db.collection(Collections.USERS).doc(userId).get();
      const user = userDoc.data() as any;

      // Get all upcoming events
      const eventsSnapshot = await db.collection(Collections.EVENTS)
        .where('date', '>=', new Date())
        .where('status', '==', 'active')
        .limit(20)
        .get();

      const events = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (error: any) {
      console.error('Get recommended events error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get recommended events',
      });
    }
  }

  /**
   * Get user's events (created and joined)
   */
  static async getMyEvents(req: Request, res: Response) {
    try {
      const userId = req.userId!;

      // Get events created by user
      const createdSnapshot = await db.collection(Collections.EVENTS)
        .where('createdBy', '==', userId)
        .get();

      // Get events user has joined
      const joinedSnapshot = await db.collection(Collections.EVENTS)
        .where('participants', 'array-contains', userId)
        .get();

      const createdEvents = createdSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'created'
      }));

      const joinedEvents = joinedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'joined'
      }));

      return res.status(200).json({
        success: true,
        data: {
          created: createdEvents,
          joined: joinedEvents,
        },
      });
    } catch (error: any) {
      console.error('Get my events error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get your events',
      });
    }
  }

  /**
   * Calculate distance between two points
   */
  private static calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const R = 6371; // Earth's radius in km
    const lat1Rad = point1.latitude * Math.PI / 180;
    const lat2Rad = point2.latitude * Math.PI / 180;
    const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
