import React from 'react';
import { View, StyleSheet } from 'react-native';

type BackgroundGlowProps = {
    tint?: 'blue' | 'green' | 'amber';
};

const tintMap = {
    blue: { primary: 'rgba(59, 130, 246, 0.18)', secondary: 'rgba(59, 130, 246, 0.08)' },
    green: { primary: 'rgba(16, 185, 129, 0.16)', secondary: 'rgba(16, 185, 129, 0.08)' },
    amber: { primary: 'rgba(245, 158, 11, 0.16)', secondary: 'rgba(245, 158, 11, 0.08)' },
};

export function BackgroundGlow({ tint = 'blue' }: BackgroundGlowProps) {
    const colors = tintMap[tint] || tintMap.blue;
    return (
        <View style={styles.container} pointerEvents="none">
            <View style={[styles.blob, styles.blobTopRight, { backgroundColor: colors.primary }]} />
            <View style={[styles.blob, styles.blobBottomLeft, { backgroundColor: colors.secondary }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
    },
    blob: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
        opacity: 1,
    },
    blobTopRight: {
        top: -120,
        right: -100,
    },
    blobBottomLeft: {
        bottom: -140,
        left: -120,
    },
});
