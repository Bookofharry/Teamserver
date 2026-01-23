import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Animated,
} from 'react-native';
import { api } from '../../api/restApi';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../../utils/animations';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const { width, height } = Dimensions.get('window');
const GRID_SIZE = 40;

const GridBackground = () => {
    const cols = Math.ceil(width / GRID_SIZE) + 1;
    const rows = Math.ceil(height / GRID_SIZE) + 1;

    return (
        <View style={styles.gridContainer}>
            {/* Vertical lines */}
            {Array.from({ length: cols }).map((_, i) => (
                <View
                    key={`v-${i}`}
                    style={[
                        styles.gridLine,
                        styles.verticalLine,
                        { left: i * GRID_SIZE },
                    ]}
                />
            ))}
            {/* Horizontal lines */}
            {Array.from({ length: rows }).map((_, i) => (
                <View
                    key={`h-${i}`}
                    style={[
                        styles.gridLine,
                        styles.horizontalLine,
                        { top: i * GRID_SIZE },
                    ]}
                />
            ))}
        </View>
    );
};

export function ForgotPasswordScreen({ navigation }: Props) {
    const introAnim = useRef(createSlideUp(260, 12)).current;
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('Please try again.');

    const showError = (message: string) => {
        setErrorMessage(message);
        setShowErrorModal(true);
    };

    useEffect(() => {
        introAnim.start();
    }, [introAnim]);

    const handleResetPassword = async () => {
        if (!email.trim()) {
            showError('Please enter your email.');
            return;
        }

        setIsLoading(true);
        try {
            await api.forgotPassword(email.trim());
            Alert.alert(
                'Reset Link Sent',
                'Check your email for a link to reset your password',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <GridBackground />
            <BackgroundGlow tint="blue" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../../assets/images/teampad-logo.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.title}>Reset password</Text>
                <Text style={styles.subtitle}>We'll send you a reset link</Text>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#666"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={email}
                        onChangeText={setEmail}
                    />

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleResetPassword}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Send reset link</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.linkText}>Back to sign in</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <Modal
                visible={showErrorModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowErrorModal(false)}
            >
                <View style={styles.errorOverlay}>
                    <View style={styles.errorContent}>
                        <View style={styles.errorIconCircle}>
                            <Text style={styles.errorIcon}>⚠️</Text>
                        </View>
                        <Text style={styles.errorTitle}>Request failed</Text>
                        <Text style={styles.errorSubtitle}>{errorMessage}</Text>
                        <View style={styles.errorButtons}>
                            <TouchableOpacity
                                style={styles.errorPrimaryButton}
                                onPress={() => setShowErrorModal(false)}
                            >
                                <Text style={styles.errorPrimaryText}>Try again</Text>
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
    gridContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    gridLine: {
        position: 'absolute',
        backgroundColor: '#1a1a1a',
    },
    verticalLine: {
        width: 0.5,
        height: '100%',
    },
    horizontalLine: {
        width: '100%',
        height: 0.5,
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    logoImage: {
        width: 100,
        height: 100,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginBottom: 40,
    },
    form: {
        gap: 16,
    },
    input: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#333',
    },
    button: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        alignItems: 'center',
        padding: 12,
    },
    linkText: {
        color: '#3b82f6',
        fontSize: 14,
    },
    errorOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorContent: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 28,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    errorIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    errorIcon: {
        fontSize: 24,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 8,
        textAlign: 'center',
    },
    errorSubtitle: {
        fontSize: 14,
        color: '#8b8f94',
        marginBottom: 24,
        textAlign: 'center',
    },
    errorButtons: {
        width: '100%',
    },
    errorPrimaryButton: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#ef4444',
        alignItems: 'center',
    },
    errorPrimaryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
