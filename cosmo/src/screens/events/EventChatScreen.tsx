import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { useChatStore, ChatParticipant } from '../../store/chatStore';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';

interface RouteParams {
  chatId: string;
  eventTitle: string;
}

type EventChatRouteProp = RouteProp<{ params: RouteParams }, 'params'>;

export default function EventChatScreen() {
  const route = useRoute<EventChatRouteProp>();
  const navigation = useNavigation();
  const { chatId, eventTitle } = route.params;
  const {
    chats,
    messages,
    loadingChats,
    loadingMessages,
    sendingMessages,
    fetchChat,
    fetchMessages,
    sendMessage,
  } = useChatStore();

  const [input, setInput] = useState('');
  const chat = chats[chatId];
  const chatMessages = messages[chatId] || [];
  const isLoading = loadingMessages[chatId];
  const isSending = sendingMessages[chatId];
  const isChatLoading = loadingChats[chatId];
  const participants = chat?.participants || [];
  const participantMap = useMemo(() => {
    const map: Record<string, ChatParticipant> = {};
    participants.forEach((participant) => {
      map[participant.id] = participant;
    });
    return map;
  }, [participants]);
  const [selectedParticipant, setSelectedParticipant] = useState<ChatParticipant | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: true, title: eventTitle || 'Event Chat' });
  }, [eventTitle, navigation]);

  useEffect(() => {
    fetchChat(chatId).catch((error) => {
      console.error('[EventChatScreen] fetchChat error:', error);
    });
    fetchMessages(chatId).catch((error) => {
      console.error('[EventChatScreen] fetchMessages error:', error);
    });
  }, [chatId, fetchChat, fetchMessages]);

  const handleRefresh = async () => {
    try {
      await fetchMessages(chatId);
    } catch (error) {
      console.error('[EventChatScreen] refresh error:', error);
    }
  };

  const handleSend = async () => {
    try {
      await sendMessage(chatId, input.trim());
      setInput('');
    } catch (error) {
      console.error('[EventChatScreen] sendMessage error:', error);
    }
  };

  const initialsForName = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleParticipantPress = (participant: ChatParticipant) => {
    setSelectedParticipant(participant);
    setProfileVisible(true);
  };

  const closeProfileModal = () => {
    setProfileVisible(false);
    setSelectedParticipant(null);
  };

  const renderMessage = ({ item }: { item: typeof chatMessages[number] }) => {
    const timestamp = item.createdAt
      ? format(new Date(item.createdAt), 'EEE h:mm a')
      : '';
    const relative = item.createdAt
      ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
      : '';
    const sender = participantMap[item.senderId];
    const avatar = sender?.photo;
    return (
      <View style={styles.messageRow}>
        <TouchableOpacity
          style={styles.messageAvatarContainer}
          onPress={() => sender && handleParticipantPress(sender)}
          disabled={!sender}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.messageAvatar} />
          ) : (
            <View style={[styles.messageAvatar, styles.participantFallback]}>
              <Text style={styles.participantFallbackText}>
                {initialsForName(sender?.name || item.senderId)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.messageContainer}>
          <View style={styles.messageHeader}>
            <Text style={styles.messageSender}>{sender?.name || item.senderId}</Text>
            <View style={styles.timestampWrap}>
              <Text style={styles.messageTimestamp}>{relative || timestamp}</Text>
            </View>
          </View>
          <Text style={styles.messageBody}>{item.content}</Text>
        </View>
      </View>
    );
  };

  const renderVenueDetails = () => {
    if (!chat?.venue) {
      return null;
    }
    return (
      <View style={styles.venueCard}>
        <Text style={styles.venueTitle}>{chat.venue.name}</Text>
        <Text style={styles.venueAddress}>{chat.venue.address}</Text>
        {chat.venue.description ? (
          <Text style={styles.venueDescription}>{chat.venue.description}</Text>
        ) : null}
        <View style={styles.venueMetaRow}>
          {chat.venue.priceRange ? (
            <View style={styles.venueChip}>
              <Ionicons name="pricetag-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.venueChipText}>
                ${chat.venue.priceRange.min} - ${chat.venue.priceRange.max}
              </Text>
            </View>
          ) : null}
          {chat.venue.durationMinutes ? (
            <View style={styles.venueChip}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.venueChipText}>
                {chat.venue.durationMinutes} min
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const renderParticipants = () => {
    if (!participants.length) return null;
    return (
      <View style={styles.participantsSection}>
        <Text style={styles.participantsLabel}>Attendees</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.participantsRow}
        >
          {participants.map((participant) => {
            const avatar = participant.photo;
            return (
              <TouchableOpacity
                key={participant.id}
                style={styles.participantAvatarContainer}
                onPress={() => handleParticipantPress(participant)}
              >
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.participantAvatar} />
                ) : (
                  <View style={[styles.participantAvatar, styles.participantFallback]}>
                    <Text style={styles.participantFallbackText}>
                      {initialsForName(participant.name)}
                    </Text>
                  </View>
                )}
                <Text style={styles.participantName} numberOfLines={1}>
                  {participant.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.content}>
        {renderParticipants()}
        <View style={styles.bannerRow}>
          {renderVenueDetails()}
          {chat?.suggestedTimes && chat.suggestedTimes.length > 0 && (
            <View style={styles.bannerCard}>
              <Text style={styles.bannerTitle}>Suggested times</Text>
              {chat.suggestedTimes.slice(0, 3).map((slot: any) => (
                <Text key={`${slot.date}-${slot.segments?.join(',')}`} style={styles.bannerText}>
                  {slot.date ? format(new Date(slot.date), 'EEE, MMM d') : slot.date} · {slot.segments?.join(', ')}
                </Text>
              ))}
            </View>
          )}
        </View>

        {isChatLoading && !chat ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            refreshControl={
              <RefreshControl refreshing={Boolean(isLoading)} onRefresh={handleRefresh} />
            }
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyState}>
                  <Ionicons name="chatbubbles-outline" size={64} color={Colors.lightGray} />
                  <Text style={styles.emptyStateTitle}>No messages yet</Text>
                  <Text style={styles.emptyStateText}>
                    Be the first to say hello!
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>

      <Modal
        visible={profileVisible}
        animationType="slide"
        transparent
        onRequestClose={closeProfileModal}
      >
        <View style={styles.profileModalOverlay}>
          <View style={styles.profileModal}>
            <View style={styles.profileModalHeader}>
              <Text style={styles.profileModalTitle}>{selectedParticipant?.name}</Text>
              <TouchableOpacity onPress={closeProfileModal}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {selectedParticipant?.photo ? (
                <Image
                  source={{ uri: selectedParticipant.photo }}
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={[styles.profilePhoto, styles.participantFallback]}>
                  <Text style={styles.participantFallbackText}>
                    {initialsForName(selectedParticipant?.name)}
                  </Text>
                </View>
              )}
              {selectedParticipant?.bio ? (
                <Text style={styles.profileBio}>{selectedParticipant.bio}</Text>
              ) : null}
              {selectedParticipant?.interests?.length ? (
                <View style={styles.profileInterests}>
                  <Text style={styles.profileSectionLabel}>Interests</Text>
                  <View style={styles.profileInterestsWrap}>
                    {selectedParticipant.interests.map((interest) => (
                      <View key={interest} style={styles.interestChip}>
                        <Text style={styles.interestChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message"
          placeholderTextColor={Colors.textSecondary}
          value={input}
          onChangeText={setInput}
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={Colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyStateTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
    color: Colors.text,
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  messageAvatarContainer: {
    marginRight: Spacing.sm,
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.lightGray,
  },
  messageContainer: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  timestampWrap: {
    marginLeft: Spacing.sm,
  },
  messageSender: {
    ...Typography.caption,
    color: Colors.primary600,
    fontWeight: '600',
  },
  messageTimestamp: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  messageBody: {
    ...Typography.body,
    color: Colors.text,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : 0,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.gray,
  },
  venueCard: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  venueTitle: {
    ...Typography.h3,
  },
  venueAddress: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  venueDescription: {
    ...Typography.bodySmall,
    color: Colors.text,
  },
  venueMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  venueMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm,
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary100,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  venueChipText: {
    color: Colors.primary600,
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  participantsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  participantsLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  participantsRow: {
    paddingBottom: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  participantAvatarContainer: {
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  participantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.lightGray,
    marginBottom: Spacing.xs,
  },
  participantFallback: {
    backgroundColor: Colors.primary100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantFallbackText: {
    color: Colors.primary600,
    fontWeight: '700',
    fontSize: 18,
  },
  participantName: {
    ...Typography.caption,
    color: Colors.textSecondary,
    maxWidth: 80,
    textAlign: 'center',
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  profileModal: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  profileModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  profileModalTitle: {
    ...Typography.h3,
  },
  profilePhoto: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  profileBio: {
    ...Typography.body,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  profileSectionLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  profileInterests: {
    marginBottom: Spacing.lg,
  },
  profileInterestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestChip: {
    backgroundColor: Colors.primary100,
    borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  interestChipText: {
    color: Colors.primary600,
    fontSize: 12,
    fontWeight: '600',
  },
});
