"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventController = void 0;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const events_config_1 = require("../config/events.config");
const event_participation_service_1 = require("../services/event-participation.service");
class EventController {
    /**
     * Get all available events
     * GET /events
     */
    static async getEvents(req, res) {
        try {
            const { category, maxDistance, minAge, maxAge } = req.query;
            const userLocation = req.user?.profile?.location;
            // For now, return empty array if there are no events
            // The query requires a composite index on (status, date)
            // If you want to use this, create the index first
            let events = [];
            try {
                let query = firebase_1.db.collection(firebase_1.Collections.EVENTS)
                    .where('status', '==', 'published')
                    .where('date', '>', firestore_1.Timestamp.now())
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
                }));
                // Filter by distance if location is available
                if (userLocation && maxDistance) {
                    const maxDistanceKm = Number(maxDistance);
                    events = events.filter(event => {
                        const distance = this.calculateDistance(userLocation, event.location.coordinates);
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
            }
            catch (queryError) {
                // If index doesn't exist, just return empty array
                console.log('Events query failed (likely missing index):', queryError.message);
                events = [];
            }
            return res.status(200).json({
                success: true,
                data: events,
            });
        }
        catch (error) {
            console.error('Get events error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch events',
            });
        }
    }
    /**
     * Get event by ID
     * GET /events/:id
     */
    static async getEvent(req, res) {
        try {
            const { id } = req.params;
            const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(id).get();
            if (!eventDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Event not found',
                });
            }
            const event = { id: eventDoc.id, ...eventDoc.data() };
            // Get groups for this event
            const groupsSnapshot = await firebase_1.db.collection(firebase_1.Collections.GROUPS)
                .where('eventId', '==', id)
                .get();
            const groups = groupsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            return res.status(200).json({
                success: true,
                data: { ...event, groups },
            });
        }
        catch (error) {
            console.error('Get event error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch event',
            });
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
    static async createEvent(req, res) {
        try {
            const userId = req.userId;
            const { useTemplate, templateType } = req.body;
            let eventData;
            if (useTemplate) {
                // Template-based event creation
                if (!templateType) {
                    return res.status(400).json({
                        success: false,
                        error: 'templateType is required when useTemplate is true',
                    });
                }
                if (!req.body.date) {
                    return res.status(400).json({
                        success: false,
                        error: 'date is required',
                    });
                }
                // Get random template of specified type
                const templates = (0, events_config_1.getEventTemplatesByType)(templateType);
                if (templates.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: `No templates found for type: ${templateType}`,
                    });
                }
                const template = templates[Math.floor(Math.random() * templates.length)];
                const eventDate = new Date(req.body.date);
                // Validate date is in future
                if (eventDate <= new Date()) {
                    return res.status(400).json({
                        success: false,
                        error: 'Event date must be in the future',
                    });
                }
                // Build event from template
                eventData = {
                    title: template.title,
                    description: template.description,
                    category: template.category,
                    date: firestore_1.Timestamp.fromDate(eventDate),
                    location: {
                        name: template.venue.name,
                        address: template.venue.address,
                        coordinates: new firestore_1.GeoPoint(template.venue.lat, template.venue.lng),
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
                    createdAt: firestore_1.Timestamp.now(),
                    updatedAt: firestore_1.Timestamp.now(),
                    reminderSent: false,
                    reminderSentAt: null,
                    chatRoomId: null,
                    confirmationsReceived: 0,
                };
            }
            else {
                // Custom event creation
                const { title, description, category, date, location, maxGroupsCount, pricePerPerson, ageRange, } = req.body;
                // Validate required fields
                if (!title || !description || !category || !date || !location) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields',
                    });
                }
                // Validate date is in future
                const eventDate = new Date(date);
                if (eventDate <= new Date()) {
                    return res.status(400).json({
                        success: false,
                        error: 'Event date must be in the future',
                    });
                }
                // Create event from request body
                eventData = {
                    title,
                    description,
                    category: category,
                    date: firestore_1.Timestamp.fromDate(eventDate),
                    location: {
                        name: location.name,
                        address: location.address,
                        coordinates: new firestore_1.GeoPoint(location.lat, location.lng),
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
                    createdAt: firestore_1.Timestamp.now(),
                    updatedAt: firestore_1.Timestamp.now(),
                    reminderSent: false,
                    reminderSentAt: null,
                    chatRoomId: null,
                    confirmationsReceived: 0,
                };
            }
            const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).add(eventData);
            return res.status(201).json({
                success: true,
                data: { id: eventDoc.id, ...eventData },
                message: 'Event created successfully',
            });
        }
        catch (error) {
            console.error('Create event error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to create event',
            });
        }
    }
    /**
     * Join event
     * POST /events/:id/join
     */
    static async joinEvent(req, res) {
        try {
            const user = req.user;
            const userId = user.id;
            const { id: eventId } = req.params;
            const { venueOptionId } = req.body;
            const subscription = user.subscription;
            const canJoin = subscription?.status === 'active' ||
                (subscription?.status === 'trial' &&
                    !(subscription?.trialEventUsed ||
                        subscription?.trial_event_used));
            if (!canJoin) {
                return res.status(403).json({
                    success: false,
                    error: 'An active subscription is required to join events.',
                });
            }
            const { event, participant } = await event_participation_service_1.EventParticipationService.joinEvent(eventId, user);
            let voteParticipant = null;
            let updatedEvent = event;
            if (venueOptionId) {
                const voteResult = await event_participation_service_1.EventParticipationService.submitVote(eventId, userId, venueOptionId);
                updatedEvent = voteResult.event;
                voteParticipant = voteResult.participant;
            }
            if (subscription.status === 'trial' && !subscription.trialEventUsed) {
                await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
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
            });
        }
        catch (error) {
            console.error('Join event error:', error);
            const errorMessage = error?.message || 'Failed to join event';
            if (errorMessage.includes('temporarily unable')) {
                return res.status(403).json({
                    success: false,
                    error: errorMessage,
                });
            }
            return res.status(500).json({
                success: false,
                error: errorMessage,
            });
        }
    }
    /**
     * Leave event
     * DELETE /events/:id/leave
     */
    static async leaveEvent(req, res) {
        try {
            const user = req.user;
            const { id: eventId } = req.params;
            await event_participation_service_1.EventParticipationService.cancelParticipation(eventId, user);
            return res.status(200).json({
                success: true,
                message: 'Successfully left the event',
            });
        }
        catch (error) {
            console.error('Leave event error:', error);
            return res.status(500).json({
                success: false,
                error: error?.message || 'Failed to leave event',
            });
        }
    }
    /**
     * Submit a venue vote for an event
     * POST /events/:id/votes
     */
    static async voteOnEvent(req, res) {
        try {
            const userId = req.userId;
            const { id: eventId } = req.params;
            const { venueOptionId } = req.body;
            const { event, participant } = await event_participation_service_1.EventParticipationService.submitVote(eventId, userId, venueOptionId);
            return res.status(200).json({
                success: true,
                data: {
                    event,
                    participant,
                },
                message: 'Vote recorded successfully.',
            });
        }
        catch (error) {
            console.error('Vote on event error:', error);
            return res.status(500).json({
                success: false,
                error: error?.message || 'Failed to record vote',
            });
        }
    }
    /**
     * Confirm or cancel attendance after reminder
     * POST /events/:id/confirm
     */
    static async confirmAttendance(req, res) {
        try {
            const user = req.user;
            const { id: eventId } = req.params;
            const { action } = req.body;
            const normalizedAction = action === 'cancel' ? 'cancel' : 'confirm';
            const { event, participant } = await event_participation_service_1.EventParticipationService.respondToReminder(eventId, user, normalizedAction);
            return res.status(200).json({
                success: true,
                data: {
                    event,
                    participant,
                },
                message: normalizedAction === 'confirm'
                    ? 'Attendance confirmed. See you there!'
                    : 'We saved your cancellation. We will find a replacement.',
            });
        }
        catch (error) {
            console.error('Confirm attendance error:', error);
            return res.status(500).json({
                success: false,
                error: error?.message || 'Failed to update attendance',
            });
        }
    }
    /**
     * Get pending event assignments for the current user
     * GET /events/assignments/me
     */
    static async getAssignments(req, res) {
        try {
            const user = req.user;
            const assignments = (user.pendingEvents || []);
            const enrichedAssignments = await Promise.all(assignments.map(async (assignment) => {
                const eventSnap = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(assignment.eventId).get();
                if (!eventSnap.exists) {
                    return null;
                }
                const event = { id: eventSnap.id, ...eventSnap.data() };
                const participantDocId = `${assignment.eventId}_${user.id}`;
                const participantSnap = await firebase_1.db
                    .collection(firebase_1.Collections.EVENT_PARTICIPANTS)
                    .doc(participantDocId)
                    .get();
                const participant = participantSnap.exists
                    ? { id: participantSnap.id, ...participantSnap.data() }
                    : null;
                return {
                    assignment,
                    event,
                    participant,
                };
            }));
            const results = enrichedAssignments.filter((item) => item !== null);
            const subscription = user.subscription;
            const trialUsed = subscription?.trialEventUsed ||
                subscription?.trial_event_used ||
                false;
            const canJoinSubscription = subscription?.status === 'active' ||
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
            });
        }
        catch (error) {
            console.error('Get assignments error:', error);
            return res.status(500).json({
                success: false,
                error: error?.message || 'Failed to fetch assignments',
            });
        }
    }
    /**
     * Update event
     */
    static async updateEvent(req, res) {
        try {
            const userId = req.userId;
            const eventId = req.params.id;
            const updates = req.body;
            // Get event
            const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId).get();
            if (!eventDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Event not found',
                });
            }
            const event = eventDoc.data();
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
        }
        catch (error) {
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
    static async cancelEvent(req, res) {
        try {
            const userId = req.userId;
            const eventId = req.params.id;
            // Get event
            const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId).get();
            if (!eventDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Event not found',
                });
            }
            const event = eventDoc.data();
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
        }
        catch (error) {
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
    static async getRecommendedEvents(req, res) {
        try {
            const userId = req.userId;
            // Get user profile
            const userDoc = await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).get();
            const user = userDoc.data();
            // Get all upcoming events
            const eventsSnapshot = await firebase_1.db.collection(firebase_1.Collections.EVENTS)
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
        }
        catch (error) {
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
    static async getMyEvents(req, res) {
        try {
            const userId = req.userId;
            // Get events created by user
            const createdSnapshot = await firebase_1.db.collection(firebase_1.Collections.EVENTS)
                .where('createdBy', '==', userId)
                .get();
            // Get events user has joined
            const joinedSnapshot = await firebase_1.db.collection(firebase_1.Collections.EVENTS)
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
        }
        catch (error) {
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
    static calculateDistance(point1, point2) {
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
exports.EventController = EventController;
//# sourceMappingURL=event.controller.js.map