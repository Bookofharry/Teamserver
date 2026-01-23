import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    FlatList,
    Animated,
    ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/restApi';
import { haptics } from '../utils/haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<AppStackParamList, 'Onboarding'>;

interface OnboardingSlide {
    id: string;
    emoji: string;
    title: string;
    description: string;
    gradient: string[];
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        emoji: '👋',
        title: 'Welcome to Teampad',
        description: 'Your all-in-one workspace for team collaboration. Notes, chat, and more in one beautiful app.',
        gradient: ['#3b82f6', '#1d4ed8'],
    },
    {
        id: '2',
        emoji: '📁',
        title: 'Organize with Workspaces',
        description: 'Create workspaces for different teams or projects. Keep everything organized and easy to find.',
        gradient: ['#8b5cf6', '#6d28d9'],
    },
    {
        id: '3',
        emoji: '📝',
        title: 'Notes & Documents',
        description: 'Create, edit, and share notes with your team. Pin important notes for quick access.',
        gradient: ['#10b981', '#059669'],
    },
    {
        id: '4',
        emoji: '💬',
        title: 'Real-time Chat',
        description: 'Stay connected with your team through instant messaging. React to messages and collaborate seamlessly.',
        gradient: ['#f59e0b', '#d97706'],
    },
];

export function OnboardingScreen({ navigation }: Props) {
    const insets = useSafeAreaInsets();
    const { refresh } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleNext = () => {
        haptics.light();
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        haptics.light();
        handleComplete();
    };

    const handleComplete = async () => {
        haptics.success();
        try {
            await api.updateMe({ hasSeenOnboarding: true });
            await refresh();
        } catch (error) {
            console.error('Failed to update onboarding status:', error);
        }
        navigation.replace('Workspaces');
    };

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false }
    );

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const renderSlide = ({ item }: { item: OnboardingSlide }) => (
        <View style={[styles.slide, { width }]}>
            <View style={[styles.emojiContainer, { backgroundColor: item.gradient[0] }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    const renderDots = () => (
        <View style={styles.dotsContainer}>
            {slides.map((_, index) => {
                const inputRange = [
                    (index - 1) * width,
                    index * width,
                    (index + 1) * width,
                ];

                const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [8, 24, 8],
                    extrapolate: 'clamp',
                });

                const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                });

                return (
                    <Animated.View
                        key={index}
                        style={[
                            styles.dot,
                            {
                                width: dotWidth,
                                opacity,
                            },
                        ]}
                    />
                );
            })}
        </View>
    );

    const isLastSlide = currentIndex === slides.length - 1;

    return (
        <View style={styles.container}>
            {/* Skip Button */}
            <TouchableOpacity style={[styles.skipButton, { top: insets.top + 12 }]} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                initialNumToRender={1}
                windowSize={3}
                maxToRenderPerBatch={2}
                removeClippedSubviews
                onScroll={handleScroll}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                scrollEventThrottle={16}
            />

            {/* Dots */}
            {renderDots()}

            {/* Bottom Buttons */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 24 }]}>
                <TouchableOpacity
                    style={[styles.nextButton, isLastSlide && styles.nextButtonFinal]}
                    onPress={handleNext}
                >
                    <Text style={styles.nextButtonText}>
                        {isLastSlide ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    skipButton: {
        position: 'absolute',
        right: 20,
        zIndex: 10,
        padding: 8,
    },
    skipText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '500',
    },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 100,
    },
    emojiContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
    },
    emoji: {
        fontSize: 56,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
        marginHorizontal: 4,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
    nextButton: {
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    nextButtonFinal: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});
