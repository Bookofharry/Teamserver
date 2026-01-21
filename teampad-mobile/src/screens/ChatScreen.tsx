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
} from 'react-native';
import { api } from '../api/restApi';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

type ChatParams = {
    workspaceId: string;
    workspaceName: string;
};

type Props = {
    navigation: NativeStackNavigationProp<any>;
    route: RouteProp<{ Chat: ChatParams }, 'Chat'>;
};

export function ChatScreen({ navigation, route }: Props) {
    const { workspaceId, workspaceName } = route.params;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);
    const { user } = useAuth();

    const loadMessages = useCallback(async () => {
        try {
            const data = await api.getChatMessages(workspaceId, { limit: 100 });
            setMessages(data.reverse());
        } catch (error) {
            Alert.alert('Error', 'Failed to load messages');
        } finally {
            setIsLoading(false);
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
            setMessages((prev) => [...prev, newMessage]);
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            Alert.alert('Error', 'Failed to send message');
            setMessageText(text);
        } finally {
            setIsSending(false);
        }
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isMine = item.sender?.id === user?.id;
        const isDeleted = Boolean(item.deletedAt);

        return (
            <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
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
                    <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
                        {isDeleted ? 'Message deleted' : item.body}
                    </Text>
                    <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
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
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>💬 {workspaceName}</Text>
                <View style={{ width: 60 }} />
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
        </KeyboardAvoidingView>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    backButton: {
        padding: 8,
        width: 60,
    },
    backText: {
        color: '#3b82f6',
        fontSize: 16,
        fontWeight: '500',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
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
});
