import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

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
    Workspaces: undefined;
    Notes: { workspaceId: string; workspaceName: string };
    NoteEditor: { workspaceId: string; noteId: string; noteTitle: string };
    Chat: { workspaceId: string; workspaceName: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator() {
    return (
        <AuthStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
                animation: 'slide_from_right',
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
    return (
        <AppStack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#0a0a0a' },
                animation: 'slide_from_right',
            }}
        >
            <AppStack.Screen name="Workspaces" component={WorkspacesScreen} />
            <AppStack.Screen name="Notes" component={NotesScreen} />
            <AppStack.Screen name="NoteEditor" component={NoteEditorScreen} />
            <AppStack.Screen name="Chat" component={ChatScreen} />
        </AppStack.Navigator>
    );
}

export function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return null; // Or a loading screen
    }

    return (
        <NavigationContainer>
            {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
        </NavigationContainer>
    );
}
