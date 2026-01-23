import React, { memo, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    Animated,
    InteractionManager,
} from 'react-native';
import Ably from 'ably';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/restApi';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';
import { listPerfConfig } from '../utils/perf';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../utils/animations';
import { ChatSkeleton } from '../components/SkeletonLoader';
import type { ChatMessage, ChatReaction } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Chat'>;

type ChatMessageRowProps = {
    item: ChatMessage;
    userId?: string;
    onLongPress: (message: ChatMessage) => void;
    onReactionTap: (message: ChatMessage, emoji: string) => void;
};

type ChatMessagesListProps = {
    messages: ChatMessage[];
    userId?: string;
    onLongPress: (message: ChatMessage) => void;
    onReactionTap: (message: ChatMessage, emoji: string) => void;
    onRefresh: () => void;
    refreshing: boolean;
    onFocusInput: () => void;
};

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const TYPING_TIMEOUT_MS = 3000;
const TYPING_THROTTLE_MS = 1500;

const groupReactions = (
    reactions: ChatMessage['reactions'],
    userId?: string
) => {
    const grouped: { [emoji: string]: { count: number; userReacted: boolean; reactionId?: string } } = {};
    reactions?.forEach((r) => {
        if (!grouped[r.emoji]) {
            grouped[r.emoji] = { count: 0, userReacted: false };
        }
        grouped[r.emoji].count++;
        if (r.userId === userId) {
            grouped[r.emoji].userReacted = true;
            grouped[r.emoji].reactionId = r.id;
        }
    });
    return grouped;
};

const normalizeRealtimeMessage = (message: ChatMessage): ChatMessage => {
    return {
        ...message,
        createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt as unknown as string),
        editedAt: message.editedAt ? new Date(message.editedAt as unknown as string) : null,
        deletedAt: message.deletedAt ? new Date(message.deletedAt as unknown as string) : null,
        attachments: (message.attachments || []).map((attachment) => ({
            ...attachment,
            createdAt: attachment.createdAt instanceof Date
                ? attachment.createdAt
                : new Date(attachment.createdAt as unknown as string),
        })),
        reactions: (message.reactions || []).map((reaction) => ({
            ...reaction,
            createdAt: reaction.createdAt instanceof Date
                ? reaction.createdAt
                : new Date(reaction.createdAt as unknown as string),
        })),
        mentions: (message.mentions || []).map((mention) => ({
            ...mention,
            createdAt: mention.createdAt instanceof Date
                ? mention.createdAt
                : new Date(mention.createdAt as unknown as string),
        })),
    };
};

const normalizeRealtimeReaction = (reaction: ChatReaction): ChatReaction => ({
    ...reaction,
    createdAt: reaction.createdAt instanceof Date
        ? reaction.createdAt
        : new Date(reaction.createdAt as unknown as string),
});

const dedupeMessages = (items: ChatMessage[]) => {
    const seen = new Set<string>();
    const result: ChatMessage[] = [];
    for (const item of items) {
        if (!item?.id || seen.has(item.id)) continue;
        seen.add(item.id);
        result.push(item);
    }
    return result;
};

