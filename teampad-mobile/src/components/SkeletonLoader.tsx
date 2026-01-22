import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue } from 'react-native';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Skeleton loader component with shimmer animation
 */
export function Skeleton({
    width = '100%',
    height = 20,
    borderRadius = 8,
    style
}: SkeletonProps) {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmer = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        shimmer.start();
        return () => shimmer.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.6],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width, height, borderRadius, opacity },
                style,
            ]}
        />
    );
}

/**
 * Skeleton loader for workspace cards
 */
export function WorkspaceCardSkeleton() {
    return (
        <View style={styles.workspaceCard}>
            <Skeleton width={48} height={48} borderRadius={12} />
            <View style={styles.workspaceInfo}>
                <Skeleton width="70%" height={18} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={14} />
            </View>
        </View>
    );
}

/**
 * Skeleton loader for list of workspaces
 */
export function WorkspacesListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <View style={styles.listContainer}>
            {Array.from({ length: count }).map((_, index) => (
                <WorkspaceCardSkeleton key={index} />
            ))}
        </View>
    );
}

/**
 * Skeleton loader for note cards
 */
export function NoteCardSkeleton() {
    return (
        <View style={styles.noteCard}>
            <Skeleton width="80%" height={18} style={{ marginBottom: 8 }} />
            <Skeleton width="100%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="60%" height={14} />
        </View>
    );
}

/**
 * Skeleton loader for list of notes
 */
export function NotesListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <View style={styles.listContainer}>
            {Array.from({ length: count }).map((_, index) => (
                <NoteCardSkeleton key={index} />
            ))}
        </View>
    );
}

/**
 * Skeleton loader for chat messages
 */
export function ChatMessageSkeleton({ isMine = false }: { isMine?: boolean }) {
    return (
        <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
            {!isMine && <Skeleton width={32} height={32} borderRadius={16} />}
            <View style={[styles.messageBubble, isMine && styles.messageBubbleMine]}>
                <Skeleton width="80%" height={16} style={{ marginBottom: 6 }} />
                <Skeleton width="50%" height={12} />
            </View>
        </View>
    );
}

/**
 * Skeleton loader for chat screen
 */
export function ChatSkeleton({ count = 6 }: { count?: number }) {
    return (
        <View style={styles.chatContainer}>
            {Array.from({ length: count }).map((_, index) => (
                <ChatMessageSkeleton key={index} isMine={index % 3 === 0} />
            ))}
        </View>
    );
}

/**
 * Skeleton for groups/collections list
 */
export function GroupsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <View style={styles.groupsContainer}>
            {Array.from({ length: count }).map((_, index) => (
                <Skeleton
                    key={index}
                    width={90}
                    height={36}
                    borderRadius={18}
                    style={{ marginRight: 8 }}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: '#1a1a1a',
    },
    listContainer: {
        padding: 20,
    },
    // Workspace card skeleton
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
    workspaceInfo: {
        flex: 1,
        marginLeft: 16,
    },
    // Note card skeleton
    noteCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    // Chat skeleton
    chatContainer: {
        padding: 16,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
    },
    messageRowMine: {
        justifyContent: 'flex-end',
    },
    messageBubble: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 12,
        marginLeft: 8,
        maxWidth: '75%',
        minWidth: 150,
    },
    messageBubbleMine: {
        backgroundColor: '#1a3a5c',
        marginLeft: 0,
    },
    // Groups skeleton
    groupsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
});
