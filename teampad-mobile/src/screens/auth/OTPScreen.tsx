import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'OTP'>;

export function OTPScreen({ navigation, route }: Props) {
    const { mode, email, name, password, twoFactorToken } = route.params;
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const inputs = useRef<(TextInput | null)[]>([]);
    const { signup, verifyTwoFactor, requestSignupOtp } = useAuth();

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
            Alert.alert('Error', 'Please enter the 6-digit code');
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
            Alert.alert('Verification Failed', error instanceof Error ? error.message : 'Please try again');
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
            Alert.alert('Error', error instanceof Error ? error.message : 'Please try again');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
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
            </View>
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
});
