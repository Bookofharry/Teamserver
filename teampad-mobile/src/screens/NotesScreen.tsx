import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { api } from '../api/restApi';
import type { Note, Group } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

type NotesParams = {
    workspaceId: string;
    workspaceName: string;
};

type Props = {
    navigation: NativeStackNavigationProp<any>;
    route: RouteProp<{ Notes: NotesParams }, 'Notes'>;
};

export function NotesScreen({ navigation, route }: Props) {
    const { workspaceId, workspaceName } = route.params;
    const [notes, setNotes] = useState<Note[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadData = useCallback(async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        try {
            const [groupsData, notesData] = await Promise.all([
                api.getGroups(workspaceId),
                api.getNotes(workspaceId, selectedGroupId, searchQuery, { limit: 50 }),
            ]);
            setGroups(groupsData);
            setNotes(notesData);
            if (!selectedGroupId && groupsData.length > 0) {
                setSelectedGroupId(groupsData[0].id);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to load notes');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [workspaceId, selectedGroupId, searchQuery]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        navigation.setOptions({ title: workspaceName || 'Notes' });
    }, [navigation, workspaceName]);

    const handleCreateNote = async () => {
        if (!selectedGroupId) {
            if (groups.length === 0) {
                try {
                    const group = await api.createGroup({ workspaceId, name: 'General' });
                    setGroups([group]);
                    setSelectedGroupId(group.id);
                } catch (error) {
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

    const handleNotePress = (note: Note) => {
        navigation.navigate('NoteEditor', { workspaceId, noteId: note.id, noteTitle: note.title });
    };

    const renderGroup = ({ item }: { item: Group }) => (
        <TouchableOpacity
            style={[
                styles.groupTab,
                selectedGroupId === item.id && styles.groupTabActive,
            ]}
            onPress={() => setSelectedGroupId(item.id)}
        >
            <View style={[styles.groupDot, { backgroundColor: item.color || '#3b82f6' }]} />
            <Text
                style={[
                    styles.groupTabText,
                    selectedGroupId === item.id && styles.groupTabTextActive,
                ]}
                numberOfLines={1}
            >
                {item.name}
            </Text>
        </TouchableOpacity>
    );

    const renderNote = ({ item }: { item: Note }) => (
        <TouchableOpacity style={styles.noteCard} onPress={() => handleNotePress(item)}>
            <Text style={styles.noteTitle} numberOfLines={1}>
                {item.title || 'Untitled'}
            </Text>
            <Text style={styles.notePreview} numberOfLines={2}>
                {item.bodyPreview || item.body || 'No content'}
            </Text>
            <Text style={styles.noteDate}>
                {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    const filteredNotes = notes.filter(
        (note) => !selectedGroupId || note.groupId === selectedGroupId
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
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

            {groups.length > 0 && (
                <FlatList
                    horizontal
                    data={groups}
                    keyExtractor={(item) => item.id}
                    renderItem={renderGroup}
                    style={styles.groupsList}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.groupsContent}
                />
            )}

            <FlatList
                data={filteredNotes}
                keyExtractor={(item) => item.id}
                renderItem={renderNote}
                contentContainerStyle={styles.notesList}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadData(true)}
                        tintColor="#3b82f6"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No notes yet</Text>
                        <Text style={styles.emptyText}>Create your first note</Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} onPress={handleCreateNote}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
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
    },
    backButton: {
        padding: 8,
    },
    backText: {
        color: '#3b82f6',
        fontSize: 16,
        fontWeight: '500',
    },
    chatButton: {
        backgroundColor: '#1a1a1a',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
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
        maxHeight: 48,
        marginBottom: 8,
    },
    groupsContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    groupTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        marginRight: 8,
    },
    groupTabActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    groupDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    groupTabText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
    groupTabTextActive: {
        color: '#fff',
    },
    notesList: {
        padding: 20,
        paddingTop: 8,
    },
    noteCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    noteTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
    },
    notePreview: {
        fontSize: 14,
        color: '#888',
        lineHeight: 20,
        marginBottom: 12,
    },
    noteDate: {
        fontSize: 12,
        color: '#666',
    },
    empty: {
        alignItems: 'center',
        paddingTop: 60,
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
});
