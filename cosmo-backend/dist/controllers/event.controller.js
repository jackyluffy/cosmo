"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventController = void 0;
const firebase_1 = require("../config/firebase");
const firestore_1 = require("firebase-admin/firestore");
const constants_1 = require("../config/constants");
const events_config_1 = require("../config/events.config");
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
            const userId = req.userId;
            const { id: eventId } = req.params;
            const { preferences } = req.body;
            // Check if event exists
            const eventDoc = await firebase_1.db.collection(firebase_1.Collections.EVENTS).doc(eventId).get();
            if (!eventDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: 'Event not found',
                });
            }
            const event = eventDoc.data();
            // Check if event is still open
            if (event.status !== 'published') {
                return res.status(400).json({
                    success: false,
                    error: 'Event is not available for joining',
                });
            }
            // Check if user already joined
            const existingMatch = await firebase_1.db.collection(firebase_1.Collections.MATCHES)
                .where('userId', '==', userId)
                .where('eventId', '==', eventId)
                .where('status', 'in', ['pending', 'matched'])
                .limit(1)
                .get();
            if (!existingMatch.empty) {
                return res.status(400).json({
                    success: false,
                    error: 'You have already joined this event',
                });
            }
            // Check subscription limits
            const subscription = req.user.subscription;
            if (subscription.status === 'trial' && subscription.trialEventUsed) {
                return res.status(403).json({
                    success: false,
                    error: 'Trial event already used. Please upgrade to continue.',
                });
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
                createdAt: firestore_1.Timestamp.now(),
                expiresAt: firestore_1.Timestamp.fromDate(new Date(event.date.toDate().getTime() - 24 * 60 * 60 * 1000)), // 1 day before event
            };
            const matchDoc = await firebase_1.db.collection(firebase_1.Collections.MATCHES).add(matchData);
            // Update trial status if needed
            if (subscription.status === 'trial' && !subscription.trialEventUsed) {
                await firebase_1.db.collection(firebase_1.Collections.USERS).doc(userId).update({
                    'subscription.trialEventUsed': true,
                });
            }
            return res.status(201).json({
                success: true,
                data: { matchId: matchDoc.id, ...matchData },
                message: 'Successfully joined event. We\'ll notify you when a group is formed!',
            });
        }
        catch (error) {
            console.error('Join event error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to join event',
            });
        }
    }
    /**
     * Leave event
     * DELETE /events/:id/leave
     */
    static async leaveEvent(req, res) {
        try {
            const userId = req.userId;
            const { id: eventId } = req.params;
            // Find user's match
            const matchSnapshot = await firebase_1.db.collection(firebase_1.Collections.MATCHES)
                .where('userId', '==', userId)
                .where('eventId', '==', eventId)
                .where('status', 'in', ['pending', 'matched'])
                .limit(1)
                .get();
            if (matchSnapshot.empty) {
                return res.status(404).json({
                    success: false,
                    error: 'You have not joined this event',
                });
            }
            const matchDoc = matchSnapshot.docs[0];
            const matchData = matchDoc.data();
            // Check if user is already in a group
            if (matchData.groupId) {
                // Remove from group
                const groupDoc = await firebase_1.db.collection(firebase_1.Collections.GROUPS)
                    .doc(matchData.groupId)
                    .get();
                if (groupDoc.exists) {
                    const groupData = groupDoc.data();
                    const updatedMembers = groupData?.members.filter((member) => member.userId !== userId);
                    await groupDoc.ref.update({
                        members: updatedMembers,
                        updatedAt: firestore_1.Timestamp.now(),
                    });
                    // If group is too small, disband it
                    if (updatedMembers.length < constants_1.Constants.MIN_GROUP_SIZE) {
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
                updatedAt: firestore_1.Timestamp.now(),
            });
            return res.status(200).json({
                success: true,
                message: 'Successfully left the event',
            });
        }
        catch (error) {
            console.error('Leave event error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to leave event',
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