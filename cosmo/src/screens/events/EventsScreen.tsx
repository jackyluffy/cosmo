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
import { format, addDays } from 'date-fns';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import {
  useEventsStore,
  AssignmentView,
  EventVenueOption,
} from '../../store/eventsStore';

type AvailabilityEntry = {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  night: boolean;
  blocked: boolean;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  coffee: 'Coffee Meetup',
  bar: 'Bar Social',
  restaurant: 'Dinner Social',
  tennis: 'Tennis Social',
  dog_walking: 'Dog Walk',
  hiking: 'Hiking Adventure',
};

const VENUE_PLACEHOLDER =
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800';

const formatVenuePrice = (option?: EventVenueOption) => {
  if (!option?.priceRange) {
    return null;
  }
  const { min, max } = option.priceRange;
  if (min === max) {
    return `$${min}`;
  }
  return `$${min} - $${max}`;
};

const formatDuration = (minutes?: number) => {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours} hr${hours > 1 ? 's' : ''}`;
  return `${hours} hr ${remainder} min`;
};

const safeDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getVenueImage = (event: AssignmentView['event'], option?: EventVenueOption) => {
  if (option?.photos && option.photos.length > 0) {
    return option.photos[0];
  }
  if (event.photos && event.photos.length > 0) {
    return event.photos[0];
  }
  return VENUE_PLACEHOLDER;
};

export default function EventsScreen({ navigation }: any) {
  const { user, updateProfile, loadUser } = useAuthStore();
  const {
    assignments,
    pendingCount,
    canJoin,
    loading,
    fetchAssignments,
    joinEvent,
    voteOnEvent,
    respondToReminder,
  } = useEventsStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedVenues, setSelectedVenues] = useState<Record<string, string>>({});
  const [joinLoadingIds, setJoinLoadingIds] = useState<Record<string, boolean>>({});
  const [voteLoadingIds, setVoteLoadingIds] = useState<Record<string, boolean>>({});
  const [confirmLoadingIds, setConfirmLoadingIds] = useState<Record<string, boolean>>({});

  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState<Record<string, AvailabilityEntry>>({});
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [savingAvailability, setSavingAvailability] = useState(false);

  useEffect(() => {
    fetchAssignments().catch((error) => {
      console.error('[EventsScreen] Failed to fetch assignments:', error);
    });
  }, [fetchAssignments]);

  useEffect(() => {
    setSelectedVenues((prev) => {
      let changed = false;
      const next = { ...prev };
      assignments.forEach(({ event, participant }) => {
        const candidate =
          participant?.voteVenueOptionId ||
          event.finalVenueOptionId ||
          event.venueOptions?.[0]?.id;
        if (candidate && next[event.id] !== candidate) {
          next[event.id] = candidate;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [assignments]);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchAssignments({ silent: true });
    } catch (error) {
      console.error('[EventsScreen] Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const updateJoinLoading = (eventId: string, value: boolean) => {
    setJoinLoadingIds((prev) => ({ ...prev, [eventId]: value }));
  };

  const updateVoteLoading = (eventId: string, value: boolean) => {
    setVoteLoadingIds((prev) => ({ ...prev, [eventId]: value }));
  };

  const updateConfirmLoading = (eventId: string, value: boolean) => {
    setConfirmLoadingIds((prev) => ({ ...prev, [eventId]: value }));
  };

  const handleSelectVenue = (eventId: string, venueOptionId: string) => {
    setSelectedVenues((prev) => ({
      ...prev,
      [eventId]: venueOptionId,
    }));
  };

  const handleConfirmAttendance = async (eventId: string, action: 'confirm' | 'cancel') => {
    updateConfirmLoading(eventId, true);
    try {
      await respondToReminder(eventId, action);
      Alert.alert(
        action === 'confirm' ? 'Confirmed!' : 'Cancelled',
        action === 'confirm'
          ? 'Great! We will see you there.'
          : 'Thanks for letting us know. We will find a replacement.'
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error || error?.message || 'Unable to update attendance.';
      Alert.alert('Error', message);
    } finally {
      updateConfirmLoading(eventId, false);
    }
  };

  const handleOpenChat = (chatId: string, eventTitle: string) => {
    const parentNav = navigation.getParent?.() || navigation;
    parentNav.navigate('EventChat', { chatId, eventTitle });
  };

  const handleJoinEvent = async (eventId: string) => {
    const chosenVenue = selectedVenues[eventId];
    if (!chosenVenue) {
      Alert.alert('Choose a venue', 'Select your preferred venue before joining this event.');
      return;
    }
    updateJoinLoading(eventId, true);
    try {
      await joinEvent(eventId, chosenVenue);
      await fetchAssignments({ silent: true });
      Alert.alert('Joined!', 'Thanks for joining. Your vote has been recorded.');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to join this event right now.';
      Alert.alert('Unable to join', message);
    } finally {
      updateJoinLoading(eventId, false);
    }
  };

  const handleVote = async (eventId: string) => {
    const chosenVenue = selectedVenues[eventId];
    if (!chosenVenue) {
      Alert.alert('Choose a venue', 'Select your preferred venue to submit a vote.');
      return;
    }
    updateVoteLoading(eventId, true);
    try {
      await voteOnEvent(eventId, chosenVenue);
      await fetchAssignments({ silent: true });
      Alert.alert('Vote submitted', 'Thanks for sharing your preference!');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Unable to submit your vote.';
      Alert.alert('Vote failed', message);
    } finally {
      updateVoteLoading(eventId, false);
    }
  };

  const handleSubscribe = () => {
    navigation.navigate('Subscription', { origin: 'events' });
  };

  const renderSuggestedTimes = (times?: { date: string; segments: string[] }[]) => {
    if (!times || times.length === 0) return null;
    return (
      <View style={styles.suggestedContainer}>
        <Text style={styles.sectionLabel}>Suggested Times</Text>
        {times.slice(0, 3).map((slot) => {
          const date = safeDate(slot.date);
          return (
            <View key={`${slot.date}-${slot.segments.join(',')}`} style={styles.suggestedRow}>
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.suggestedText}>
                {date ? format(date, 'EEE, MMM d') : slot.date} · {slot.segments.join(', ')}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderVenueOption = (
    event: AssignmentView['event'],
    option: EventVenueOption,
    isJoined: boolean,
    finalVenueOptionId?: string | null,
    voteTotals?: Record<string, number>
  ) => {
    const selectedVenueId = selectedVenues[event.id];
    const isSelected = selectedVenueId === option.id;
    const isFinal = finalVenueOptionId === option.id;
    const voteCount = voteTotals?.[option.id] ?? 0;

    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.venueOption,
          isSelected && styles.venueOptionSelected,
          isFinal && styles.venueOptionFinal,
        ]}
        onPress={() => handleSelectVenue(event.id, option.id)}
        activeOpacity={0.9}
      >
        <View style={styles.venueImageWrapper}>
          <Image
            source={{ uri: getVenueImage(event, option) }}
            style={styles.venueImage}
          />
          <View style={styles.venueOverlay}>
            <Text style={styles.venueName}>{option.name}</Text>
            <Text style={styles.venueAddress} numberOfLines={1}>
              {option.address}
            </Text>
          </View>
        </View>

        <View style={styles.venueMetaRow}>
          {option.description ? (
            <Text style={styles.venueDescription} numberOfLines={2}>
              {option.description}
            </Text>
          ) : null}
          <View style={styles.venueMetaChips}>
            {formatVenuePrice(option) && (
              <View style={styles.venueChip}>
                <Ionicons name="pricetag-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.venueChipText}>{formatVenuePrice(option)}</Text>
              </View>
            )}
            {formatDuration(option.durationMinutes) && (
              <View style={styles.venueChip}>
                <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.venueChipText}>{formatDuration(option.durationMinutes)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.venueFooter}>
          <View style={styles.voteInfo}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'square-outline'}
              size={18}
              color={isSelected ? Colors.primary : Colors.textSecondary}
            />
            <Text style={styles.voteInfoText}>
              {isFinal
                ? 'Selected venue'
                : isSelected
                ? 'Your pick'
                : 'Tap to choose'}
            </Text>
          </View>
          {(isJoined || isFinal || voteCount > 0) && (
            <View style={styles.voteCountBadge}>
              <Ionicons name="people-outline" size={14} color={Colors.primary} />
              <Text style={styles.voteCountText}>{voteCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderAssignmentCard = (item: AssignmentView) => {
    const { event, assignment, participant } = item;
    const eventDate = safeDate(event.date);
    const humanDate = eventDate ? format(eventDate, 'EEE, MMM d') : 'TBD';
    const humanTime = eventDate ? format(eventDate, 'h:mm a') : '';
    const eventTypeLabel = event.eventType ? EVENT_TYPE_LABELS[event.eventType] || event.eventType : 'Event';
    const venueOptions = event.venueOptions || [];
    const participantStatus = assignment.status;
    const isJoined =
      participantStatus === 'joined' ||
      participantStatus === 'confirmed' ||
      participantStatus === 'completed' ||
      participant?.status === 'joined';
    const hasFinalVenue = Boolean(event.finalVenueOptionId);
    const joinDisabled = joinLoadingIds[event.id];
    const voteDisabled = voteLoadingIds[event.id];
    const confirmLoading = !!confirmLoadingIds[event.id];
    const reminderSent = event.reminderSent;
    const showReminderActions = reminderSent && participantStatus === 'joined';
    const showConfirmedBadge = participantStatus === 'confirmed';
    const showChatButton = !!event.chatRoomId && isJoined;
    const showSubscribeCta = assignment.status === 'pending_join' && !canJoin;

    const badgeStyle = [styles.badge];
    const badgeTextStyle = [styles.badgeText];
    let badgeLabel = 'Pending';

    if (participantStatus === 'joined') {
      badgeLabel = 'Joined';
      badgeStyle.push(styles.badgeJoined);
    } else if (participantStatus === 'confirmed') {
      badgeLabel = 'Confirmed';
      badgeStyle.push(styles.badgeConfirmed);
      badgeTextStyle.push(styles.badgeConfirmedText);
    } else if (participantStatus === 'canceled') {
      badgeLabel = 'Canceled';
      badgeStyle.push(styles.badgeCanceled);
      badgeTextStyle.push(styles.badgeCanceledText);
    }

    const statuses = event.participantStatuses || {};
    const activeStatuses = Object.values(statuses).filter(
      (status) => status !== 'canceled' && status !== 'removed'
    );
    const confirmedCount =
      event.confirmationsReceived ?? activeStatuses.filter((status) => status === 'confirmed').length;
    const activeCount = activeStatuses.length;

    return (
      <View key={event.id} style={styles.eventCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.cardSubtitle}>
              {eventTypeLabel} • {event.organizer?.name || 'Cosmo Events'}
            </Text>
          </View>
          <View style={badgeStyle}>
            <Text style={badgeTextStyle}>{badgeLabel}</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {humanDate}
              {humanTime ? ` at ${humanTime}` : ''}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText} numberOfLines={1}>
              {event.location?.name}
            </Text>
          </View>
        </View>

        {renderSuggestedTimes(event.suggestedTimes)}

        {activeCount > 0 && (
          <View style={styles.confirmationMeta}>
            <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.confirmationMetaText}>
              {confirmedCount}/{activeCount} confirmed
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Vote on the meetup spot</Text>
        <Text style={styles.sectionHelper}>
          Pick the venue that works best for you. Once everyone joins, the most voted option wins.
        </Text>

        {venueOptions.length === 0 ? (
          <View style={styles.emptyVenues}>
            <Text style={styles.emptyVenuesText}>
              Venue options are being finalized. Please check back soon!
            </Text>
          </View>
        ) : (
          venueOptions.map((option) =>
            renderVenueOption(event, option, isJoined, event.finalVenueOptionId, event.venueVoteTotals)
          )
        )}

        {hasFinalVenue && (
          <View style={styles.finalVenueCallout}>
            <Ionicons name="star" size={16} color={Colors.primary} />
            <Text style={styles.finalVenueText}>
              Final venue: {
                venueOptions.find((opt) => opt.id === event.finalVenueOptionId)?.name ||
                'TBA'
              }
            </Text>
          </View>
        )}

        {showConfirmedBadge && (
          <View style={styles.confirmedPill}>
            <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
            <Text style={styles.confirmedPillText}>You’re confirmed</Text>
          </View>
        )}

        {assignment.status === 'pending_join' && (
          showSubscribeCta ? (
            <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
              <Text style={styles.subscribeButtonText}>Subscribe to Join Events</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, joinDisabled && styles.disabledButton]}
              onPress={() => handleJoinEvent(event.id)}
              disabled={joinDisabled}
            >
              {joinDisabled ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Join & Vote</Text>
              )}
            </TouchableOpacity>
          )
        )}

        {assignment.status === 'joined' && !hasFinalVenue && (
          <TouchableOpacity
            style={[styles.secondaryButton, voteDisabled && styles.disabledButton]}
            onPress={() => handleVote(event.id)}
            disabled={voteDisabled}
          >
            {voteDisabled ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>
                {participant?.voteVenueOptionId ? 'Update Vote' : 'Submit Vote'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {hasFinalVenue && isJoined && event.chatRoomId && (
          <TouchableOpacity
            style={[styles.secondaryButton, styles.chatButton]}
            onPress={() => handleOpenChat(event.chatRoomId!, event.title)}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
            <Text style={styles.chatButtonText}>Open Group Chat</Text>
          </TouchableOpacity>
        )}

        {showReminderActions && (
          <View style={styles.reminderActions}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.confirmButton, confirmLoading && styles.disabledButton]}
              onPress={() => handleConfirmAttendance(event.id, 'confirm')}
              disabled={confirmLoading}
            >
              {confirmLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm Attendance</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, confirmLoading && styles.disabledButton]}
              onPress={() => handleConfirmAttendance(event.id, 'cancel')}
              disabled={confirmLoading}
            >
              {confirmLoading ? (
                <ActivityIndicator color={Colors.error} />
              ) : (
                <Text style={styles.cancelButtonText}>I Can’t Make It</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const hasAssignments = assignments.length > 0;

  if (loading && !hasAssignments) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Organizing your upcoming events…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Your Events</Text>
              {pendingCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              Cosmo finds the group, you just pick the vibe.
            </Text>
          </View>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleOpenAvailability}>
            <Ionicons name="calendar-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          !hasAssignments && styles.scrollContentCentered,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {!hasAssignments ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="sparkles" size={64} color={Colors.lightGray} />
            <Text style={styles.emptyTitle}>Keep swiping!</Text>
            <Text style={styles.emptySubtitle}>
              Mutual likes with overlapping schedules will unlock curated events here.
            </Text>
          </View>
        ) : (
          assignments.map(renderAssignmentCard)
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
  titleRow: {
    flexDirection: 'row',
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
  headerBadge: {
    marginLeft: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
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
    paddingHorizontal: Spacing.lg,
  },
  eventCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  cardHeaderText: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  cardTitle: {
    ...Typography.h3,
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  badge: {
    backgroundColor: Colors.primary100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  badgeText: {
    color: Colors.primary600,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeJoined: {
    backgroundColor: Colors.primary100,
  },
  badgeConfirmed: {
    backgroundColor: Colors.success,
  },
  badgeConfirmedText: {
    color: Colors.white,
  },
  badgeCanceled: {
    backgroundColor: Colors.error,
  },
  badgeCanceledText: {
    color: Colors.white,
  },
  cardInfo: {
    paddingHorizontal: Spacing.lg,
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
  sectionLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionHelper: {
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  confirmationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  confirmationMetaText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  venueOption: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  venueOptionSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  venueOptionFinal: {
    borderColor: Colors.success,
  },
  venueImageWrapper: {
    position: 'relative',
    height: 160,
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  venueName: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  venueAddress: {
    color: Colors.white,
    fontSize: 12,
    marginTop: 2,
  },
  venueMetaRow: {
    padding: Spacing.md,
  },
  venueDescription: {
    ...Typography.bodySmall,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  venueMetaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary100,
  },
  venueChipText: {
    color: Colors.primary600,
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  venueFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  voteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteInfoText: {
    ...Typography.caption,
    marginLeft: Spacing.xs,
  },
  voteCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary100,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  voteCountText: {
    color: Colors.primary600,
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  suggestedContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  suggestedText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  finalVenueCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.primary100,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  finalVenueText: {
    ...Typography.bodySmall,
    color: Colors.primary600,
    marginLeft: Spacing.sm,
  },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  confirmedPillText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
  primaryButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: Spacing.xs,
  },
  subscribeButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  emptyVenues: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.lightGray,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  emptyVenuesText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  reminderActions: {
    flexDirection: 'column',
    marginTop: Spacing.md,
  },
  confirmButton: {
    marginHorizontal: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  availabilityModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h3,
  },
  calendarScroll: {
    marginBottom: Spacing.lg,
  },
  calendarChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.lightGray,
    marginRight: Spacing.sm,
    alignItems: 'center',
  },
  calendarChipSelected: {
    backgroundColor: Colors.primary,
  },
  calendarChipLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  calendarChipLabelSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  calendarChipDate: {
    ...Typography.caption,
    marginTop: 2,
  },
  segmentTitle: {
    ...Typography.bodySmall,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  segmentButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  segmentButtonSelected: {
    backgroundColor: Colors.primary100,
    borderColor: Colors.primary,
  },
  segmentButtonText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  segmentButtonTextSelected: {
    color: Colors.primary600,
    fontWeight: '600',
  },
  segmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.lightGray,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  actionChipLabel: {
    ...Typography.caption,
    marginLeft: Spacing.xs,
  },
  modalFooterNote: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
