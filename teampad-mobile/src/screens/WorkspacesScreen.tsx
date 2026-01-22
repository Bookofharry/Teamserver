import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/restApi';
import { useAuth } from '../context/AuthContext';
import { haptics } from '../utils/haptics';
import type { Workspace } from '../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Workspaces'>;

export function WorkspacesScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
    const [renameText, setRenameText] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [showActionsModal, setShowActionsModal] = useState(false);
    const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
    const { user, logout } = useAuth();

    const loadWorkspaces = async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        try {
            const data = await api.getWorkspaces();
            setWorkspaces(data);
        } catch {
            Alert.alert('Error', 'Failed to load workspaces');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const handleCreateWorkspace = async () => {
        const name = newWorkspaceName.trim() || 'New Workspace';
        setIsCreating(true);
        try {
            const workspace = await api.createWorkspace({ name });
            setWorkspaces((prev) => [...prev, workspace]);
            setShowCreateModal(false);
            setNewWorkspaceName('');
            navigation.navigate('Notes', { workspaceId: workspace.id, workspaceName: workspace.name });
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create workspace');
        } finally {
            setIsCreating(false);
        }
    };

    const confirmLogout = () => {
        setShowLogoutModal(false);
        logout();
    };

    const handleWorkspaceLongPress = (workspace: Workspace) => {
        haptics.medium();
        setSelectedWorkspace(workspace);
        setShowActionsModal(true);
    };

    const handleRenameWorkspace = () => {
        if (!selectedWorkspace) return;
        setWorkspaceToRename(selectedWorkspace);
        setRenameText(selectedWorkspace.name);
        setShowActionsModal(false);
        setShowRenameModal(true);
    };

    const handleDeleteWorkspace = () => {
        if (!selectedWorkspace) return;
        setWorkspaceToDelete(selectedWorkspace);
        setShowActionsModal(false);
        setShowDeleteModal(true);
    };

    const confirmRename = async () => {
        if (!workspaceToRename || !renameText.trim()) return;
        setIsRenaming(true);
        try {
            const updated = await api.updateWorkspace(workspaceToRename.id, { name: renameText.trim() });
            setWorkspaces((prev) => prev.map((w) => w.id === updated.id ? { ...w, name: updated.name } : w));
            setShowRenameModal(false);
            setWorkspaceToRename(null);
            setRenameText('');
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to rename workspace');
        } finally {
            setIsRenaming(false);
        }
    };

    const confirmDelete = async () => {
        if (!workspaceToDelete) return;
        setIsDeleting(true);
        try {
            await api.deleteWorkspace(workspaceToDelete.id);
            setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceToDelete.id));
            setShowDeleteModal(false);
            setWorkspaceToDelete(null);
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete workspace');
        } finally {
            setIsDeleting(false);
        }
    };

    const renderWorkspace = ({ item }: { item: Workspace }) => (
        <TouchableOpacity
            style={styles.workspaceCard}
            onPress={() => navigation.navigate('Notes', { workspaceId: item.id, workspaceName: item.name })}
            onLongPress={() => handleWorkspaceLongPress(item)}
            delayLongPress={500}
        >
            <View style={styles.workspaceIcon}>
                <Text style={styles.workspaceInitial}>
                    {item.name.charAt(0).toUpperCase() || 'W'}
                </Text>
            </View>
            <View style={styles.workspaceInfo}>
                <Text style={styles.workspaceName}>{item.name || 'Untitled Workspace'}</Text>
                <Text style={styles.workspaceMeta}>
                    {(item.memberCount ?? item.members?.length ?? 0)} member
                    {(item.memberCount ?? item.members?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
                    <Text style={styles.title}>Your Workspaces</Text>
                </View>
                <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => {
                        haptics.light();
                        navigation.navigate('Profile');
                    }}
                >
                    <Text style={styles.profileInitial}>
                        {user?.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={workspaces}
                keyExtractor={(item) => item.id}
                renderItem={renderWorkspace}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadWorkspaces(true)}
                        tintColor="#3b82f6"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No workspaces yet</Text>
                        <Text style={styles.emptyText}>Create your first workspace to get started</Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Branded Create Workspace Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create Workspace</Text>
                        <Text style={styles.modalSubtitle}>Give your workspace a name</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Workspace name"
                            placeholderTextColor="#666"
                            value={newWorkspaceName}
                            onChangeText={setNewWorkspaceName}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={handleCreateWorkspace}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setShowCreateModal(false);
                                    setNewWorkspaceName('');
                                }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalCreateButton, isCreating && styles.modalButtonDisabled]}
                                onPress={handleCreateWorkspace}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalCreateText}>Create</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Branded Logout Modal */}
            <Modal
                visible={showLogoutModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowLogoutModal(false)}
            >
                <View style={styles.logoutOverlay}>
                    <View style={styles.logoutContent}>
                        <View style={styles.logoutIconCircle}>
                            <Text style={styles.logoutIcon}>👋</Text>
                        </View>
                        <Text style={styles.logoutTitle}>Leaving so soon?</Text>
                        <Text style={styles.logoutSubtitle}>Are you sure you want to logout?</Text>

                        <View style={styles.logoutButtons}>
                            <TouchableOpacity
                                style={styles.logoutCancelButton}
                                onPress={() => setShowLogoutModal(false)}
                            >
                                <Text style={styles.logoutCancelText}>Stay</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.logoutConfirmButton}
                                onPress={confirmLogout}
                            >
                                <Text style={styles.logoutConfirmText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Branded Delete Workspace Modal */}
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
                        <Text style={styles.deleteTitle}>Delete Workspace</Text>
                        <Text style={styles.deleteSubtitle}>
                            Are you sure you want to delete "{workspaceToDelete?.name}"? This action cannot be undone.
                        </Text>

                        <View style={styles.deleteButtons}>
                            <TouchableOpacity
                                style={styles.deleteCancelButton}
                                onPress={() => {
                                    setShowDeleteModal(false);
                                    setWorkspaceToDelete(null);
                                }}
                            >
                                <Text style={styles.deleteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.deleteConfirmButton, isDeleting && styles.modalButtonDisabled]}
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

            {/* Action Sheet Modal */}
            <Modal
                visible={showActionsModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowActionsModal(false)}
            >
                <TouchableOpacity
                    style={styles.actionSheetOverlay}
                    activeOpacity={1}
                    onPress={() => setShowActionsModal(false)}
                >
                    <View style={styles.actionSheetContent}>
                        <Text style={styles.actionSheetTitle}>{selectedWorkspace?.name}</Text>
                        <TouchableOpacity style={styles.actionSheetButton} onPress={handleRenameWorkspace}>
                            <Text style={styles.actionSheetButtonIcon}>✏️</Text>
                            <Text style={styles.actionSheetButtonText}>Rename</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionSheetButton} onPress={handleDeleteWorkspace}>
                            <Text style={styles.actionSheetButtonIcon}>🗑️</Text>
                            <Text style={[styles.actionSheetButtonText, styles.actionSheetDeleteText]}>Delete</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionSheetCancelButton}
                            onPress={() => setShowActionsModal(false)}
                        >
                            <Text style={styles.actionSheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Rename Workspace Modal */}
            <Modal
                visible={showRenameModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRenameModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rename Workspace</Text>
                        <Text style={styles.modalSubtitle}>Enter a new name</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Workspace name"
                            placeholderTextColor="#666"
                            value={renameText}
                            onChangeText={setRenameText}
                            autoFocus
                            returnKeyType="done"
                            onSubmitEditing={confirmRename}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setShowRenameModal(false);
                                    setWorkspaceToRename(null);
                                    setRenameText('');
                                }}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalCreateButton, isRenaming && styles.modalButtonDisabled]}
                                onPress={confirmRename}
                                disabled={isRenaming}
                            >
                                {isRenaming ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalCreateText}>Save</Text>
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
        padding: 20,
    },
    greeting: {
        fontSize: 16,
        color: '#888',
        marginBottom: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
    },
    logoutButton: {
        padding: 8,
    },
    logoutText: {
        color: '#ef4444',
        fontSize: 14,
        fontWeight: '500',
    },
    list: {
        padding: 20,
        paddingTop: 8,
    },
    workspaceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    workspaceIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    workspaceInitial: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    workspaceInfo: {
        flex: 1,
    },
    workspaceName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    workspaceMeta: {
        fontSize: 14,
        color: '#888',
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
    profileButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInitial: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
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
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
        fontSize: 24,
        fontWeight: '700',
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
    // Logout modal styles - subtle blue/black
    logoutOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    logoutContent: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    logoutIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoutIcon: {
        fontSize: 28,
    },
    logoutTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    logoutSubtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 28,
        textAlign: 'center',
    },
    logoutButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    logoutCancelButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        alignItems: 'center',
    },
    logoutCancelText: {
        color: '#3b82f6',
        fontSize: 15,
        fontWeight: '600',
    },
    logoutConfirmButton: {
        flex: 1,
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },
    logoutConfirmText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '600',
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
    // Action Sheet styles
    actionSheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-end',
        padding: 16,
        paddingBottom: 32,
    },
    actionSheetContent: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        overflow: 'hidden',
    },
    actionSheetTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#888',
        textAlign: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    actionSheetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    actionSheetButtonIcon: {
        fontSize: 20,
        marginRight: 12,
    },
    actionSheetButtonText: {
        fontSize: 17,
        color: '#fff',
    },
    actionSheetDeleteText: {
        color: '#ef4444',
    },
    actionSheetCancelButton: {
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
        backgroundColor: '#333',
        borderRadius: 12,
    },
    actionSheetCancelText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
});
