import * as SecureStore from 'expo-secure-store';
import type { User, Workspace, Group, Note, ChatMessage, UserRole, PlanTier, WorkspaceMember } from '../types';

type ApiResponse<T> = { data: T };

type SessionResponse = {
    userId: string;
    email?: string;
    accessToken?: string;
    twoFactorRequired?: boolean;
    twoFactorToken?: string;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';
const AUTH_TOKEN_KEY = 'teampad_token';

const getAuthToken = async (): Promise<string | null> => {
    try {
        return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    } catch {
        return null;
    }
};

const setAuthToken = async (token: string | null): Promise<void> => {
    try {
        if (token) {
            await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        } else {
            await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        }
    } catch (error) {
        console.error('Failed to store auth token:', error);
    }
};

const request = async <T>(
    path: string,
    options: RequestInit = {},
): Promise<T> => {
    const authToken = await getAuthToken();

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            ...options.headers,
        },
    });

    const payload = await res.json().catch(() => null) as ApiResponse<T> | null;

    if (!res.ok) {
        const message = payload && 'error' in payload && payload.error
            ? (payload.error as { message?: string }).message
            : 'Request failed';
        throw new Error(message || 'Request failed');
    }

    if (!payload || !('data' in payload)) {
        throw new Error('Unexpected response');
    }

    return payload.data;
};

// Normalize functions
const normalizeUser = (user?: Partial<User>): User => {
    const plan = user?.plan ?? (user?.isSubscribed ? 'premium' : 'free');
    return {
        id: user?.id ?? 'unknown',
        name: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        avatar: user?.avatar,
        twoFactorEnabled: user?.twoFactorEnabled ?? false,
        plan,
        isSubscribed: user?.isSubscribed ?? plan !== 'free',
        lastWorkspaceId: (user as any)?.lastWorkspaceId ?? (user as any)?.last_workspace_id ?? null,
        status: (user as any)?.status ?? null,
        statusEmoji: (user as any)?.statusEmoji ?? (user as any)?.status_emoji ?? null,
        hasSeenOnboarding: (user as any)?.hasSeenOnboarding ?? (user as any)?.has_seen_onboarding ?? false,
    };
};

const normalizeWorkspace = (workspace: any): Workspace => ({
    id: workspace.id,
    name: workspace.name,
    members: workspace.members ?? [],
    createdAt: new Date(workspace.createdAt),
});

const normalizeGroup = (group: any): Group => ({
    ...group,
    noteCount: group.noteCount ?? 0,
});

const normalizeNote = (note: any): Note => ({
    ...note,
    body: note.body ?? '',
    bodyPreview: note.bodyPreview,
    createdAt: new Date(note.createdAt),
    updatedAt: new Date(note.updatedAt),
    updatedBy: normalizeUser(note.updatedBy),
    isPublic: note.isPublic ?? false,
    publicSlug: note.publicSlug ?? null,
    deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
});

const normalizeChatMessage = (message: any): ChatMessage => ({
    id: message.id,
    workspaceId: message.workspaceId,
    body: message.body ?? '',
    messageType: message.messageType,
    createdAt: new Date(message.createdAt),
    editedAt: message.editedAt ? new Date(message.editedAt) : null,
    deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
    sender: message.sender ? normalizeUser(message.sender) : undefined,
    attachments: message.attachments ?? [],
    reactions: message.reactions ?? [],
    mentions: message.mentions ?? [],
});