const ChatMessageRow = memo(function ChatMessageRow({
    item,
    userId,
    onLongPress,
    onReactionTap,
}: ChatMessageRowProps) {
    const isMine = item.sender?.id === userId;
    const isDeleted = Boolean(item.deletedAt);
    const isSystemMessage = item.messageType === 'system' ||
        item.body?.toLowerCase().includes('joined') ||
        item.body?.toLowerCase().includes('left');
    const groupedReactions = useMemo(
        () => groupReactions(item.reactions, userId),
        [item.reactions, userId],
    );

    if (isSystemMessage) {
        return (
            <View style={styles.systemMessageRow}>
                <Text style={styles.systemMessageText}>{item.body}</Text>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.messageRow, isMine && styles.messageRowMine]}
            onLongPress={() => onLongPress(item)}
            delayLongPress={500}
            activeOpacity={0.8}
        >
            {!isMine && (
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {item.sender?.name?.charAt(0).toUpperCase() || 'M'}
                    </Text>
                </View>
            )}
            <View style={[styles.messageBubble, isMine && styles.messageBubbleMine]}>
                {!isMine && (
                    <Text style={styles.senderName}>{item.sender?.name || 'Member'}</Text>
                )}
                <Text style={[styles.messageText, isMine && styles.messageTextMine, isDeleted && styles.messageTextDeleted]}>
                    {isDeleted ? 'Message deleted' : item.body}
                </Text>
                <View style={styles.messageFooter}>
                    {item.editedAt && !isDeleted && (
                        <Text style={[styles.editedLabel, isMine && styles.editedLabelMine]}>edited</Text>
                    )}
                    <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                {item.reactions && item.reactions.length > 0 && !isDeleted && (
                    <View style={styles.reactionsContainer}>
                        {Object.entries(groupedReactions).map(([emoji, data]) => (
                            <TouchableOpacity
                                key={emoji}
                                style={[styles.reactionBadge, data.userReacted && styles.reactionBadgeActive]}
                                onPress={() => onReactionTap(item, emoji)}
                            >
                                <Text style={styles.reactionEmoji}>{emoji}</Text>
                                <Text style={[styles.reactionCount, data.userReacted && styles.reactionCountActive]}>
                                    {data.count}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
});

const ChatMessagesList = memo(React.forwardRef<FlatList, ChatMessagesListProps>(
    function ChatMessagesList(
        { messages, userId, onLongPress, onReactionTap, onRefresh, refreshing, onFocusInput },
        ref
    ) {
        const {
            initialNumToRender,
            windowSize,
            maxToRenderPerBatch,
            updateCellsBatchingPeriod,
        } = listPerfConfig;
        const renderMessage = useCallback(
            ({ item }: { item: ChatMessage }) => (
                <ChatMessageRow
                    item={item}
                    userId={userId}
                    onLongPress={onLongPress}
                    onReactionTap={onReactionTap}
                />
            ),
            [onLongPress, onReactionTap, userId],
        );

        return (
            <FlatList
                ref={ref}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                inverted
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                contentContainerStyle={styles.messagesList}
                initialNumToRender={initialNumToRender}
                windowSize={windowSize}
                maxToRenderPerBatch={maxToRenderPerBatch}
                updateCellsBatchingPeriod={updateCellsBatchingPeriod}
                removeClippedSubviews
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#3b82f6"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyTitle}>No messages yet</Text>
                            <Text style={styles.emptyText}>Start the conversation!</Text>
                            <TouchableOpacity
                                style={styles.emptyPrimaryButton}
                                onPress={onFocusInput}
                            >
                                <Text style={styles.emptyPrimaryText}>Send first message</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                }
            />
        );
    }
));

const TypingDots = memo(function TypingDots() {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const makePulse = (value: Animated.Value, delay: number) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(value, {
                        toValue: 1,
                        duration: 350,
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: 0.3,
                        duration: 350,
                        useNativeDriver: true,
                    }),
                    Animated.delay(200),
                ]),
            );

        const a1 = makePulse(dot1, 0);
        const a2 = makePulse(dot2, 120);
        const a3 = makePulse(dot3, 240);
        a1.start();
        a2.start();
        a3.start();
        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, [dot1, dot2, dot3]);

    return (
        <View style={styles.typingDots}>
            <Animated.View style={[styles.typingDot, { opacity: dot1 }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot2 }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot3 }]} />
        </View>
    );
});

