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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/restApi';
import { BackgroundGlow } from '../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../utils/animations';
import type { Note, Group } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Notes'>;

type GroupTabProps = {
    item: Group;
    isSelected: boolean;
    onSelect: (groupId: string) => void;
};

const GroupTab = memo(function GroupTab({ item, isSelected, onSelect }: GroupTabProps) {
    return (
        <TouchableOpacity
            style={[
                styles.groupTab,
                isSelected && styles.groupTabActive,
            ]}
            onPress={() => onSelect(item.id)}
        >
            <View style={[styles.groupDot, { backgroundColor: item.color || '#3b82f6' }]} />
            <Text
                style={[
                    styles.groupTabText,
                    isSelected && styles.groupTabTextActive,
                ]}
                numberOfLines={1}
            >
                {item.name}
            </Text>
        </TouchableOpacity>
    );
});

type NoteCardProps = {
    item: Note;
    onPress: (note: Note) => void;
};

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
    const [notes, setNotes] = useState<Note[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const selectedGroupIdRef = useRef<string | null>(null);

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

    const loadNotes = useCallback(async (groupId: string | null) => {
        const notesData = await api.getNotes(workspaceId, groupId, searchQuery, { limit: 50 });
        setNotes(notesData);
    }, [workspaceId, searchQuery]);

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
        fetchGroups();
        return () => {
            cancelled = true;
        };
    }, [loadGroups]);

    useEffect(() => {
        if (groups.length > 0 && !selectedGroupId) return;
        let cancelled = false;
        const fetchNotes = async () => {
            setIsLoading(true);
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
                }
            }
        };
        fetchNotes();
        return () => {
            cancelled = true;
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

    const renderGroup = useCallback(
        ({ item }: { item: Group }) => (
            <GroupTab
                item={item}
                isSelected={selectedGroupId === item.id}
                onSelect={handleGroupSelect}
            />
        ),
        [handleGroupSelect, selectedGroupId],
    );

    const renderNote = useCallback(
        ({ item }: { item: Note }) => (
            <NoteCard item={item} onPress={handleNotePress} />
        ),
        [handleNotePress],
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    const filteredNotes = notes
        .filter((note) => !selectedGroupId || note.groupId === selectedGroupId)
        .sort((a, b) => {
            // Pinned notes first
            if (a.isPinned && !b.isPinned) return -1;
            if (b.isPinned && !a.isPinned) return 1;
            // Then by updated date
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

    return (
        <View style={styles.container}>
            <BackgroundGlow tint="green" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
                <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.backText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.chatButton}
                        onPress={() => navigation.navigate('Chat', { workspaceId, workspaceName })}
                    >
                        <Text style={styles.chatButtonText}>💬 Chat</Text>
                    </TouchableOpacity>
                </View>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search notes..."
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.groupsRow}>
                    <FlatList
                        horizontal
                        data={sortedGroups}
                        keyExtractor={(item) => item.id}
                        renderItem={renderGroup}
                        style={styles.groupsList}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.groupsContent}
                        initialNumToRender={6}
                    />
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
                    initialNumToRender={8}
                    windowSize={9}
                    maxToRenderPerBatch={8}
                    updateCellsBatchingPeriod={50}
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
    groupsList: {
        height: 52,
        flexGrow: 0,
        marginBottom: 8,
    },
    groupsContent: {
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    groupTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        marginRight: 8,
        maxWidth: 150,
    },
    groupTabActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    groupDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
        flexShrink: 0,
    },
    groupTabText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '500',
        flexShrink: 1,
    },
    groupTabTextActive: {
        color: '#fff',
    },
    notesList: {
        padding: 20,
        paddingTop: 8,
    },
    noteCard: {
        backgroundColor: '#141414',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
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
        marginRight: 16,
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
});
