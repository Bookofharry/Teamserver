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
    Modal,
    Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation';
import { BackgroundGlow } from '../../components/BackgroundGlow';
import { createSlideUp, getAnimatedStyle } from '../../utils/animations';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

export function OTPScreen({ navigation, route }: Props) {
    const introAnim = useRef(createSlideUp(260, 12)).current;
    const { mode, email, name, password, twoFactorToken } = route.params;
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('Please try again.');
    const inputs = useRef<(TextInput | null)[]>([]);
    const { signup, verifyTwoFactor, requestSignupOtp } = useAuth();

    const showError = (message: string) => {
        setErrorMessage(message);
        setShowErrorModal(true);
    };

    const handleCodeChange = (text: string, index: number) => {
        if (text.length > 1) {
            // Handle paste
            const chars = text.slice(0, 6).split('');
            const newCode = [...code];
            chars.forEach((char, i) => {
                if (index + i < 6) newCode[index + i] = char;
            });
            setCode(newCode);
            const nextIndex = Math.min(index + chars.length, 5);
            inputs.current[nextIndex]?.focus();
            return;
        }

        const newCode = [...code];
        newCode[index] = text;
        setCode(newCode);

        if (text && index < 5) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !code[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            showError('Please enter the 6-digit code.');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'signup' && name && password) {
                await signup(name, email, password, fullCode);
            } else if (mode === 'twoFactor' && twoFactorToken) {
                await verifyTwoFactor(twoFactorToken, fullCode);
            }
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        try {
            if (mode === 'signup') {
                await requestSignupOtp(email);
            }
            Alert.alert('Code Sent', 'A new verification code has been sent to your email');
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Please try again.');
        }
    };

    useEffect(() => {
        introAnim.start();
    }, [introAnim]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <BackgroundGlow tint="blue" />
            <Animated.View style={[styles.content, getAnimatedStyle(introAnim.opacity, introAnim.translateY)]}>
                <Text style={styles.title}>Verify your email</Text>
                <Text style={styles.subtitle}>
                    Enter the code we sent to{'\n'}
                    <Text style={styles.email}>{email}</Text>
                </Text>

                <View style={styles.codeContainer}>
                    {code.map((digit, index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => { inputs.current[index] = ref; }}
                            style={styles.codeInput}
                            value={digit}
                            onChangeText={(text) => handleCodeChange(text, index)}
                            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                            keyboardType="number-pad"
                            maxLength={6}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleVerify}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Verify</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={handleResend}>
                    <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.linkText}>Go back</Text>
                </TouchableOpacity>
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
                        <Text style={styles.errorTitle}>Verification failed</Text>
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
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    email: {
        color: '#3b82f6',
        fontWeight: '500',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 32,
    },
    codeInput: {
        width: 48,
        height: 56,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
        textAlign: 'center',
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
        marginTop: 8,
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