const TypingIndicator = memo(function TypingIndicator({
    users,
}: {
    users: Array<{ name: string; avatar?: string | null }>;
}) {
    if (!users.length) return null;
    const display = users.slice(0, 2);
    const names = display.map((user) => user.name);
    const suffix = users.length > 2 ? ' and others' : '';
    return (
        <View style={styles.typingRow}>
            <View style={styles.typingAvatars}>
                {display.map((user, index) => (
                    <View key={`${user.name}-${index}`} style={styles.typingAvatar}>
                        <Text style={styles.typingAvatarText}>
                            {user.name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                ))}
            </View>
            <Text style={styles.typingText}>
                {names.join(', ')}
                {suffix} typing
            </Text>
            <TypingDots />
        </View>
    );
});

export function ChatScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const introAnim = useRef(createSlideUp(260, 12)).current;
    const { workspaceId, workspaceName } = route.params;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showActionsModal, setShowActionsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [editText, setEditText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
    const [searchQuery, setSearchQuery] = useState('');
    const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; avatar?: string | null; timestamp: number }>>({});
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput | null>(null);
    const ablyRef = useRef<Ably.Realtime | null>(null);
    const prevMessageCountRef = useRef(0);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const channelRef = useRef<Ably.Types.RealtimeChannel | null>(null);
    const lastTypingSentRef = useRef(0);
    const { user } = useAuth();

    const loadMessages = useCallback(async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        try {
            const cached = api.peekChatMessages(workspaceId);
            if (cached && cached.length > 0 && !showRefresh) {
                const sortedCached = [...cached].sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setMessages(dedupeMessages(sortedCached));
                setIsLoading(false);
            }
            const data = await api.getChatMessages(workspaceId, { limit: 100 });
            const sorted = [...data].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setMessages(dedupeMessages(sorted));
        } catch {
            Alert.alert('Error', 'Failed to load messages');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(loadMessages);
        navigation.setOptions({ title: workspaceName || 'Chat' });
        return () => task.cancel();
    }, [loadMessages, navigation, workspaceName]);

    useEffect(() => {
        introAnim.start();
    }, [introAnim]);

    useEffect(() => {
        if (isLoading) return;
        if (messages.length > prevMessageCountRef.current && !searchQuery.trim()) {
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            });
        }
        prevMessageCountRef.current = messages.length;
    }, [isLoading, messages.length, searchQuery]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers((prev) => {
                let changed = false;
                const next = { ...prev };
                Object.keys(next).forEach((userId) => {
                    if (now - next[userId].timestamp > TYPING_TIMEOUT_MS) {
                        delete next[userId];
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let isMounted = true;
        let channel: Ably.Types.RealtimeChannel | null = null;
        let connectionListener: Ably.Types.RealtimeConnectionListener | null = null;

        const setupRealtime = async () => {
            try {
                setRealtimeStatus('connecting');
                const client = new Ably.Realtime({
                    authCallback: async (_params, callback) => {
                        try {
                            const tokenRequest = await api.getAblyTokenRaw();
                            callback(null, tokenRequest);
                        } catch (error) {
                            callback(error as Error, null);
                        }
                    },
                    clientId: user?.id,
                });
                ablyRef.current = client;

                connectionListener = (stateChange) => {
                    if (!isMounted) return;
                    if (stateChange.current === 'connected') setRealtimeStatus('connected');
                    if (stateChange.current === 'disconnected' || stateChange.current === 'failed') {
                        setRealtimeStatus('disconnected');
                    }
                };
                client.connection.on(connectionListener);

                channel = client.channels.get(`workspace:${workspaceId}`);
                channelRef.current = channel;
                channel.subscribe('chat-event', (message) => {
                    if (!isMounted) return;
                    const payload = message.data as {
                        type?: string;
                        message?: ChatMessage;
                        reaction?: ChatReaction;
                        userId?: string;
                        name?: string;
                        avatar?: string | null;
                    };
                    if (payload?.type === 'message.created' && payload.message?.id) {
                        const normalized = normalizeRealtimeMessage(payload.message);
                        setMessages((prev) => dedupeMessages([normalized, ...prev]));
                    }
                    if (payload?.type === 'message.updated' && payload.message?.id) {
                        const normalized = normalizeRealtimeMessage(payload.message);
                        setMessages((prev) => prev.map((m) => (m.id === normalized.id ? normalized : m)));
                    }
                    if (payload?.type === 'message.deleted' && payload.message?.id) {
                        const normalized = normalizeRealtimeMessage(payload.message);
                        setMessages((prev) => prev.map((m) =>
                            m.id === normalized.id ? normalized : m
                        ));
                    }
                    if (payload?.type === 'reaction.created' && payload.reaction?.id) {
                        const reaction = normalizeRealtimeReaction(payload.reaction);
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === reaction.messageId
                                    ? m.reactions?.some((r) => r.id === reaction.id)
                                        ? m
                                        : { ...m, reactions: [...(m.reactions || []), reaction] }
                                    : m
                            )
                        );
                    }
                    if (payload?.type === 'reaction.deleted' && payload.reaction?.id) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === payload.reaction?.messageId
                                    ? { ...m, reactions: (m.reactions || []).filter((r) => r.id !== payload.reaction?.id) }
                                    : m
                            )
                        );
                    }
                    if (payload?.type === 'reaction.updated' && payload.message?.id) {
                        const normalized = normalizeRealtimeMessage(payload.message);
                        setMessages((prev) => prev.map((m) => (m.id === normalized.id ? normalized : m)));
                    }
                    if (payload?.type === 'typing' && payload.userId && payload.name) {
                        if (payload.userId === user?.id) return;
                        setTypingUsers((prev) => ({
                            ...prev,
                            [payload.userId as string]: {
                                name: payload.name as string,
                                avatar: payload.avatar ?? null,
                                timestamp: Date.now(),
                            },
                        }));
                    }
                });
            } catch {
                if (isMounted) setRealtimeStatus('disconnected');
            }
        };

        setupRealtime();

        return () => {
            isMounted = false;
            if (channel) {
                channel.unsubscribe();
            }
            channelRef.current = null;
            if (ablyRef.current) {
                if (connectionListener) {
                    ablyRef.current.connection.off(connectionListener);
                }
                ablyRef.current.close();
                ablyRef.current = null;
            }
        };
    }, [workspaceId, user?.id]);

    useEffect(() => {
        if (isLoading) return;
        if (realtimeStatus === 'connected') {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            void loadMessages();
            return;
        }
        if (pollTimerRef.current) return;
        pollTimerRef.current = setInterval(() => {
            void loadMessages();
        }, 15000);
        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, [isLoading, loadMessages, realtimeStatus]);

    const handleSend = async () => {
        const text = messageText.trim();
        if (!text) return;

        setIsSending(true);
        setMessageText('');

        try {
            const newMessage = await api.createChatMessage({
                workspaceId,
                body: text,
            });
            setMessages((prev) => dedupeMessages([newMessage, ...prev]));
        } catch {
            Alert.alert('Error', 'Failed to send message');
            setMessageText(text);
        } finally {
            setIsSending(false);
        }
    };

    const sendTyping = useCallback(() => {
        if (realtimeStatus !== 'connected') return;
        const channel = channelRef.current;
        if (!channel || !user?.id) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
        lastTypingSentRef.current = now;
        channel.publish('chat-event', {
            type: 'typing',
            userId: user.id,
            name: user.name || 'Teammate',
            avatar: user.avatar ?? null,
        });
    }, [realtimeStatus, user?.avatar, user?.id, user?.name]);

    const handleMessageLongPress = useCallback((message: ChatMessage) => {
        // Don't allow actions on deleted messages
        if (message.deletedAt) return;
        haptics.medium();
        setSelectedMessage(message);
        setShowActionsModal(true);
    }, []);

    const handleShowReactionPicker = () => {
        setShowActionsModal(false);
        setShowReactionPicker(true);
    };

    const handleAddReaction = useCallback(async (emoji: string, targetMessage?: ChatMessage) => {
        const message = targetMessage ?? selectedMessage;
        if (!message) return;
        haptics.light();
        setShowReactionPicker(false);

        // Check if user already reacted with this emoji
        const existingReaction = message.reactions?.find(
            (r) => r.emoji === emoji && r.userId === user?.id
        );

        if (existingReaction) {
            // Remove existing reaction
            try {
                await api.removeReaction({
                    workspaceId,
                    messageId: message.id,
                    reactionId: existingReaction.id,
                });
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === message.id
                            ? { ...m, reactions: m.reactions.filter((r) => r.id !== existingReaction.id) }
                            : m
                    )
                );
            } catch {
                Alert.alert('Error', 'Failed to remove reaction');
            }
        } else {
            // Add new reaction
            try {
                const newReaction = await api.addReaction({
                    workspaceId,
                    messageId: message.id,
                    emoji,
                });
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === message.id
                            ? { ...m, reactions: [...(m.reactions || []), { ...newReaction, messageId: message.id, createdAt: new Date() }] }
                            : m
                    )
                );
            } catch {
                Alert.alert('Error', 'Failed to add reaction');
            }
        }
        setSelectedMessage(null);
    }, [selectedMessage, user?.id, workspaceId]);

    const handleReactionTap = useCallback((message: ChatMessage, emoji: string) => {
        handleAddReaction(emoji, message);
    }, [handleAddReaction]);

    const handleEditMessage = () => {
        if (!selectedMessage) return;
        setEditText(selectedMessage.body);
        setShowActionsModal(false);
        setShowEditModal(true);
    };

    const confirmEditMessage = async () => {
        if (!selectedMessage || !editText.trim()) return;
        setIsProcessing(true);
        try {
            const updated = await api.updateChatMessage({
                workspaceId,
                messageId: selectedMessage.id,
                body: editText.trim(),
            });
            setMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? updated : m))
            );
            setShowEditModal(false);
            setSelectedMessage(null);
            setEditText('');
        } catch {
            Alert.alert('Error', 'Failed to edit message');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteMessage = async () => {
        if (!selectedMessage) return;
        setShowActionsModal(false);
        setIsProcessing(true);
        try {
            await api.deleteChatMessage({
                workspaceId,
                messageId: selectedMessage.id,
            });
            // Mark as deleted locally
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === selectedMessage.id
                        ? { ...m, deletedAt: new Date() }
                        : m
                )
            );
            setSelectedMessage(null);
        } catch {
            Alert.alert('Error', 'Failed to delete message');
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredMessages = useMemo(() => {
        if (!searchQuery.trim()) return messages;
        const query = searchQuery.trim().toLowerCase();
        return messages.filter((message) => message.body?.toLowerCase().includes(query));
    }, [messages, searchQuery]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <BackgroundGlow tint="amber" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <View style={styles.workspaceIcon}>
                            <Text style={styles.workspaceEmoji}>💬</Text>
                        </View>
                        <View style={styles.headerInfo}>
                            <Text style={styles.headerTitle} numberOfLines={1}>{workspaceName}</Text>
                            <Text style={styles.headerSubtitle}>Team Chat</Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <View style={styles.statusBadge}>
                            <View
                                style={[
                                    styles.statusDot,
                                    realtimeStatus === 'connected'
                                        ? styles.statusDotLive
                                        : realtimeStatus === 'connecting'
                                            ? styles.statusDotConnecting
                                            : styles.statusDotOffline,
                                ]}
                            />
                            <Text style={styles.statusText}>
                                {realtimeStatus === 'connected'
                                    ? 'Live'
                                    : realtimeStatus === 'connecting'
                                        ? 'Syncing'
                                        : 'Offline'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.searchRow}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search messages..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                </View>

                {isLoading && messages.length === 0 ? (
                    <ChatSkeleton />
                ) : (
                    <ChatMessagesList
                        ref={flatListRef}
                        messages={filteredMessages}
                        userId={user?.id}
                        onLongPress={handleMessageLongPress}
                        onReactionTap={handleReactionTap}
                        onRefresh={() => loadMessages(true)}
                        refreshing={isRefreshing}
                        onFocusInput={() => inputRef.current?.focus()}
                    />
                )}

                {Object.keys(typingUsers).length > 0 && (
                    <TypingIndicator
                        users={Object.values(typingUsers).map((entry) => ({
                            name: entry.name,
                            avatar: entry.avatar,
                        }))}
                    />
                )}

                <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 16 }]}>
                    <TextInput
                        ref={inputRef}
                        style={styles.textInput}
                        placeholder="Type a message..."
                        placeholderTextColor="#666"
                        value={messageText}
                        onChangeText={(value) => {
                            setMessageText(value);
                            sendTyping();
                        }}
                        multiline
                        maxLength={2000}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
                        onPress={handleSend}
                        disabled={!messageText.trim() || isSending}
                    >
                        {isSending ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.sendButtonText}>↑</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </Animated.View>

            {/* Message Actions Modal */}
            <Modal
                visible={showActionsModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowActionsModal(false)}
            >
                <TouchableOpacity
                    style={styles.actionOverlay}
                    activeOpacity={1}
                    onPress={() => setShowActionsModal(false)}
                >
                    <View style={styles.actionSheet}>
                        <TouchableOpacity style={styles.actionItem} onPress={handleShowReactionPicker}>
                            <Text style={styles.actionIcon}>😀</Text>
                            <Text style={styles.actionText}>React</Text>
                        </TouchableOpacity>
                        {selectedMessage?.sender?.id === user?.id && (
                            <>
                                <TouchableOpacity style={styles.actionItem} onPress={handleEditMessage}>
                                    <Text style={styles.actionIcon}>✏️</Text>
                                    <Text style={styles.actionText}>Edit Message</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionItem, styles.actionItemDanger]} onPress={handleDeleteMessage}>
                                    <Text style={styles.actionIcon}>🗑️</Text>
                                    <Text style={[styles.actionText, styles.actionTextDanger]}>Delete Message</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity style={styles.actionCancel} onPress={() => setShowActionsModal(false)}>
                            <Text style={styles.actionCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Edit Message Modal */}
            <Modal
                visible={showEditModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.editOverlay}>
                    <View style={styles.editContent}>
                        <Text style={styles.editTitle}>Edit Message</Text>
                        <TextInput
                            style={styles.editInput}
                            placeholder="Message"
                            placeholderTextColor="#666"
                            value={editText}
                            onChangeText={setEditText}
                            multiline
                            autoFocus
                        />
                        <View style={styles.editButtons}>
                            <TouchableOpacity
                                style={styles.editCancelButton}
                                onPress={() => {
                                    setShowEditModal(false);
                                    setEditText('');
                                }}
                            >
                                <Text style={styles.editCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.editSaveButton, isProcessing && styles.buttonDisabled]}
                                onPress={confirmEditMessage}
                                disabled={isProcessing || !editText.trim()}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.editSaveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Reaction Picker Modal */}
            <Modal
                visible={showReactionPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowReactionPicker(false)}
            >
                <TouchableOpacity
                    style={styles.reactionPickerOverlay}
                    activeOpacity={1}
                    onPress={() => setShowReactionPicker(false)}
                >
                    <View style={styles.reactionPickerContent}>
                        <Text style={styles.reactionPickerTitle}>React</Text>
                        <View style={styles.reactionPickerGrid}>
                            {REACTION_EMOJIS.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={styles.reactionPickerItem}
                                    onPress={() => handleAddReaction(emoji)}
                                >
                                    <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1f1f1f',
        backgroundColor: '#0a0a0a',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#262626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '500',
    },
    headerCenter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
    },
    workspaceIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#141414',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#262626',
    },
    workspaceEmoji: {
        fontSize: 18,
    },
    systemMessageRow: {
        alignItems: 'center',
        marginVertical: 8,
        paddingHorizontal: 16,
    },
    systemMessageText: {
        color: '#666',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    headerInfo: {
        marginLeft: 10,
        flex: 1,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    headerSubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 1,
    },
    headerRight: {
        width: 72,
        alignItems: 'flex-end',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#101010',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#262626',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#a3a3a3',
    },
    statusDotLive: {
        backgroundColor: '#22c55e',
    },
    statusDotConnecting: {
        backgroundColor: '#f59e0b',
    },
    statusDotOffline: {
        backgroundColor: '#ef4444',
    },
    statusText: {
        color: '#e5e7eb',
        fontSize: 11,
        fontWeight: '600',
    },
    searchRow: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: '#0a0a0a',
    },
    searchInput: {
        backgroundColor: '#141414',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#262626',
    },
    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 4,
        backgroundColor: '#0a0a0a',
    },
    typingAvatars: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 2,
    },
    typingAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#1f2937',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#111827',
        marginRight: -6,
    },
    typingAvatarText: {
        color: '#e5e7eb',
        fontSize: 10,
        fontWeight: '700',
    },
    typingText: {
        color: '#9aa0a6',
        fontSize: 12,
        fontStyle: 'italic',
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 6,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#9aa0a6',
    },
    messagesList: {
        padding: 16,
        flexGrow: 1,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    messageRowMine: {
        justifyContent: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    messageBubble: {
        maxWidth: '75%',
        backgroundColor: '#141414',
        borderRadius: 16,
        borderTopLeftRadius: 4,
        padding: 10,
        borderWidth: 1,
        borderColor: '#262626',
    },
    messageBubbleMine: {
        backgroundColor: '#2563eb',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 4,
        borderColor: '#2563eb',
    },
    senderName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
    },
    messageTextMine: {
        color: '#fff',
    },
    messageTime: {
        fontSize: 12,
        color: '#9aa0a6',
        marginTop: 6,
    },
    messageTimeMine: {
        color: 'rgba(255,255,255,0.75)',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyCard: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        marginBottom: 16,
    },
    emptyPrimaryButton: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f59e0b',
    },
    emptyPrimaryText: {
        color: '#0a0a0a',
        fontSize: 14,
        fontWeight: '700',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: '#222',
        gap: 12,
    },
    textInput: {
        flex: 1,
        backgroundColor: '#141414',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#fff',
        maxHeight: 120,
        borderWidth: 1,
        borderColor: '#262626',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
    },
    // Message editing/deleted styles
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 5,
    },
    messageTextDeleted: {
        fontStyle: 'italic',
        color: '#7c7f85',
    },
    editedLabel: {
        fontSize: 10,
        color: '#7c7f85',
        fontStyle: 'italic',
    },
    editedLabelMine: {
        color: 'rgba(255,255,255,0.5)',
    },
    // Action sheet modal styles
    actionOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
        paddingBottom: 40,
    },
    actionSheet: {
        backgroundColor: '#111',
        borderRadius: 16,
        marginHorizontal: 16,
        overflow: 'hidden',
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    actionItemDanger: {
        borderBottomWidth: 0,
    },
    actionIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    actionText: {
        color: '#fff',
        fontSize: 16,
    },
    actionTextDanger: {
        color: '#ef4444',
    },
    actionCancel: {
        padding: 16,
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        marginTop: 8,
    },
    actionCancelText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    // Edit modal styles
    editOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    editContent: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#222',
    },
    editTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    editInput: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 16,
    },
    editButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    editCancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },
    editCancelText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
    },
    editSaveButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    editSaveText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    // Reaction styles
    reactionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        gap: 6,
    },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#333',
    },
    reactionBadgeActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: '#3b82f6',
    },
    reactionEmoji: {
        fontSize: 14,
    },
    reactionCount: {
        fontSize: 12,
        color: '#888',
        marginLeft: 4,
    },
    reactionCountActive: {
        color: '#3b82f6',
    },
    reactionPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    reactionPickerContent: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#222',
        width: '80%',
    },
    reactionPickerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    reactionPickerGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
    },
    reactionPickerItem: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        margin: 4,
    },
    reactionPickerEmoji: {
        fontSize: 24,
    },
});
