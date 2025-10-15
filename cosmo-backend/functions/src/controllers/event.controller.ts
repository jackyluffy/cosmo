import { Request, Response } from 'express';
import { db, Collections } from '../config/firebase';
import { ApiResponse, Event, EventCategory } from '../types';
import { Timestamp, GeoPoint, FieldValue } from 'firebase-admin/firestore';
import { Constants } from '../config/constants';

export class EventController {
  /**
   * Get all available events
   * GET /events
   */
  static async getEvents(req: Request, res: Response) {
    try {
      const { category, maxDistance, minAge, maxAge } = req.query;
      const userLocation = req.user?.profile?.location;

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
      let events = snapshot.docs.map(doc => ({
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
   */
  static async createEvent(req: Request, res: Response) {
    try {
      const userId = req.userId!;
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

      // Create event
      const newEvent: Partial<Event> = {
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
      };

      const eventDoc = await db.collection(Collections.EVENTS).add(newEvent);

      return res.status(201).json({
        success: true,
        data: { id: eventDoc.id, ...newEvent },
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
      const userId = req.userId!;
      const { id: eventId } = req.params;
      const { preferences } = req.body;

      // Check if event exists
      const eventDoc = await db.collection(Collections.EVENTS).doc(eventId).get();
      if (!eventDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Event not found',
        } as ApiResponse);
      }

      const event = eventDoc.data() as Event;

      // Check if event is still open
      if (event.status !== 'published') {
        return res.status(400).json({
          success: false,
          error: 'Event is not available for joining',
        } as ApiResponse);
      }

      // Check if user already joined
      const existingMatch = await db.collection(Collections.MATCHES)
        .where('userId', '==', userId)
        .where('eventId', '==', eventId)
        .where('status', 'in', ['pending', 'matched'])
        .limit(1)
        .get();

      if (!existingMatch.empty) {
        return res.status(400).json({
          success: false,
          error: 'You have already joined this event',
        } as ApiResponse);
      }

      // Check subscription limits
      const subscription = req.user.subscription;
      if (subscription.status === 'trial' && subscription.trialEventUsed) {
        return res.status(403).json({
          success: false,
          error: 'Trial event already used. Please upgrade to continue.',
        } as ApiResponse);
      }

      // Create match entry
      const matchData = {
        userId,
        eventId,
        status: 'pending',
        preferences: preferences || {
          ageRange: { min: 18, max: 100 },
          genderPreference: ['male', 'female', 'other'],
          interests: req.user.profile?.interests || [],
        },
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(new Date(event.date.toDate().getTime() - 24 * 60 * 60 * 1000)), // 1 day before event
      };

      const matchDoc = await db.collection(Collections.MATCHES).add(matchData);

      // Update trial status if needed
      if (subscription.status === 'trial' && !subscription.trialEventUsed) {
        await db.collection(Collections.USERS).doc(userId).update({
          'subscription.trialEventUsed': true,
        });
      }

      return res.status(201).json({
        success: true,
        data: { matchId: matchDoc.id, ...matchData },
        message: 'Successfully joined event. We\'ll notify you when a group is formed!',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Join event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to join event',
      } as ApiResponse);
    }
  }

  /**
   * Leave event
   * DELETE /events/:id/leave
   */
  static async leaveEvent(req: Request, res: Response) {
    try {
      const userId = req.userId!;
      const { id: eventId } = req.params;

      // Find user's match
      const matchSnapshot = await db.collection(Collections.MATCHES)
        .where('userId', '==', userId)
        .where('eventId', '==', eventId)
        .where('status', 'in', ['pending', 'matched'])
        .limit(1)
        .get();

      if (matchSnapshot.empty) {
        return res.status(404).json({
          success: false,
          error: 'You have not joined this event',
        } as ApiResponse);
      }

      const matchDoc = matchSnapshot.docs[0];
      const matchData = matchDoc.data();

      // Check if user is already in a group
      if (matchData.groupId) {
        // Remove from group
        const groupDoc = await db.collection(Collections.GROUPS)
          .doc(matchData.groupId)
          .get();

        if (groupDoc.exists) {
          const groupData = groupDoc.data();
          const updatedMembers = groupData?.members.filter(
            (member: any) => member.userId !== userId
          );

          await groupDoc.ref.update({
            members: updatedMembers,
            updatedAt: Timestamp.now(),
          });

          // If group is too small, disband it
          if (updatedMembers.length < Constants.MIN_GROUP_SIZE) {
            await groupDoc.ref.update({
              status: 'disbanded',
            });

            // Notify other members
            // TODO: Send notifications
          }
        }
      }

      // Update match status
      await matchDoc.ref.update({
        status: 'rejected',
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({
        success: true,
        message: 'Successfully left the event',
      } as ApiResponse);
    } catch (error: any) {
      console.error('Leave event error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to leave event',
      } as ApiResponse);
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