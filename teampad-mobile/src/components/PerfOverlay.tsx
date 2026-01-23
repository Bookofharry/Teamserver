import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isLowEndProfile } from '../utils/perf';

const isOverlayEnabled =
    (process.env.EXPO_PUBLIC_PERF_OVERLAY ?? '').toLowerCase() === 'true';

export function PerfOverlay() {
    const [fps, setFps] = useState(0);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(Date.now());
    const rafIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (!isOverlayEnabled) return;
        let isMounted = true;

        const tick = () => {
            frameCountRef.current += 1;
            const now = Date.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed >= 1000) {
                const nextFps = Math.round((frameCountRef.current * 1000) / elapsed);
                if (isMounted) setFps(nextFps);
                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }
            rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            isMounted = false;
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    const fpsColor = useMemo(() => {
        if (fps >= 55) return '#22c55e';
        if (fps >= 45) return '#eab308';
        return '#ef4444';
    }, [fps]);

    if (!isOverlayEnabled) return null;

    return (
        <View pointerEvents="none" style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.label}>FPS</Text>
                <Text style={[styles.value, { color: fpsColor }]}>{fps}</Text>
                {isLowEndProfile && <Text style={styles.badge}>Low-End</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 999,
    },
    card: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 10,
        paddingVertical: 6,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    label: {
        color: '#9ca3af',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 2,
    },
    badge: {
        marginTop: 4,
        color: '#93c5fd',
        fontSize: 10,
        fontWeight: '600',
    },
});
