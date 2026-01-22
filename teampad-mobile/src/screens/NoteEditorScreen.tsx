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
    Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/restApi';
import { haptics } from '../utils/haptics';
import type { Note } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'NoteEditor'>;

export function NoteEditorScreen({ navigation, route }: Props) {
    const insets = useSafeAreaInsets();
    const { noteId } = route.params;
    const [note, setNote] = useState<Note | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const loadNote = useCallback(async () => {
        try {
            const data = await api.getNote(noteId);
            setNote(data);
            setTitle(data.title || '');
            setBody(data.body || '');
        } catch {
            Alert.alert('Error', 'Failed to load note');
            navigation.goBack();
        } finally {
            setIsLoading(false);
        }
    }, [noteId, navigation]);

    useEffect(() => {
        loadNote();
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [loadNote]);

    const saveNote = useCallback(async () => {
        if (!note || !hasChanges) return;

        setIsSaving(true);
        try {
            await api.updateNote({
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
    }, [note, title, body, hasChanges]);

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
        setShowDeleteModal(true);
    };

    const handlePin = async () => {
        if (!note) return;
        haptics.light();
        try {
            const updated = await api.updateNote({
                noteId: note.id,
                isPinned: !note.isPinned,
            });
            haptics.success();
            setNote(updated);
        } catch {
            haptics.error();
            Alert.alert('Error', 'Failed to update pin status');
        }
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.deleteNote(noteId);
            setShowDeleteModal(false);
            navigation.goBack();
        } catch {
            Alert.alert('Error', 'Failed to delete note');
        } finally {
            setIsDeleting(false);
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
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
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
                    <TouchableOpacity style={styles.pinButton} onPress={handlePin}>
                        <Text style={styles.pinText}>{note?.isPinned ? '📌' : '📍'}</Text>
                    </TouchableOpacity>
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

            {/* Delete Confirmation Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.deleteOverlay}>
                    <View style={styles.deleteContent}>
                        <View style={styles.deleteIconCircle}>
                            <Text style={styles.deleteIcon}>🗑️</Text>
                        </View>
                        <Text style={styles.deleteTitle}>Delete Note</Text>
                        <Text style={styles.deleteSubtitle}>
                            Are you sure you want to delete this note? This action cannot be undone.
                        </Text>

                        <View style={styles.deleteButtons}>
                            <TouchableOpacity
                                style={styles.deleteCancelButton}
                                onPress={() => setShowDeleteModal(false)}
                            >
                                <Text style={styles.deleteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.deleteConfirmButton, isDeleting && styles.buttonDisabled]}
                                onPress={confirmDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.deleteConfirmText}>Delete</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    pinButton: {
        padding: 8,
    },
    pinText: {
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
    // Delete modal styles
    deleteOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    deleteContent: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    deleteIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    deleteIcon: {
        fontSize: 28,
    },
    deleteTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    deleteSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 28,
        textAlign: 'center',
        lineHeight: 20,
    },
    deleteButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    deleteCancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },
    deleteCancelText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '600',
    },
    deleteConfirmButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#ef4444',
        alignItems: 'center',
    },
    deleteConfirmText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
