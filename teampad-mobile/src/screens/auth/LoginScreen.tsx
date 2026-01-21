import React, { useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const { width, height } = Dimensions.get('window');
const GRID_SIZE = 40;

const GridBackground = () => {
    const cols = Math.ceil(width / GRID_SIZE) + 1;
    const rows = Math.ceil(height / GRID_SIZE) + 1;

    return (
        <View style={styles.gridContainer}>
            {Array.from({ length: cols }).map((_, i) => (
                <View
                    key={`v-${i}`}
                    style={[styles.gridLine, styles.verticalLine, { left: i * GRID_SIZE }]}
                />
            ))}
            {Array.from({ length: rows }).map((_, i) => (
                <View
                    key={`h-${i}`}
                    style={[styles.gridLine, styles.horizontalLine, { top: i * GRID_SIZE }]}
                />
            ))}
        </View>
    );
};

export function LoginScreen({ navigation }: Props) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setIsLoading(true);
        try {
            const result = await login(email.trim(), password);
            if (result.twoFactorRequired && result.twoFactorToken) {
                navigation.navigate('OTP', {
                    mode: 'twoFactor',
                    email,
                    twoFactorToken: result.twoFactorToken,
                });
            }
        } catch (error) {
            Alert.alert('Login Failed', error instanceof Error ? error.message : 'Please try again');
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
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../../assets/images/teampad-logo.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

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
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#666"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <Text style={styles.linkText}>Forgot password?</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                        <Text style={styles.footerLink}>Sign up</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
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
    logo: {
        fontSize: 32,
        fontWeight: '700',
        color: '#3b82f6',
        textAlign: 'center',
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
        marginTop: 8,
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
        padding: 8,
    },
    linkText: {
        color: '#3b82f6',
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    footerText: {
        color: '#888',
        fontSize: 14,
    },
    footerLink: {
        color: '#3b82f6',
        fontSize: 14,
        fontWeight: '500',
    },
});
