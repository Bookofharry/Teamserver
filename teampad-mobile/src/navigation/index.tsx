import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Easing, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components/LoadingScreen';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';

// App Screens
import { WorkspacesScreen } from '../screens/WorkspacesScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { NoteEditorScreen } from '../screens/NoteEditorScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { InvitesScreen } from '../screens/InvitesScreen';

// Type definitions for navigation
export type AuthStackParamList = {
    Login: undefined;
    SignUp: undefined;
    OTP: {
        mode: 'signup' | 'twoFactor';
        email: string;
        name?: string;
        password?: string;
        twoFactorToken?: string;
    };
    ForgotPassword: undefined;
};

export type AppStackParamList = {
    Onboarding: undefined;
    Workspaces: undefined;
    Invites: undefined;
    Notes: { workspaceId: string; workspaceName: string };
    NoteEditor: { workspaceId: string; noteId: string; noteTitle: string };
    Chat: { workspaceId: string; workspaceName: string };
    Profile: undefined;
    Settings: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
    return (
        <AuthStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
                animation: 'fade',
                animationDuration: 220,
                animationTypeForReplace: 'push',
                transitionSpec: {
                    open: {
                        animation: 'timing',
                        config: { duration: 220, easing: Easing.out(Easing.cubic) },
                    },
                    close: {
                        animation: 'timing',
                        config: { duration: 220, easing: Easing.out(Easing.cubic) },
                    },
                },
            }}
        >
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="SignUp" component={SignUpScreen} />
            <AuthStack.Screen name="OTP" component={OTPScreen} />
            <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </AuthStack.Navigator>
    );
}

function AppNavigator() {
    const { user } = useAuth();
    const showOnboarding = user && !user.hasSeenOnboarding;

    return (
        <AppStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
                animation: 'fade',
                animationDuration: 220,
                animationTypeForReplace: 'push',
                transitionSpec: {
                    open: {
                        animation: 'timing',
                        config: { duration: 220, easing: Easing.out(Easing.cubic) },
                    },
                    close: {
                        animation: 'timing',
                        config: { duration: 220, easing: Easing.out(Easing.cubic) },
                    },
                },
            }}
            initialRouteName={showOnboarding ? 'Onboarding' : 'Workspaces'}
        >
            <AppStack.Screen name="Onboarding" component={OnboardingScreen} />
            <AppStack.Screen name="Workspaces" component={WorkspacesScreen} />
            <AppStack.Screen name="Invites" component={InvitesScreen} />
            <AppStack.Screen name="Notes" component={NotesScreen} />
            <AppStack.Screen name="NoteEditor" component={NoteEditorScreen} />
            <AppStack.Screen name="Chat" component={ChatScreen} />
            <AppStack.Screen name="Profile" component={ProfileScreen} />
            <AppStack.Screen name="Settings" component={SettingsScreen} />
        </AppStack.Navigator>
    );
}

export function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();
    const [appIsReady, setAppIsReady] = useState(false);
    const [showLoading, setShowLoading] = useState(false);
    const [isRootLayout, setIsRootLayout] = useState(false);
    const shouldShowLoading = isLoading && showLoading;

    useEffect(() => {
        async function prepare() {
            try {
                await SplashScreen.preventAutoHideAsync();
            } catch {
                // Ignore errors if splash is already prevented.
            } finally {
                setAppIsReady(true);
            }
        }
        prepare();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            setShowLoading(false);
            return;
        }
        const timeout = setTimeout(() => setShowLoading(true), 200);
        return () => clearTimeout(timeout);
    }, [isLoading]);

    const onLayoutRootView = useCallback(async () => {
        setIsRootLayout(true);
    }, []);

    useEffect(() => {
        if (!isRootLayout) return;
        if (appIsReady && (!isLoading || shouldShowLoading)) {
            SplashScreen.hideAsync();
        }
    }, [appIsReady, isLoading, shouldShowLoading, isRootLayout]);

    return (
        <View style={styles.root} onLayout={onLayoutRootView}>
            {shouldShowLoading && <LoadingScreen />}
            {!isLoading && (
                <NavigationContainer>
                    {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
                </NavigationContainer>
            )}
            {isLoading && !shouldShowLoading && <View style={styles.bootScreen} />}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    bootScreen: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
});
