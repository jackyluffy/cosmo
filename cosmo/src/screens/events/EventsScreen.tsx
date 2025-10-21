import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
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

const getVenuePhotos = (event: AssignmentView['event'], option?: EventVenueOption): string[] => {
  const photos: string[] = [];
  if (option?.photos && option.photos.length > 0) {
    photos.push(...option.photos);
  } else if (event.photos && event.photos.length > 0) {
    photos.push(...event.photos);
  }

  if (photos.length === 0) {
    photos.push(VENUE_PLACEHOLDER);
  }

  return photos;
};

const getVenueImage = (event: AssignmentView['event'], option?: EventVenueOption) => {
  return getVenuePhotos(event, option)[0];
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
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set([format(new Date(), 'yyyy-MM-dd')]));
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [collapsedEvents, setCollapsedEvents] = useState<Record<string, boolean>>({});

  const [photoGalleryVisible, setPhotoGalleryVisible] = useState(false);
  const [photoGalleryData, setPhotoGalleryData] = useState<{ photos: string[]; initialIndex: number; venueName: string }>({ photos: [], initialIndex: 0, venueName: '' });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

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

  // Get the merged state for all selected dates
  const getSelectedDatesState = useCallback((): AvailabilityEntry => {
    const selectedDatesArray = Array.from(selectedDates);
    if (selectedDatesArray.length === 0) {
      return {
        morning: true,
        afternoon: true,
        evening: true,
        night: true,
        blocked: false,
      };
    }

    // Return state of first selected date (all will be set to same value)
    return ensureDateEntry(selectedDatesArray[0]);
  }, [selectedDates, ensureDateEntry]);

  const handleToggleSegment = (segment: keyof Omit<AvailabilityEntry, 'blocked'>) => {
    setAvailabilityDraft((prev) => {
      const newDraft = { ...prev };
      selectedDates.forEach((dateKey) => {
        const current = ensureDateEntry(dateKey);
        const updated =
          current.blocked && !current[segment]
            ? { ...current, [segment]: true, blocked: false }
            : { ...current, [segment]: !current[segment] };
        newDraft[dateKey] = updated;
      });
      return newDraft;
    });
  };

  const handleBlockDay = () => {
    setAvailabilityDraft((prev) => {
      const newDraft = { ...prev };
      selectedDates.forEach((dateKey) => {
        newDraft[dateKey] = {
          morning: false,
          afternoon: false,
          evening: false,
          night: false,
          blocked: true,
        };
      });
      return newDraft;
    });
  };

  const handleSetAllAvailable = () => {
    setAvailabilityDraft((prev) => {
      const newDraft = { ...prev };
      selectedDates.forEach((dateKey) => {
        newDraft[dateKey] = {
          morning: true,
          afternoon: true,
          evening: true,
          night: true,
          blocked: false,
        };
      });
      return newDraft;
    });
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
    setSelectedDates(new Set([format(new Date(), 'yyyy-MM-dd')]));
    setAvailabilityModalVisible(true);
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
        // Keep at least one date selected
        if (newSet.size === 0) {
          newSet.add(dateKey);
        }
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  const handleQuickSelect = (type: 'weekdays' | 'weekend' | 'all' | 'clear') => {
    if (type === 'clear') {
      setSelectedDates(new Set([format(new Date(), 'yyyy-MM-dd')]));
      return;
    }

    const newSet = new Set<string>();
    upcomingDates.forEach((dateInfo) => {
      // Parse date from YYYY-MM-DD format
      const [year, month, day] = dateInfo.key.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      if (type === 'all') {
        newSet.add(dateInfo.key);
      } else if (type === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Monday (1) through Friday (5)
        newSet.add(dateInfo.key);
      } else if (type === 'weekend' && (dayOfWeek === 0 || dayOfWeek === 6)) {
        // Sunday (0) and Saturday (6)
        newSet.add(dateInfo.key);
      }
    });

    if (newSet.size > 0) {
      setSelectedDates(newSet);
    }
  };

  const handleSaveAvailability = async () => {
    try {
      setSavingAvailability(true);

      // Ensure all selected dates are included in the draft
      const finalDraft = { ...availabilityDraft };
      selectedDates.forEach((dateKey) => {
        if (!finalDraft[dateKey]) {
          finalDraft[dateKey] = ensureDateEntry(dateKey);
        }
      });

      await updateProfile({ availability: finalDraft });
      await loadUser();
      setAvailabilityModalVisible(false);
      Alert.alert('Success', 'Availability saved!');
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

  const toggleEventCollapsed = (eventId: string) => {
    setCollapsedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  const handleOpenPhotoGallery = (photos: string[], initialIndex: number, venueName: string) => {
    setPhotoGalleryData({ photos, initialIndex, venueName });
    setCurrentPhotoIndex(initialIndex);
    setPhotoGalleryVisible(true);
  };

  const handleClosePhotoGallery = () => {
    setPhotoGalleryVisible(false);
  };

  const handleOpenMaps = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open maps');
    });
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
    voteTotals?: Record<string, number>,
    allVotesIn?: boolean
  ) => {
    const selectedVenueId = selectedVenues[event.id];
    const isSelected = selectedVenueId === option.id;
    const isFinal = finalVenueOptionId === option.id;
    const voteCount = voteTotals?.[option.id] ?? 0;
    const hasFinalVenue = Boolean(finalVenueOptionId);
    const venuePhotos = getVenuePhotos(event, option);
    const hasMultiplePhotos = venuePhotos.length > 1;

    return (
      <TouchableOpacity
        key={option.id}
        style={[
          styles.venueOption,
          isSelected && styles.venueOptionSelected,
          isFinal && styles.venueOptionFinal,
        ]}
        onPress={() => !hasFinalVenue && handleSelectVenue(event.id, option.id)}
        disabled={hasFinalVenue}
        activeOpacity={0.9}
      >
        <TouchableOpacity
          style={styles.venueImageWrapper}
          onPress={() => handleOpenPhotoGallery(venuePhotos, 0, option.name)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: getVenueImage(event, option) }}
            style={styles.venueImage}
          />
          <View style={styles.venueOverlay}>
            <Text style={styles.venueName}>{option.name}</Text>
            <TouchableOpacity onPress={() => handleOpenMaps(option.address)} activeOpacity={0.7}>
              <Text style={styles.venueAddress} numberOfLines={1}>
                📍 {option.address}
              </Text>
            </TouchableOpacity>
          </View>
          {hasMultiplePhotos && (
            <View style={styles.photoIndicator}>
              <Ionicons name="images" size={16} color={Colors.white} />
              <Text style={styles.photoIndicatorText}>{venuePhotos.length}</Text>
            </View>
          )}
        </TouchableOpacity>

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

    // Calculate if all participants have voted
    const voteTotals = event.venueVoteTotals || {};
    const totalVotes = Object.values(voteTotals).reduce((sum, count) => sum + count, 0);
    const allVotesIn = isJoined && totalVotes >= activeCount && activeCount > 0;

    const isCollapsed = collapsedEvents[event.id];

    return (
      <View key={event.id} style={styles.eventCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>{event.title}</Text>
          </View>
          <View style={styles.cardHeaderRight}>
            <View style={badgeStyle}>
              <Text style={badgeTextStyle}>{badgeLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleEventCollapsed(event.id)}
              style={styles.collapseButton}
            >
              <Ionicons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={24}
                color={Colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {!isCollapsed && (
          <>
            {renderSuggestedTimes(event.suggestedTimes)}

        {activeCount > 0 && (
          <View style={styles.confirmationMeta}>
            <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.confirmationMetaText}>
              {confirmedCount}/{activeCount} confirmed
            </Text>
          </View>
        )}

        {!hasFinalVenue && (
          <>
            <Text style={styles.sectionLabel}>Vote on the meetup spot</Text>
            <Text style={styles.sectionHelper}>
              Pick the venue that works best for you. Once everyone joins, the most voted option wins.
            </Text>
          </>
        )}

        {venueOptions.length === 0 ? (
          <View style={styles.emptyVenues}>
            <Text style={styles.emptyVenuesText}>
              Venue options are being finalized. Please check back soon!
            </Text>
          </View>
        ) : (
          (hasFinalVenue ? venueOptions.filter(opt => opt.id === event.finalVenueOptionId) : venueOptions).map((option) =>
            renderVenueOption(event, option, isJoined, event.finalVenueOptionId, event.venueVoteTotals, allVotesIn)
          )
        )}

        {hasFinalVenue && (
          <View style={styles.finalVenueCallout}>
            <Ionicons name="star" size={16} color={Colors.primary} />
            <Text style={styles.finalVenueText}>
              Final venue: {
                allVotesIn
                  ? (venueOptions.find((opt) => opt.id === event.finalVenueOptionId)?.name || 'TBA')
                  : 'Pending'
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
              <Text style={styles.subscribeButtonText}>Vote to Join</Text>
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
                <Text style={styles.primaryButtonText}>Vote & Join</Text>
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
          <>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.chatButton, !allVotesIn && styles.disabledButton]}
              onPress={() => allVotesIn && handleOpenChat(event.chatRoomId!, event.title)}
              disabled={!allVotesIn}
            >
              <Ionicons name="chatbubbles-outline" size={18} color={allVotesIn ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.chatButtonText, !allVotesIn && styles.chatButtonTextDisabled]}>Open Group Chat</Text>
            </TouchableOpacity>
            {!allVotesIn && (
              <Text style={styles.chatHelperText}>
                Chat opens once everyone has voted
              </Text>
            )}
          </>
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
          </>
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

            <View style={styles.quickSelectRow}>
              <TouchableOpacity style={styles.quickSelectButton} onPress={() => handleQuickSelect('weekdays')}>
                <Text style={styles.quickSelectText}>Weekdays</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSelectButton} onPress={() => handleQuickSelect('weekend')}>
                <Text style={styles.quickSelectText}>Weekend</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSelectButton} onPress={() => handleQuickSelect('all')}>
                <Text style={styles.quickSelectText}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickSelectButton} onPress={() => handleQuickSelect('clear')}>
                <Text style={styles.quickSelectText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.selectionCount}>
              {selectedDates.size} {selectedDates.size === 1 ? 'day' : 'days'} selected
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarScroll}>
              {upcomingDates.map((date) => {
                const isSelected = selectedDates.has(date.key);
                return (
                  <TouchableOpacity
                    key={date.key}
                    style={[styles.calendarChip, isSelected && styles.calendarChipSelected]}
                    onPress={() => handleSelectDate(date.key)}
                  >
                    {isSelected && (
                      <View style={styles.checkmarkIcon}>
                        <Ionicons name="checkmark" size={14} color={Colors.white} />
                      </View>
                    )}
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

            <Text style={styles.segmentTitle}>Apply to all selected days</Text>
            {(['morning', 'afternoon', 'evening', 'night'] as const).map((segment) => {
              const state = getSelectedDatesState();
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

      <Modal
        visible={photoGalleryVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClosePhotoGallery}
      >
        <View style={styles.photoGalleryOverlay}>
          <View style={styles.photoGalleryHeader}>
            <Text style={styles.photoGalleryTitle}>{photoGalleryData.venueName}</Text>
            <TouchableOpacity onPress={handleClosePhotoGallery} style={styles.photoGalleryCloseButton}>
              <Ionicons name="close" size={28} color={Colors.white} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const width = Dimensions.get('window').width;
              const index = Math.round(offsetX / width);
              setCurrentPhotoIndex(index);
            }}
            scrollEventThrottle={16}
            contentContainerStyle={styles.photoGalleryContent}
          >
            {photoGalleryData.photos.map((photo, index) => (
              <View key={index} style={styles.photoGalleryImageContainer}>
                <Image
                  source={{ uri: photo }}
                  style={styles.photoGalleryImage}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>

          <View style={styles.photoGalleryFooter}>
            <Text style={styles.photoGalleryCounter}>
              {currentPhotoIndex + 1} / {photoGalleryData.photos.length}
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
    paddingBottom: Spacing.sm,
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
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
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  collapseButton: {
    padding: Spacing.xs,
  },
  cardTitle: {
    ...Typography.h3,
    fontSize: 16,
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
  infoLinkRow: {
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
  infoLinkText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    textDecorationLine: 'underline',
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
    textDecorationLine: 'underline',
    fontWeight: '600',
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
  chatButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  chatHelperText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginHorizontal: Spacing.lg,
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
  quickSelectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickSelectButton: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  quickSelectText: {
    ...Typography.caption,
    color: Colors.text,
    fontWeight: '500',
  },
  selectionCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
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
    position: 'relative',
  },
  calendarChipSelected: {
    backgroundColor: Colors.primary,
  },
  checkmarkIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.round,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  photoIndicator: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  photoIndicatorText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  photoGalleryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  photoGalleryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl + 10,
    paddingBottom: Spacing.md,
  },
  photoGalleryTitle: {
    ...Typography.h3,
    color: Colors.white,
    flex: 1,
  },
  photoGalleryCloseButton: {
    padding: Spacing.xs,
  },
  photoGalleryContent: {
    flexGrow: 1,
  },
  photoGalleryImageContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoGalleryImage: {
    width: '100%',
    height: '100%',
  },
  photoGalleryFooter: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  photoGalleryCounter: {
    ...Typography.body,
    color: Colors.white,
    fontWeight: '600',
  },
});
