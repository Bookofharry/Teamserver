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
} from 'react-native';
import { api } from '../api/restApi';
import { useAuth } from '../context/AuthContext';
import type { Workspace } from '../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export function WorkspacesScreen({ navigation }: Props) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { user, logout } = useAuth();

    const loadWorkspaces = async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        try {
            const data = await api.getWorkspaces();
            setWorkspaces(data);
        } catch (error) {
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
        try {
            const workspace = await api.createWorkspace({ name: 'New Workspace' });
            setWorkspaces((prev) => [...prev, workspace]);
            navigation.navigate('Notes', { workspaceId: workspace.id, workspaceName: workspace.name });
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create workspace');
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const renderWorkspace = ({ item }: { item: Workspace }) => (
        <TouchableOpacity
            style={styles.workspaceCard}
            onPress={() => navigation.navigate('Notes', { workspaceId: item.id, workspaceName: item.name })}
        >
            <View style={styles.workspaceIcon}>
                <Text style={styles.workspaceInitial}>
                    {item.name.charAt(0).toUpperCase() || 'W'}
                </Text>
            </View>
            <View style={styles.workspaceInfo}>
                <Text style={styles.workspaceName}>{item.name || 'Untitled Workspace'}</Text>
                <Text style={styles.workspaceMeta}>
                    {item.members?.length || 0} member{item.members?.length !== 1 ? 's' : ''}
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
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
                    <Text style={styles.title}>Your Workspaces</Text>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
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

            <TouchableOpacity style={styles.fab} onPress={handleCreateWorkspace}>
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
        padding: 20,
        paddingTop: 60,
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
