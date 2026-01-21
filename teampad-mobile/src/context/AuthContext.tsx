import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../api/restApi';
import type { User } from '../types';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean; twoFactorToken?: string }>;
    signup: (name: string, email: string, password: string, code: string) => Promise<void>;
    requestSignupOtp: (email: string) => Promise<void>;
    verifyTwoFactor: (token: string, code: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const token = await api.getAuthToken();
            if (!token) {
                setUser(null);
                setIsLoading(false);
                return;
            }
            const me = await api.getMe();
            setUser(me);
        } catch (error) {
            setUser(null);
            await api.setAuthToken(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await api.login({ email, password });
        if (response.twoFactorRequired && response.twoFactorToken) {
            return { twoFactorRequired: true, twoFactorToken: response.twoFactorToken };
        }
        await refresh();
        return {};
    }, [refresh]);

    const signup = useCallback(async (name: string, email: string, password: string, code: string) => {
        await api.verifySignupOtp({ name, email, password, code });
        await refresh();
    }, [refresh]);

    const requestSignupOtp = useCallback(async (email: string) => {
        await api.requestSignupOtp(email);
    }, []);

    const verifyTwoFactor = useCallback(async (token: string, code: string) => {
        await api.verifyTwoFactorLogin({ token, code });
        await refresh();
    }, [refresh]);

    const logout = useCallback(async () => {
        try {
            await api.clearSession();
        } catch {
            // Ignore errors on logout
        }
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                signup,
                requestSignupOtp,
                verifyTwoFactor,
                logout,
                refresh,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
