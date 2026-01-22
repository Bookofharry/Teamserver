import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
} from 'react-native';

/**
 * Branded loading screen with animated logo
 * Shown during initial app load and auth verification
 */
export function LoadingScreen() {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // Fade in animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();

        // Pulse animation loop
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        return () => pulse.stop();
    }, [pulseAnim, fadeAnim, slideAnim]);

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }],
                    },
                ]}
            >
                {/* Logo Container */}
                <Animated.View
                    style={[
                        styles.logoContainer,
                        { transform: [{ scale: pulseAnim }] },
                    ]}
                >
                    <Text style={styles.logoEmoji}>📋</Text>
                </Animated.View>

                {/* Brand Name */}
                <Text style={styles.brandName}>Teampad</Text>
                <Text style={styles.tagline}>Your team workspace</Text>

                {/* Loading Indicator */}
                <View style={styles.loadingContainer}>
                    <LoadingDots />
                </View>
            </Animated.View>
        </View>
    );
}

/**
 * Animated loading dots
 */
function LoadingDots() {
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;
    const timeouts = useRef<NodeJS.Timeout[]>([]);

    useEffect(() => {
        const animateDots = () => {
            Animated.sequence([
                Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(dot1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
            ]).start();

            const dot2Timeout = setTimeout(() => {
                Animated.sequence([
                    Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
                ]).start();
            }, 150);

            const dot3Timeout = setTimeout(() => {
                Animated.sequence([
                    Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(dot3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
                ]).start();
            }, 300);

            timeouts.current.push(dot2Timeout, dot3Timeout);
        };

        animateDots();
        const interval = setInterval(animateDots, 900);
        return () => {
            clearInterval(interval);
            timeouts.current.forEach((timeoutId) => clearTimeout(timeoutId));
            timeouts.current = [];
        };
    }, [dot1, dot2, dot3]);

    return (
        <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, { opacity: dot1 }]} />
            <Animated.View style={[styles.dot, { opacity: dot2 }]} />
            <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 24,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
    },
    logoEmoji: {
        fontSize: 48,
    },
    brandName: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    tagline: {
        fontSize: 16,
        color: '#666',
        marginBottom: 48,
    },
    loadingContainer: {
        height: 40,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
    },
});
