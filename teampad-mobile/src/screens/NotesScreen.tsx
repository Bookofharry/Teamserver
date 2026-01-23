import React, { memo, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Animated,
    InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/restApi';
import { useAuth } from '../context/AuthContext';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../utils/animations';
import { listPerfConfig } from '../utils/perf';
import type { Note, Group, WorkspaceMember } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Notes'>;

type NoteCardProps = {
    item: Note;
    onPress: (note: Note) => void;
};

const NOTE_CARD_HEIGHT = 100;
const NOTE_CARD_SPACING = 10;
const NOTES_LIST_PADDING_TOP = 8;
const NOTES_LIST_PADDING_HORIZONTAL = 20;
const NOTES_LIST_PADDING_BOTTOM = 20;
const NoteCard = memo(function NoteCard({ item, onPress }: NoteCardProps) {
    return (
        <TouchableOpacity style={styles.noteCard} onPress={() => onPress(item)}>
            <View style={styles.noteTitleRow}>
                {item.isPinned && <Text style={styles.pinIndicator}>📌</Text>}
                <Text style={[styles.noteTitle, item.isPinned && styles.noteTitlePinned]} numberOfLines={1}>
                    {item.title || 'Untitled'}
                </Text>
            </View>
            <Text style={styles.notePreview} numberOfLines={2}>
                {item.bodyPreview || item.body || 'No content'}
            </Text>
            <Text style={styles.noteDate}>
                {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
        </TouchableOpacity>
    );
});

export function NotesScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const introAnim = useRef(createSlideUp(260, 12)).current;
    const { workspaceId, workspaceName } = route.params;
    const { user } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPinnedOnly, setShowPinnedOnly] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isNotesLoading, setIsNotesLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [showGroupPicker, setShowGroupPicker] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [members, setMembers] = useState<WorkspaceMember[]>([]);
    const [isMembersLoading, setIsMembersLoading] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'member' | 'admin' | 'owner'>('member');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteFeedback, setInviteFeedback] = useState<{ title: string; message: string } | null>(null);
    const selectedGroupIdRef = useRef<string | null>(null);
    const hasLoadedOnceRef = useRef(false);
    const {
        initialNumToRender,
        windowSize,
        maxToRenderPerBatch,
        updateCellsBatchingPeriod,
    } = listPerfConfig;

    useEffect(() => {
        selectedGroupIdRef.current = selectedGroupId;
    }, [selectedGroupId]);

    // Always sort groups so "General" comes first
    const sortedGroups = useMemo(() => {
        return [...groups].sort((a, b) => {
            const aIsGeneral = a.name.toLowerCase().startsWith('general');
            const bIsGeneral = b.name.toLowerCase().startsWith('general');
            if (aIsGeneral && !bIsGeneral) return -1;
            if (bIsGeneral && !aIsGeneral) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [groups]);

    const loadGroups = useCallback(async () => {
        const groupsData = await api.getGroups(workspaceId);
        setGroups(groupsData);
        // Select "General" group by default on initial load
        if (!selectedGroupIdRef.current && groupsData.length > 0) {
            const generalGroup = groupsData.find(g => g.name.toLowerCase().startsWith('general'));
            setSelectedGroupId(generalGroup?.id || groupsData[0].id);
        }
        return groupsData;
    }, [workspaceId]);

    const trimmedSearch = useMemo(() => searchQuery.trim(), [searchQuery]);

    const loadNotes = useCallback(async (groupId: string | null) => {
        const notesData = await api.getNotes(workspaceId, groupId, trimmedSearch, { limit: 50 });
        setNotes(notesData);
    }, [workspaceId, trimmedSearch]);

    useEffect(() => {
        let cancelled = false;
        const fetchGroups = async () => {
            try {
                await loadGroups();
            } catch {
                if (!cancelled) {
                    Alert.alert('Error', 'Failed to load notes');
                }
            }
        };
        const task = InteractionManager.runAfterInteractions(fetchGroups);
        return () => {
            cancelled = true;
            task.cancel();
        };
    }, [loadGroups]);

    useEffect(() => {
        if (groups.length > 0 && !selectedGroupId) return;
        let cancelled = false;
        const fetchNotes = async () => {
            if (!hasLoadedOnceRef.current) {
                setIsLoading(true);
            } else {
                setIsNotesLoading(true);
            }
            try {
                await loadNotes(selectedGroupId);
            } catch {
                if (!cancelled) {
                    Alert.alert('Error', 'Failed to load notes');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                    setIsRefreshing(false);
                    setIsNotesLoading(false);
                    hasLoadedOnceRef.current = true;
                }
            }
        };
        const task = InteractionManager.runAfterInteractions(fetchNotes);
        return () => {
            cancelled = true;
            task.cancel();
        };
    }, [groups.length, loadNotes, selectedGroupId]);

    useEffect(() => {
        navigation.setOptions({ title: workspaceName || 'Notes' });
    }, [navigation, workspaceName]);

    useEffect(() => {
        introAnim.start();
    }, [introAnim]);

    const handleCreateNote = async () => {
        if (!selectedGroupId) {
            if (groups.length === 0) {
                try {
                    const group = await api.createGroup({ workspaceId, name: 'General' });
                    setGroups([group]);
                    setSelectedGroupId(group.id);
                } catch {
                    Alert.alert('Error', 'Failed to create collection');
                    return;
                }
            } else {
                setSelectedGroupId(groups[0].id);
            }
        }

        const groupId = selectedGroupId || groups[0]?.id;
        if (!groupId) return;

        try {
            const note = await api.createNote({
                workspaceId,
                groupId,
                title: 'Untitled',
                body: '',
            });
            navigation.navigate('NoteEditor', { workspaceId, noteId: note.id, noteTitle: note.title });
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create note');
        }
    };

    const handleNotePress = useCallback((note: Note) => {
        navigation.navigate('NoteEditor', { workspaceId, noteId: note.id, noteTitle: note.title });
    }, [navigation, workspaceId]);

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        setIsCreatingGroup(true);
        try {
            const group = await api.createGroup({
                workspaceId,
                name: newGroupName.trim()
            });
            setGroups((prev) => [...prev, group]);
            setSelectedGroupId(group.id);
            setShowCreateGroupModal(false);
            setNewGroupName('');
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create collection');
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const handleGroupSelect = useCallback((groupId: string) => {
        setSelectedGroupId(groupId);
    }, []);

    const selectedGroup = useMemo(() => {
        if (!selectedGroupId) return null;
        return groups.find((group) => group.id === selectedGroupId) ?? null;
    }, [groups, selectedGroupId]);

    const renderNote = useCallback(
        ({ item }: { item: Note }) => (
            <NoteCard item={item} onPress={handleNotePress} />
        ),
        [handleNotePress],
    );

    const filteredNotes = useMemo(() => {
        return notes
            .filter((note) => !selectedGroupId || note.groupId === selectedGroupId)
            .filter((note) => !showPinnedOnly || note.isPinned)
            .sort((a, b) => {
                // Pinned notes first
                if (a.isPinned && !b.isPinned) return -1;
                if (b.isPinned && !a.isPinned) return 1;
                // Then by updated date
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [notes, selectedGroupId, showPinnedOnly]);

    const loadMembers = useCallback(async () => {
        setIsMembersLoading(true);
        try {
            const data = await api.getMembers(workspaceId);
            setMembers(data);
        } catch {
            Alert.alert('Error', 'Failed to load members');
        } finally {
            setIsMembersLoading(false);
        }
    }, [workspaceId]);

    const currentRole = useMemo(() => {
        const member = members.find((entry) => entry.userId === user?.id);
        return member?.role ?? 'member';
    }, [members, user?.id]);

    const canInviteOwner = currentRole === 'owner';
    const canInviteMembers = currentRole === 'owner' || currentRole === 'admin';

    const handleInvite = async () => {
        if (!canInviteMembers) {
            setInviteFeedback({ title: 'Invite failed', message: 'Only admins can invite members.' });
            return;
        }
        if (!inviteEmail.trim()) {
            setInviteFeedback({ title: 'Invite failed', message: 'Email is required.' });
            return;
        }
        setIsInviting(true);
        try {
            await api.createInvite({
                workspaceId,
                email: inviteEmail.trim(),
                role: inviteRole,
            });
            setInviteFeedback({
                title: 'Invite sent',
                message: `Invitation sent to ${inviteEmail.trim()}.`,
            });
            setInviteEmail('');
            setInviteRole('member');
            setShowInviteModal(false);
        } catch (error) {
            setInviteFeedback({
                title: 'Invite failed',
                message: error instanceof Error ? error.message : 'Please try again.',
            });
        } finally {
            setIsInviting(false);
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
            <BackgroundGlow tint="green" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.chatButton}
                        onPress={() => {
                            void api.getChatMessages(workspaceId, { limit: 100 }).catch(() => {});
                            navigation.navigate('Chat', { workspaceId, workspaceName });
                        }}
                    >
                        <Text style={styles.chatButtonText}>💬 Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.membersButton}
                        onPress={() => {
                            setShowMembersModal(true);
                            void loadMembers();
                        }}
                    >
                        <Text style={styles.membersButtonText}>👥 {members.length || 'Members'}</Text>
                    </TouchableOpacity>
                </View>
                </View>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search notes..."
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />

                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.filterChip, !showPinnedOnly && styles.filterChipActive]}
                        onPress={() => setShowPinnedOnly(false)}
                    >
                        <Text style={[styles.filterChipText, !showPinnedOnly && styles.filterChipTextActive]}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, showPinnedOnly && styles.filterChipActive]}
                        onPress={() => setShowPinnedOnly(true)}
                    >
                        <Text style={[styles.filterChipText, showPinnedOnly && styles.filterChipTextActive]}>Pinned</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Collections</Text>
                    <View style={styles.sectionMeta}>
                        <View style={styles.sectionBadge}>
                            <Text style={styles.sectionBadgeText}>
                                {filteredNotes.length} note{filteredNotes.length === 1 ? '' : 's'}
                            </Text>
                        </View>
                        {isNotesLoading && (
                            <ActivityIndicator size="small" color="#3b82f6" />
                        )}
                    </View>
                </View>

                <View style={styles.groupsRow}>
                    <TouchableOpacity
                        style={styles.groupPicker}
                        onPress={() => setShowGroupPicker(true)}
                    >
                        <View style={styles.groupPickerDot} />
                        <Text style={styles.groupPickerText} numberOfLines={1}>
                            {selectedGroup?.name || 'All collections'}
                        </Text>
                        <Text style={styles.groupPickerChevron}>▾</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addGroupButton}
                        onPress={() => setShowCreateGroupModal(true)}
                    >
                        <Text style={styles.addGroupButtonText}>+</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={filteredNotes}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNote}
                    contentContainerStyle={styles.notesList}
                    getItemLayout={(_, index) => ({
                        length: NOTE_CARD_HEIGHT + NOTE_CARD_SPACING,
                        offset: NOTES_LIST_PADDING_TOP + (NOTE_CARD_HEIGHT + NOTE_CARD_SPACING) * index,
                        index,
                    })}
                    initialNumToRender={initialNumToRender}
                    windowSize={windowSize}
                    maxToRenderPerBatch={maxToRenderPerBatch}
                    updateCellsBatchingPeriod={updateCellsBatchingPeriod}
                    removeClippedSubviews
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={async () => {
                                setIsRefreshing(true);
                                try {
                                    const groupsData = await loadGroups();
                                    const nextGroupId = selectedGroupId ?? groupsData[0]?.id ?? null;
                                    await loadNotes(nextGroupId);
                                } catch {
                                    Alert.alert('Error', 'Failed to load notes');
                                } finally {
                                    setIsRefreshing(false);
                                }
                            }}
                            tintColor="#3b82f6"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyTitle}>No notes yet</Text>
                                <Text style={styles.emptyText}>Create your first note</Text>
                                <TouchableOpacity
                                    style={styles.emptyPrimaryButton}
                                    onPress={handleCreateNote}
                                >
                                    <Text style={styles.emptyPrimaryText}>Create note</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    }
                />

                <TouchableOpacity style={styles.fab} onPress={handleCreateNote}>
                    <Text style={styles.fabText}>+</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Create Group Modal */}
            <Modal
                visible={showCreateGroupModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateGroupModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Collection</Text>
                        <Text style={styles.modalSubtitle}>Create a group for your notes</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Collection name"
                            placeholderTextColor="#666"
                            value={newGroupName}
                            onChangeText={setNewGroupName}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={handleCreateGroup}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setShowCreateGroupModal(false);
                                    setNewGroupName('');
                                }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalCreateButton, isCreatingGroup && styles.modalButtonDisabled]}
                                onPress={handleCreateGroup}
                                disabled={isCreatingGroup}
                            >
                                {isCreatingGroup ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalCreateText}>Create</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal
                visible={showMembersModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMembersModal(false)}
            >
                <View style={styles.membersOverlay}>
                    <View style={styles.membersContent}>
                        <View style={styles.membersHeader}>
                            <Text style={styles.membersTitle}>Workspace members</Text>
                            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                                <Text style={styles.membersClose}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        {canInviteMembers && (
                            <TouchableOpacity
                                style={styles.inviteButton}
                                onPress={() => setShowInviteModal(true)}
                            >
                                <Text style={styles.inviteButtonText}>Invite member</Text>
                            </TouchableOpacity>
                        )}
                        {isMembersLoading ? (
                            <View style={styles.membersLoading}>
                                <ActivityIndicator size="small" color="#3b82f6" />
                            </View>
                        ) : (
                            <FlatList
                                data={members}
                                keyExtractor={(item) => item.userId}
                                renderItem={({ item }) => (
                                    <View style={styles.memberRow}>
                                        <View style={styles.memberAvatar}>
                                            <Text style={styles.memberAvatarText}>
                                                {item.user?.name?.charAt(0).toUpperCase() || 'M'}
                                            </Text>
                                        </View>
                                        <View style={styles.memberInfo}>
                                            <Text style={styles.memberName}>{item.user?.name || 'Member'}</Text>
                                            <Text style={styles.memberMeta}>{item.role}</Text>
                                        </View>
                                    </View>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.memberDivider} />}
                                contentContainerStyle={styles.membersList}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showInviteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <View style={styles.inviteOverlay}>
                    <View style={styles.inviteContent}>
                        <Text style={styles.inviteTitle}>Invite to workspace</Text>
                        <Text style={styles.inviteSubtitle}>Send a secure invite link</Text>

                        <TextInput
                            style={styles.inviteInput}
                            placeholder="Email address"
                            placeholderTextColor="#666"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                        />

                        <View style={styles.inviteRoleRow}>
                            <Text style={styles.inviteRoleLabel}>Role</Text>
                            <View style={styles.inviteRoleChips}>
                                {(['member', 'admin', 'owner'] as const).map((role) => {
                                    if (role === 'owner' && !canInviteOwner) return null;
                                    const isActive = inviteRole === role;
                                    return (
                                        <TouchableOpacity
                                            key={role}
                                            style={[styles.roleChip, isActive && styles.roleChipActive]}
                                            onPress={() => setInviteRole(role)}
                                        >
                                            <Text style={[styles.roleChipText, isActive && styles.roleChipTextActive]}>
                                                {role}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View style={styles.inviteActions}>
                            <TouchableOpacity
                                style={styles.inviteCancelButton}
                                onPress={() => setShowInviteModal(false)}
                            >
                                <Text style={styles.inviteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.inviteSendButton, isInviting && styles.inviteDisabled]}
                                onPress={handleInvite}
                                disabled={isInviting}
                            >
                                {isInviting ? (
                                    <ActivityIndicator size="small" color="#0a0a0a" />
                                ) : (
                                    <Text style={styles.inviteSendText}>Send invite</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={Boolean(inviteFeedback)}
                transparent
                animationType="fade"
                onRequestClose={() => setInviteFeedback(null)}
            >
                <View style={styles.inviteFeedbackOverlay}>
                    <View style={styles.inviteFeedbackContent}>
                        <Text style={styles.inviteFeedbackTitle}>{inviteFeedback?.title}</Text>
                        <Text style={styles.inviteFeedbackMessage}>{inviteFeedback?.message}</Text>
                        <TouchableOpacity
                            style={styles.inviteFeedbackButton}
                            onPress={() => setInviteFeedback(null)}
                        >
                            <Text style={styles.inviteFeedbackText}>Okay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showGroupPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowGroupPicker(false)}
            >
                <View style={styles.groupPickerOverlay}>
                    <View style={styles.groupPickerContent}>
                        <View style={styles.groupPickerHeader}>
                            <Text style={styles.groupPickerTitle}>Collections</Text>
                            <TouchableOpacity onPress={() => setShowGroupPicker(false)}>
                                <Text style={styles.groupPickerClose}>Close</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={sortedGroups}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.groupPickerRow,
                                        selectedGroupId === item.id && styles.groupPickerRowActive,
                                    ]}
                                    onPress={() => {
                                        handleGroupSelect(item.id);
                                        setShowGroupPicker(false);
                                    }}
                                >
                                    <View style={[styles.groupPickerDot, { backgroundColor: item.color || '#3b82f6' }]} />
                                    <Text style={styles.groupPickerRowText}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.groupPickerDivider} />}
                            contentContainerStyle={styles.groupPickerList}
                        />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    chatButton: {
        backgroundColor: '#141414',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#262626',
    },
    chatButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    membersButton: {
        backgroundColor: '#0f172a',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    membersButtonText: {
        color: '#cbd5f5',
        fontSize: 13,
        fontWeight: '600',
    },
    searchInput: {
        backgroundColor: '#1a1a1a',
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#333',
    },
    groupPicker: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#141414',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#262626',
        marginRight: 12,
        maxWidth: 220,
    },
    groupPickerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
        marginRight: 8,
    },
    groupPickerText: {
        color: '#e5e7eb',
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    groupPickerChevron: {
        color: '#9aa0a6',
        fontSize: 14,
        marginLeft: 8,
    },
    notesList: {
        paddingHorizontal: NOTES_LIST_PADDING_HORIZONTAL,
        paddingTop: NOTES_LIST_PADDING_TOP,
        paddingBottom: NOTES_LIST_PADDING_BOTTOM,
    },
    noteCard: {
        backgroundColor: '#141414',
        borderRadius: 12,
        padding: 14,
        height: NOTE_CARD_HEIGHT,
        marginBottom: NOTE_CARD_SPACING,
        borderWidth: 1,
        borderColor: '#262626',
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 6,
    },
    notePreview: {
        fontSize: 12,
        color: '#9aa0a6',
        lineHeight: 18,
        marginBottom: 8,
    },
    noteDate: {
        fontSize: 12,
        color: '#7c7f85',
    },
    noteTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    pinIndicator: {
        fontSize: 14,
    },
    noteTitlePinned: {
        color: '#3b82f6',
    },
    empty: {
        alignItems: 'center',
        paddingTop: 60,
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
        backgroundColor: '#10b981',
    },
    emptyPrimaryText: {
        color: '#0a0a0a',
        fontSize: 14,
        fontWeight: '700',
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 32,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabText: {
        fontSize: 32,
        fontWeight: '300',
        color: '#fff',
        marginTop: -2,
    },
    groupsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    groupPickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    groupPickerContent: {
        width: '100%',
        maxHeight: '70%',
        backgroundColor: '#0f1115',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    groupPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    groupPickerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    groupPickerClose: {
        color: '#93c5fd',
        fontSize: 13,
        fontWeight: '600',
    },
    groupPickerList: {
        paddingBottom: 8,
    },
    groupPickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    groupPickerRowActive: {
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderRadius: 12,
        paddingHorizontal: 10,
    },
    groupPickerRowText: {
        color: '#e5e7eb',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    groupPickerDivider: {
        height: 1,
        backgroundColor: '#1f2937',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        marginBottom: 6,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#262626',
        backgroundColor: '#111',
    },
    filterChipActive: {
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    filterChipText: {
        color: '#9aa0a6',
        fontSize: 12,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: '#dbeafe',
    },
    sectionHeader: {
        marginTop: 4,
        marginBottom: 8,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9aa0a6',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    sectionBadge: {
        backgroundColor: '#111827',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    sectionBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#cbd5f5',
    },
    addGroupButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addGroupButtonText: {
        fontSize: 20,
        color: '#3b82f6',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#333',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 24,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: '#0a0a0a',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },
    modalCancelText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '600',
    },
    modalCreateButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
    },
    modalButtonDisabled: {
        opacity: 0.6,
    },
    modalCreateText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    membersOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    membersContent: {
        width: '100%',
        maxHeight: '70%',
        backgroundColor: '#0f1115',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    membersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    membersTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    membersClose: {
        color: '#93c5fd',
        fontSize: 13,
        fontWeight: '600',
    },
    inviteButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: '#1e1b4b',
        borderWidth: 1,
        borderColor: '#312e81',
        marginBottom: 12,
    },
    inviteButtonText: {
        color: '#c7d2fe',
        fontSize: 12,
        fontWeight: '600',
    },
    membersLoading: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    membersList: {
        paddingTop: 4,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    memberAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#1f2937',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    memberAvatarText: {
        color: '#e5e7eb',
        fontSize: 14,
        fontWeight: '600',
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    memberMeta: {
        color: '#9aa0a6',
        fontSize: 12,
        marginTop: 2,
        textTransform: 'capitalize',
    },
    memberDivider: {
        height: 1,
        backgroundColor: '#1f2937',
    },
    inviteOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    inviteContent: {
        width: '100%',
        backgroundColor: '#0f1115',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    inviteTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 6,
        textAlign: 'center',
    },
    inviteSubtitle: {
        color: '#94a3b8',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 18,
    },
    inviteInput: {
        backgroundColor: '#0a0a0a',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#1f2937',
        marginBottom: 16,
    },
    inviteRoleRow: {
        marginBottom: 18,
    },
    inviteRoleLabel: {
        color: '#9aa0a6',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    inviteRoleChips: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    roleChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#262626',
        backgroundColor: '#111',
    },
    roleChipActive: {
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
    },
    roleChipText: {
        color: '#9aa0a6',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    roleChipTextActive: {
        color: '#c7d2fe',
    },
    inviteActions: {
        flexDirection: 'row',
        gap: 12,
    },
    inviteCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#1f2937',
        alignItems: 'center',
    },
    inviteCancelText: {
        color: '#9aa0a6',
        fontSize: 14,
        fontWeight: '600',
    },
    inviteSendButton: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#6366f1',
        alignItems: 'center',
    },
    inviteSendText: {
        color: '#0a0a0a',
        fontSize: 14,
        fontWeight: '700',
    },
    inviteDisabled: {
        opacity: 0.6,
    },
    inviteFeedbackOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    inviteFeedbackContent: {
        width: '100%',
        backgroundColor: '#0f172a',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1e293b',
        alignItems: 'center',
    },
    inviteFeedbackTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    inviteFeedbackMessage: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 18,
    },
    inviteFeedbackButton: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#6366f1',
    },
    inviteFeedbackText: {
        color: '#0a0a0a',
        fontSize: 14,
        fontWeight: '700',
    },
});
