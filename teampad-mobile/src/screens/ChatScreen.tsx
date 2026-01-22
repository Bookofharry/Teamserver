import React, { useEffect, useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/restApi';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';
import type { ChatMessage } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
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
    const flatListRef = useRef<FlatList>(null);
    const { user } = useAuth();

    const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

    const loadMessages = useCallback(async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        try {
            const data = await api.getChatMessages(workspaceId, { limit: 100 });
            const sorted = [...data].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            setMessages(sorted);
        } catch {
            Alert.alert('Error', 'Failed to load messages');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        loadMessages();
        navigation.setOptions({ title: workspaceName || 'Chat' });
    }, [loadMessages, navigation, workspaceName]);

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
            setMessages((prev) => [newMessage, ...prev]);
        } catch {
            Alert.alert('Error', 'Failed to send message');
            setMessageText(text);
        } finally {
            setIsSending(false);
        }
    };

    const handleMessageLongPress = (message: ChatMessage) => {
        // Don't allow actions on deleted messages
        if (message.deletedAt) return;
        haptics.medium();
        setSelectedMessage(message);
        setShowActionsModal(true);
    };

    const handleShowReactionPicker = () => {
        setShowActionsModal(false);
        setShowReactionPicker(true);
    };

    const handleAddReaction = async (emoji: string) => {
        if (!selectedMessage) return;
        haptics.light();
        setShowReactionPicker(false);

        // Check if user already reacted with this emoji
        const existingReaction = selectedMessage.reactions?.find(
            (r) => r.emoji === emoji && r.userId === user?.id
        );

        if (existingReaction) {
            // Remove existing reaction
            try {
                await api.removeReaction({
                    workspaceId,
                    messageId: selectedMessage.id,
                    reactionId: existingReaction.id,
                });
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === selectedMessage.id
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
                    messageId: selectedMessage.id,
                    emoji,
                });
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === selectedMessage.id
                            ? { ...m, reactions: [...(m.reactions || []), { ...newReaction, messageId: selectedMessage.id, createdAt: new Date() }] }
                            : m
                    )
                );
            } catch {
                Alert.alert('Error', 'Failed to add reaction');
            }
        }
        setSelectedMessage(null);
    };

    const handleReactionTap = (message: ChatMessage, emoji: string) => {
        setSelectedMessage(message);
        handleAddReaction(emoji);
    };

    const groupReactions = (reactions: ChatMessage['reactions']) => {
        const grouped: { [emoji: string]: { count: number; userReacted: boolean; reactionId?: string } } = {};
        reactions?.forEach((r) => {
            if (!grouped[r.emoji]) {
                grouped[r.emoji] = { count: 0, userReacted: false };
            }
            grouped[r.emoji].count++;
            if (r.userId === user?.id) {
                grouped[r.emoji].userReacted = true;
                grouped[r.emoji].reactionId = r.id;
            }
        });
        return grouped;
    };

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

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isMine = item.sender?.id === user?.id;
        const isDeleted = Boolean(item.deletedAt);
        const isSystemMessage = item.messageType === 'system' ||
            item.body?.toLowerCase().includes('joined') ||
            item.body?.toLowerCase().includes('left');

        // Render system messages as minimal alerts
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
                onLongPress={() => handleMessageLongPress(item)}
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
                    {/* Reactions Display */}
                    {item.reactions && item.reactions.length > 0 && !isDeleted && (
                        <View style={styles.reactionsContainer}>
                            {Object.entries(groupReactions(item.reactions)).map(([emoji, data]) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={[styles.reactionBadge, data.userReacted && styles.reactionBadgeActive]}
                                    onPress={() => handleReactionTap(item, emoji)}
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
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
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
                <View style={styles.headerRight} />
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                inverted
                maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                contentContainerStyle={styles.messagesList}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadMessages(true)}
                        tintColor="#3b82f6"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No messages yet</Text>
                        <Text style={styles.emptyText}>Start the conversation!</Text>
                    </View>
                }
            />

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#666"
                    value={messageText}
                    onChangeText={setMessageText}
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
        borderBottomColor: '#1a1a1a',
        backgroundColor: '#0a0a0a',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
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
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
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
        fontSize: 16,
        fontWeight: '600',
    },
    headerSubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 1,
    },
    headerRight: {
        width: 40,
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
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        borderTopLeftRadius: 4,
        padding: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    messageBubbleMine: {
        backgroundColor: '#3b82f6',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 4,
        borderColor: '#3b82f6',
    },
    senderName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3b82f6',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 15,
        color: '#fff',
        lineHeight: 20,
    },
    messageTextMine: {
        color: '#fff',
    },
    messageTime: {
        fontSize: 10,
        color: '#888',
        marginTop: 6,
    },
    messageTimeMine: {
        color: 'rgba(255,255,255,0.7)',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#888',
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
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#fff',
        maxHeight: 120,
        borderWidth: 1,
        borderColor: '#333',
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
        marginTop: 4,
    },
    messageTextDeleted: {
        fontStyle: 'italic',
        color: '#666',
    },
    editedLabel: {
        fontSize: 10,
        color: '#666',
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
        fontSize: 15,
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
        fontSize: 15,
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
        fontSize: 15,
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