export const restApi = {
    // Auth
    async requestSignupOtp(email: string): Promise<{ sent: boolean }> {
        return request<{ sent: boolean }>('/auth/signup/request', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    async verifySignupOtp(input: {
        name: string;
        email: string;
        password: string;
        code: string;
    }): Promise<{ userId: string; email?: string }> {
        const data = await request<SessionResponse>('/auth/signup/verify', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        if (data.accessToken) {
            await setAuthToken(data.accessToken);
        }
        return data;
    },

    async login(input: { email: string; password: string }): Promise<SessionResponse> {
        const data = await request<SessionResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        if (data.accessToken) {
            await setAuthToken(data.accessToken);
        }
        return data;
    },

    async verifyTwoFactorLogin(input: { token: string; code: string }): Promise<SessionResponse> {
        const data = await request<SessionResponse>('/auth/2fa/verify', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        if (data.accessToken) {
            await setAuthToken(data.accessToken);
        }
        return data;
    },

    async resendTwoFactorLogin(input: { token: string }): Promise<{ sent: boolean }> {
        return request<{ sent: boolean }>('/auth/2fa/resend', {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },

    async clearSession(): Promise<{ cleared: boolean }> {
        const res = await request<{ cleared: boolean }>('/auth/logout', {
            method: 'POST',
        });
        await setAuthToken(null);
        return res;
    },

    async forgotPassword(email: string): Promise<{ sent: boolean }> {
        return request<{ sent: boolean }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    async getMe(): Promise<User> {
        const data = await request<Partial<User>>('/me');
        return normalizeUser(data);
    },

    async updateMe(input: {
        name?: string;
        avatar?: string;
        lastWorkspaceId?: string | null;
        hasSeenOnboarding?: boolean;
    }): Promise<User> {
        const data = await request<Partial<User>>('/me', {
            method: 'PATCH',
            body: JSON.stringify(input),
        });
        return normalizeUser(data);
    },

    // Workspaces
    async getWorkspaces(): Promise<Workspace[]> {
        const data = await request<any[]>('/workspaces');
        return data.map(normalizeWorkspace);
    },

    async createWorkspace(input: { name: string }): Promise<Workspace> {
        const data = await request<any>('/workspaces', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return normalizeWorkspace(data);
    },

    // Groups
    async getGroups(workspaceId: string): Promise<Group[]> {
        const data = await request<any[]>(`/workspaces/${workspaceId}/groups`);
        return data.map(normalizeGroup);
    },

    async createGroup(input: { workspaceId: string; name: string; color?: string }): Promise<Group> {
        const data = await request<any>(`/workspaces/${input.workspaceId}/groups`, {
            method: 'POST',
            body: JSON.stringify({ name: input.name, color: input.color }),
        });
        return normalizeGroup(data);
    },

    // Notes
    async getNotes(
        workspaceId: string,
        groupId?: string | null,
        search?: string,
        options?: { limit?: number; offset?: number }
    ): Promise<Note[]> {
        const params = new URLSearchParams();
        if (groupId) params.set('groupId', groupId);
        if (search) params.set('search', search);
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const query = params.toString();
        const data = await request<any[]>(`/workspaces/${workspaceId}/notes${query ? `?${query}` : ''}`);
        return data.map(normalizeNote);
    },

    async getNote(noteId: string, workspaceId: string): Promise<Note> {
        const data = await request<any>(`/workspaces/${workspaceId}/notes/${noteId}`);
        return normalizeNote(data);
    },

    async createNote(input: {
        workspaceId: string;
        groupId: string;
        title: string;
        body?: string;
        tags?: string[];
    }): Promise<Note> {
        const data = await request<any>(`/workspaces/${input.workspaceId}/notes`, {
            method: 'POST',
            body: JSON.stringify({
                groupId: input.groupId,
                title: input.title,
                body: input.body,
                tags: input.tags,
            }),
        });
        return normalizeNote(data);
    },

    async updateNote(input: {
        workspaceId: string;
        noteId: string;
        title?: string;
        body?: string;
        tags?: string[];
        groupId?: string;
        isPinned?: boolean;
    }): Promise<Note> {
        const data = await request<any>(`/workspaces/${input.workspaceId}/notes/${input.noteId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                title: input.title,
                body: input.body,
                tags: input.tags,
                groupId: input.groupId,
                isPinned: input.isPinned,
            }),
        });
        return normalizeNote(data);
    },

    async deleteNote(workspaceId: string, noteId: string): Promise<{ deleted: boolean }> {
        return request<{ deleted: boolean }>(`/workspaces/${workspaceId}/notes/${noteId}`, {
            method: 'DELETE',
        });
    },

    // Chat
    async getChatMessages(
        workspaceId: string,
        options?: { limit?: number; offset?: number }
    ): Promise<ChatMessage[]> {
        const params = new URLSearchParams();
        if (options?.limit) params.set('limit', String(options.limit));
        if (options?.offset) params.set('offset', String(options.offset));

        const query = params.toString();
        const data = await request<any[]>(`/workspaces/${workspaceId}/chat${query ? `?${query}` : ''}`);
        return data.map(normalizeChatMessage);
    },

    async createChatMessage(input: {
        workspaceId: string;
        body: string;
        messageType?: string;
    }): Promise<ChatMessage> {
        const data = await request<any>(`/workspaces/${input.workspaceId}/chat`, {
            method: 'POST',
            body: JSON.stringify({
                body: input.body,
                messageType: input.messageType || 'text',
            }),
        });
        return normalizeChatMessage(data);
    },

    // Token management
    getAuthToken,
    setAuthToken,
};

export const api = restApi;
