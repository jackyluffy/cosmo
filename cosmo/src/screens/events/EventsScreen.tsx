import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { realAPI, billingAPI } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';

interface Event {
  id: string;
  title: string;
  description: string;
  photos: string[];
  venue_name: string;
  venue_address: string;
  starts_at: string;
  capacity: number;
  attendees: number;
  rsvp_status?: 'yes' | 'no' | null;
  attendees_preview: Array<{
    name: string;
    photo: string;
  }>;
}

export default function EventsScreen({ navigation }: any) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await realAPI.events.getAll();
      setEvents(response.data.data || []);
    } catch (error) {
      console.error('Failed to load events:', error);
      // Set empty array on error
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRSVP = async (eventId: string, response: 'yes' | 'no') => {
    try {
      const billingStatus = await billingAPI.getStatus();
      const { status, trial_event_used } = billingStatus.data;

      if (response === 'yes' && status === 'trial' && trial_event_used) {
        Alert.alert(
          'Subscription Required',
          'Your free trial event has been used. Subscribe for $9.99/month to RSVP to more events.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Subscribe',
              onPress: async () => {
                const checkout = await billingAPI.createCheckoutSession();
                navigation.navigate('Checkout', { url: checkout.data.url });
              },
            },
          ]
        );
        return;
      }

      await eventsAPI.rsvp(eventId, response);

      setEvents((prevEvents) =>
        prevEvents.map((event) =>
          event.id === eventId ? { ...event, rsvp_status: response } : event
        )
      );

      if (response === 'yes') {
        Alert.alert('RSVP Confirmed!', 'You\'re going to this event! Check the event details for the group chat.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to RSVP. Please try again.');
    }
  };

  const renderEvent = (event: Event) => {
    const eventDate = new Date(event.starts_at);
    const isRsvpd = event.rsvp_status === 'yes';

    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
      >
        <Image
          source={{ uri: event.photos[0] || 'https://via.placeholder.com/400x200' }}
          style={styles.eventImage}
        />

        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            {isRsvpd && (
              <View style={styles.rsvpBadge}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                <Text style={styles.rsvpBadgeText}>Going</Text>
              </View>
            )}
          </View>

          <View style={styles.eventInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.infoText}>
                {format(eventDate, 'EEE, MMM d')} at {format(eventDate, 'h:mm a')}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.infoText} numberOfLines={1}>
                {event.venue_name}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.infoText}>
                {event.attendees}/{event.capacity} attending
              </Text>
            </View>
          </View>

          {event.attendees_preview.length > 0 && (
            <View style={styles.attendeesPreview}>
              {event.attendees_preview.slice(0, 3).map((attendee, index) => (
                <Image
                  key={index}
                  source={{ uri: attendee.photo }}
                  style={[
                    styles.attendeeAvatar,
                    { marginLeft: index > 0 ? -10 : 0 },
                  ]}
                />
              ))}
              {event.attendees > 3 && (
                <View style={[styles.attendeeAvatar, styles.moreAttendees]}>
                  <Text style={styles.moreAttendeesText}>
                    +{event.attendees - 3}
                  </Text>
                </View>
              )}
            </View>
          )}

          {!isRsvpd && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.skipButton]}
                onPress={() => handleRSVP(event.id, 'no')}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.rsvpButton]}
                onPress={() => handleRSVP(event.id, 'yes')}
              >
                <Text style={styles.rsvpButtonText}>RSVP</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Finding events for you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Events</Text>
        <Text style={styles.headerSubtitle}>
          Curated events matching your interests
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadEvents();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptySubtitle}>
              Keep swiping to find your perfect group!
            </Text>
          </View>
        ) : (
          events.map(renderEvent)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    ...Typography.h2,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  eventImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  eventContent: {
    padding: Spacing.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  eventTitle: {
    ...Typography.h3,
    flex: 1,
  },
  rsvpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    marginLeft: Spacing.sm,
  },
  rsvpBadgeText: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  eventInfo: {
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  attendeesPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  attendeeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  moreAttendees: {
    backgroundColor: Colors.primary100,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
  },
  moreAttendeesText: {
    ...Typography.caption,
    color: Colors.primary600,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  skipButton: {
    backgroundColor: Colors.lightGray,
  },
  skipButtonText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  rsvpButton: {
    backgroundColor: Colors.primary,
  },
  rsvpButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});