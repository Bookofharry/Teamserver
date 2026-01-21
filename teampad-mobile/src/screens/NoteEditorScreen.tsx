import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { api } from '../api/restApi';
import type { Note } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

type NoteEditorParams = {
    workspaceId: string;
    noteId: string;
    noteTitle: string;
};

type Props = {
    navigation: NativeStackNavigationProp<any>;
    route: RouteProp<{ NoteEditor: NoteEditorParams }, 'NoteEditor'>;
};

export function NoteEditorScreen({ navigation, route }: Props) {
    const { workspaceId, noteId } = route.params;
    const [note, setNote] = useState<Note | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadNote();
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [noteId]);

    const loadNote = async () => {
        try {
            const data = await api.getNote(noteId, workspaceId);
            setNote(data);
            setTitle(data.title || '');
            setBody(data.body || '');
        } catch (error) {
            Alert.alert('Error', 'Failed to load note');
            navigation.goBack();
        } finally {
            setIsLoading(false);
        }
    };

    const saveNote = useCallback(async () => {
        if (!note || !hasChanges) return;

        setIsSaving(true);
        try {
            await api.updateNote({
                workspaceId,
                noteId: note.id,
                title: title.trim() || 'Untitled',
                body,
            });
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to save note:', error);
        } finally {
            setIsSaving(false);
        }
    }, [note, title, body, hasChanges, workspaceId]);

    const handleTitleChange = (text: string) => {
        setTitle(text);
        setHasChanges(true);
        scheduleAutoSave();
    };

    const handleBodyChange = (text: string) => {
        setBody(text);
        setHasChanges(true);
        scheduleAutoSave();
    };

    const scheduleAutoSave = () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveNote();
        }, 2000);
    };

    const handleBack = async () => {
        if (hasChanges) {
            await saveNote();
        }
        navigation.goBack();
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Note',
            'Are you sure you want to delete this note?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.deleteNote(workspaceId, noteId);
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete note');
                        }
                    },
                },
            ]
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
        >
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Text style={styles.backText}>← Done</Text>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    {isSaving && <ActivityIndicator size="small" color="#3b82f6" />}
                    {hasChanges && !isSaving && (
                        <View style={styles.unsavedBadge}>
                            <Text style={styles.unsavedText}>Unsaved</Text>
                        </View>
                    )}
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Text style={styles.deleteText}>🗑️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.content} keyboardDismissMode="on-drag">
                <TextInput
                    style={styles.titleInput}
                    placeholder="Note title"
                    placeholderTextColor="#666"
                    value={title}
                    onChangeText={handleTitleChange}
                    multiline
                />
                <TextInput
                    style={styles.bodyInput}
                    placeholder="Start writing..."
                    placeholderTextColor="#666"
                    value={body}
                    onChangeText={handleBodyChange}
                    multiline
                    textAlignVertical="top"
                />
            </ScrollView>
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
    },
    backButton: {
        padding: 8,
    },
    backText: {
        color: '#3b82f6',
        fontSize: 16,
        fontWeight: '500',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    unsavedBadge: {
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    unsavedText: {
        color: '#888',
        fontSize: 12,
    },
    deleteButton: {
        padding: 8,
    },
    deleteText: {
        fontSize: 20,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    titleInput: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 20,
        padding: 0,
    },
    bodyInput: {
        fontSize: 16,
        color: '#e0e0e0',
        lineHeight: 24,
        minHeight: 300,
        padding: 0,
    },
});
