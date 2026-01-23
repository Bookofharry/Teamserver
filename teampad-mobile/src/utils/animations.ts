import { Animated, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Animation utility for consistent animations across the app
 */

/**
 * Create a fade-in animation value
 * @returns Object with animated value and start function
 */
export const motionTokens = {
    duration: {
        fast: 180,
        base: 220,
        slow: 260,
    },
    easing: Easing.out(Easing.cubic),
    lift: 12,
};

export const createFadeIn = (duration = motionTokens.duration.base) => {
    const opacity = new Animated.Value(0);

    const start = (callback?: () => void) => {
        Animated.timing(opacity, {
            toValue: 1,
            duration,
            easing: motionTokens.easing,
            useNativeDriver: true,
        }).start(callback);
    };

    return { opacity, start };
};

/**
 * Create a slide-up animation with fade
 * @returns Object with animated values and start function
 */
export const createSlideUp = (duration = motionTokens.duration.base, distance = motionTokens.lift) => {
    const opacity = new Animated.Value(0);
    const translateY = new Animated.Value(distance);

    const start = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration,
                easing: motionTokens.easing,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration,
                easing: motionTokens.easing,
                useNativeDriver: true,
            }),
        ]).start(callback);
    };

    return { opacity, translateY, start };
};

/**
 * Create a scale animation (for press effects)
 * @returns Object with animated value and press handlers
 */
export const createScalePress = (minScale = 0.96) => {
    const scale = new Animated.Value(1);

    const onPressIn = () => {
        Animated.spring(scale, {
            toValue: minScale,
            speed: 18,
            bounciness: 4,
            useNativeDriver: true,
        }).start();
    };

    const onPressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            speed: 18,
            bounciness: 4,
            useNativeDriver: true,
        }).start();
    };

    return { scale, onPressIn, onPressOut };
};

/**
 * Create staggered animation for list items
 * @param count Number of items to animate
 * @param staggerDelay Delay between each item
 * @returns Array of animated values and start function
 */
export const createStaggeredList = (count: number, staggerDelay = 40) => {
    const animations = Array.from({ length: count }, () => ({
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(20),
    }));

    const start = () => {
        const anims = animations.map((anim, index) =>
            Animated.sequence([
                Animated.delay(index * staggerDelay),
                Animated.parallel([
                    Animated.timing(anim.opacity, {
                        toValue: 1,
                        duration: motionTokens.duration.fast,
                        easing: motionTokens.easing,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim.translateY, {
                        toValue: 0,
                        duration: motionTokens.duration.fast,
                        easing: motionTokens.easing,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        Animated.parallel(anims).start();
    };

    return { animations, start };
};

/**
 * Configure layout animation for list changes
 */
export const configureLayoutAnimation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

/**
 * Configure a spring layout animation
 */
export const configureSpringAnimation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
};

/**
 * Animation presets for common use cases
 */
export const animationPresets = {
    fadeIn: {
        opacity: {
            from: 0,
            to: 1,
            duration: motionTokens.duration.base,
        },
    },
    slideUp: {
        opacity: { from: 0, to: 1, duration: motionTokens.duration.base },
        translateY: { from: motionTokens.lift, to: 0, duration: motionTokens.duration.base },
    },
    scaleIn: {
        scale: { from: 0.96, to: 1, duration: motionTokens.duration.fast },
        opacity: { from: 0, to: 1, duration: motionTokens.duration.fast },
    },
};

/**
 * Animated wrapper component styles helper
 */
export const getAnimatedStyle = (
    opacity: Animated.Value,
    translateY?: Animated.Value,
    scale?: Animated.Value
) => {
    const style: {
        opacity: Animated.Value;
        transform?: { translateY?: Animated.Value; scale?: Animated.Value }[];
    } = { opacity };

    if (translateY) {
        style.transform = [{ translateY }];
    }

    if (scale) {
        style.transform = style.transform
            ? [...style.transform, { scale }]
            : [{ scale }];
    }

    return style;
};
