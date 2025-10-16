import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { realAPI, billingAPI, eventsAPI } from '../../services/api';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { format, addDays } from 'date-fns';
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

type AvailabilityEntry = {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  night: boolean;
  blocked: boolean;
};

export default function EventsScreen({ navigation }: any) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState<Record<string, AvailabilityEntry>>({});
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [savingAvailability, setSavingAvailability] = useState(false);
  const { user, updateProfile, loadUser } = useAuthStore();

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

  const upcomingDates = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const date = addDays(new Date(), index);
      return {
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE'),
        full: format(date, 'MMM d'),
      };
    });
  }, []);

  const ensureDateEntry = useCallback(
    (dateKey: string): AvailabilityEntry => {
      return availabilityDraft[dateKey] || {
        morning: true,
        afternoon: true,
        evening: true,
        night: true,
        blocked: false,
      };
    },
    [availabilityDraft]
  );

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

  const handleToggleSegment = (segment: keyof Omit<AvailabilityEntry, 'blocked'>) => {
    setAvailabilityDraft((prev) => {
      const current = ensureDateEntry(selectedDate);
      const updated =
        current.blocked && !current[segment]
          ? { ...current, [segment]: true, blocked: false }
          : { ...current, [segment]: !current[segment] };

      return {
        ...prev,
        [selectedDate]: updated,
      };
    });
  };

  const handleBlockDay = () => {
    setAvailabilityDraft((prev) => ({
      ...prev,
      [selectedDate]: {
        morning: false,
        afternoon: false,
        evening: false,
        night: false,
        blocked: true,
      },
    }));
  };

  const handleSetAllAvailable = () => {
    setAvailabilityDraft((prev) => ({
      ...prev,
      [selectedDate]: {
        morning: true,
        afternoon: true,
        evening: true,
        night: true,
        blocked: false,
      },
    }));
  };

  const handleOpenAvailability = () => {
    const existing = ((user?.profile as any)?.availability || {}) as Record<string, AvailabilityEntry>;
    const cloned = Object.fromEntries(
      Object.entries(existing).map(([dateKey, entry]) => [
        dateKey,
        {
          morning: !!entry.morning,
          afternoon: !!entry.afternoon,
          evening: !!entry.evening,
          night: !!entry.night,
          blocked: !!entry.blocked,
        },
      ])
    );
    setAvailabilityDraft(cloned);
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    setAvailabilityModalVisible(true);
  };

  const handleSaveAvailability = async () => {
    try {
      setSavingAvailability(true);
      await updateProfile({ availability: availabilityDraft });
      await loadUser();
      setAvailabilityModalVisible(false);
    } catch (error) {
      console.error('[EventsScreen] Failed to save availability:', error);
      Alert.alert('Error', 'Unable to save availability. Please try again.');
    } finally {
      setSavingAvailability(false);
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
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Your Events</Text>
            <Text style={styles.headerSubtitle}>Curated events matching your interests</Text>
          </View>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleOpenAvailability}>
            <Ionicons name="calendar-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
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

      <Modal
        visible={availabilityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAvailabilityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.availabilityModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Availability</Text>
              <TouchableOpacity onPress={() => setAvailabilityModalVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarScroll}>
              {upcomingDates.map((date) => {
                const isSelected = selectedDate === date.key;
                return (
                  <TouchableOpacity
                    key={date.key}
                    style={[styles.calendarChip, isSelected && styles.calendarChipSelected]}
                    onPress={() => setSelectedDate(date.key)}
                  >
                    <Text
                      style={[
                        styles.calendarChipLabel,
                        isSelected && styles.calendarChipLabelSelected,
                      ]}
                    >
                      {date.label.toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        styles.calendarChipDate,
                        isSelected && styles.calendarChipLabelSelected,
                      ]}
                    >
                      {date.full}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.segmentTitle}>Select the times you’re available</Text>
            {(['morning', 'afternoon', 'evening', 'night'] as const).map((segment) => {
              const state = ensureDateEntry(selectedDate);
              const isActive = state[segment];
              return (
                <TouchableOpacity
                  key={segment}
                  style={[styles.segmentButton, isActive && styles.segmentButtonSelected]}
                  onPress={() => handleToggleSegment(segment)}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      isActive && styles.segmentButtonTextSelected,
                    ]}
                  >
                    {segment.charAt(0).toUpperCase() + segment.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.segmentActions}>
              <TouchableOpacity style={styles.actionChip} onPress={handleSetAllAvailable}>
                <Ionicons name="checkmark-circle-outline" size={16} color={Colors.primary} />
                <Text style={styles.actionChipLabel}>Mark day available</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={handleBlockDay}>
                <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.actionChipLabel}>Block entire day</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, savingAvailability && styles.disabledButton]}
              onPress={handleSaveAvailability}
              disabled={savingAvailability}
            >
              {savingAvailability ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Availability</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.modalFooterNote}>
              Any time not blocked will be used to match you with events that fit your schedule.
            </Text>
          </View>
        </View>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  availabilityModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h2,
  },
  calendarScroll: {
    marginBottom: Spacing.lg,
  },
  calendarChip: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    alignItems: 'center',
  },
  calendarChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  calendarChipLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  calendarChipDate: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
  },
  calendarChipLabelSelected: {
    color: Colors.white,
  },
  segmentTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  segmentButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginBottom: Spacing.sm,
  },
  segmentButtonSelected: {
    backgroundColor: Colors.primary100,
    borderColor: Colors.primary,
  },
  segmentButtonText: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
  },
  segmentButtonTextSelected: {
    color: Colors.primary600,
    fontWeight: '700',
  },
  segmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary100,
  },
  actionChipLabel: {
    ...Typography.caption,
    color: Colors.primary600,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.round,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
  modalFooterNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
