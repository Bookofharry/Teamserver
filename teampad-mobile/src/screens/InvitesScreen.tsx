import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    Modal,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/restApi';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../utils/animations';
import type { AppStackParamList } from '../navigation';
import type { WorkspaceInvite } from '../types';

type Props = NativeStackScreenProps<AppStackParamList, 'Invites'>;

export function InvitesScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const introAnim = useRef(createSlideUp(260, 12)).current;
    const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [processingToken, setProcessingToken] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);

    const loadInvites = useCallback(async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        try {
            const data = await api.listMyInvites();
            setInvites(data);
        } catch {
            setFeedback({ title: 'Could not load invites', message: 'Please try again.' });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        introAnim.start();
    }, [introAnim]);

    useEffect(() => {
        void loadInvites();
    }, [loadInvites]);

    const handleAccept = async (invite: WorkspaceInvite) => {
        setProcessingToken(invite.token);
        try {
            await api.acceptInvite(invite.token);
            setInvites((prev) => prev.filter((item) => item.token !== invite.token));
            setFeedback({
                title: 'Invite accepted',
                message: `You joined ${invite.workspaceName || 'a workspace'}.`,
            });
            navigation.navigate('Workspaces');
        } catch (error) {
            setFeedback({
                title: 'Invite failed',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setProcessingToken(null);
        }
    };

    const handleDecline = async (invite: WorkspaceInvite) => {
        setProcessingToken(invite.token);
        try {
            await api.declineInvite(invite.token);
            setInvites((prev) => prev.filter((item) => item.token !== invite.token));
            setFeedback({
                title: 'Invite declined',
                message: `Invite to ${invite.workspaceName || 'workspace'} removed.`,
            });
        } catch (error) {
            setFeedback({
                title: 'Decline failed',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setProcessingToken(null);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <BackgroundGlow tint="purple" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Invites</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <FlatList
                    data={invites}
                    keyExtractor={(item) => item.token}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => loadInvites(true)}
                            tintColor="#3b82f6"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyTitle}>No invites yet</Text>
                                <Text style={styles.emptyText}>New workspace invites will show up here.</Text>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.inviteCard}>
                            <View style={styles.inviteHeader}>
                                <Text style={styles.inviteWorkspace} numberOfLines={1}>
                                    {item.workspaceName || 'Workspace'}
                                </Text>
                                <Text style={styles.inviteRole}>{item.role}</Text>
                            </View>
                            <Text style={styles.inviteMeta}>
                                Invited by {item.inviter?.name || 'Teammate'}
                            </Text>
                            <View style={styles.inviteActions}>
                                <TouchableOpacity
                                    style={styles.declineButton}
                                    onPress={() => handleDecline(item)}
                                    disabled={processingToken === item.token}
                                >
                                    <Text style={styles.declineText}>Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.acceptButton}
                                    onPress={() => handleAccept(item)}
                                    disabled={processingToken === item.token}
                                >
                                    {processingToken === item.token ? (
                                        <ActivityIndicator size="small" color="#0a0a0a" />
                                    ) : (
                                        <Text style={styles.acceptText}>Accept</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            </Animated.View>

            <Modal
                visible={Boolean(feedback)}
                transparent
                animationType="fade"
                onRequestClose={() => setFeedback(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{feedback?.title}</Text>
                        <Text style={styles.modalSubtitle}>{feedback?.message}</Text>
                        <TouchableOpacity
                            style={styles.modalButton}
                            onPress={() => setFeedback(null)}
                        >
                            <Text style={styles.modalButtonText}>Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
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
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    backButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#262626',
    },
    backText: {
        color: '#dbeafe',
        fontSize: 14,
        fontWeight: '600',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 60,
    },
    list: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 24,
    },
    inviteCard: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#222',
        marginBottom: 12,
    },
    inviteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    inviteWorkspace: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 12,
    },
    inviteRole: {
        color: '#93c5fd',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    inviteMeta: {
        color: '#8b8f94',
        fontSize: 13,
        marginBottom: 12,
    },
    inviteActions: {
        flexDirection: 'row',
        gap: 12,
    },
    declineButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },
    declineText: {
        color: '#9aa0a6',
        fontSize: 14,
        fontWeight: '600',
    },
    acceptButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    acceptText: {
        color: '#0a0a0a',
        fontSize: 14,
        fontWeight: '700',
    },
    empty: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptyCard: {
        width: '100%',
        padding: 20,
        borderRadius: 16,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyText: {
        color: '#8b8f94',
        fontSize: 14,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1e293b',
        alignItems: 'center',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    modalSubtitle: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    modalButton: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
    },
    modalButtonText: {
        color: '#0a0a0a',
        fontSize: 14,
        fontWeight: '700',
    },
});
