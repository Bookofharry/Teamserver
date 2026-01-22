import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type {
    User,
    Workspace,
    Group,
    Note,
    ChatMessage,
    UserRole,
    WorkspaceMember,
    ChatAttachment,
    ChatReaction,
    ChatMention,
} from '../types';

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
const isDev =
    (globalThis as { __DEV__?: boolean }).__DEV__ ??
    process.env.NODE_ENV === 'development';

type RawUser = Partial<User> & {
    last_workspace_id?: string | null;
    status_emoji?: string | null;
    has_seen_onboarding?: boolean;
};

type RawWorkspace = {
    id: string;
    name: string;
    members?: WorkspaceMember[];
    memberCount?: number;
    member_count?: number;
    createdAt: string | Date;
};

type RawWorkspaceMember = {
    id?: string;
    workspaceId?: string;
    userId: string;
    user?: Partial<User>;
    role: UserRole;
    joinedAt?: string | Date;
};

type RawGroup = Omit<Group, 'noteCount'> & { noteCount?: number };

type RawNote = Omit<Note, 'createdAt' | 'updatedAt' | 'updatedBy' | 'deletedAt'> & {
    body?: string;
    bodyPreview?: string;
    createdAt: string | Date;
    updatedAt: string | Date;
    updatedBy?: Partial<User>;
    deletedAt?: string | Date | null;
    isPublic?: boolean;
    publicSlug?: string | null;
    isPinned?: boolean;
    tags?: string[];
};

type RawChatMessage = Omit<ChatMessage, 'createdAt' | 'editedAt' | 'deletedAt' | 'sender' | 'attachments' | 'reactions' | 'mentions'> & {
    createdAt: string | Date;
    editedAt?: string | Date | null;
    deletedAt?: string | Date | null;
    sender?: Partial<User>;
    attachments?: ChatAttachment[];
    reactions?: ChatReaction[];
    mentions?: ChatMention[];
};

if (!process.env.EXPO_PUBLIC_API_URL && isDev) {
    console.warn(
        'EXPO_PUBLIC_API_URL is not set. Using localhost may fail on Expo Go devices. Set it in your env.'
    );
} else if (API_URL.includes('localhost') && isDev && Platform.OS !== 'web') {
    console.warn(
        'API_URL points to localhost. On a physical device, use your machine IP instead.'
    );
}

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
const normalizeUser = (user?: RawUser): User => {
    const plan = user?.plan ?? (user?.isSubscribed ? 'premium' : 'free');
    return {
        id: user?.id ?? 'unknown',
        name: user?.name ?? 'Unknown',
        email: user?.email ?? '',
        avatar: user?.avatar,
        twoFactorEnabled: user?.twoFactorEnabled ?? false,
        plan,
        isSubscribed: user?.isSubscribed ?? plan !== 'free',
        lastWorkspaceId: user?.lastWorkspaceId ?? user?.last_workspace_id ?? null,
        status: user?.status ?? null,
        statusEmoji: user?.statusEmoji ?? user?.status_emoji ?? null,
        hasSeenOnboarding: user?.hasSeenOnboarding ?? user?.has_seen_onboarding ?? false,
    };
};

const normalizeWorkspace = (workspace: RawWorkspace): Workspace => ({
    id: workspace.id,
    name: workspace.name,
    members: workspace.members ?? [],
    memberCount: workspace.memberCount ?? workspace.member_count ?? workspace.members?.length ?? 0,
    createdAt: new Date(workspace.createdAt),
});

const normalizeGroup = (group: RawGroup): Group => ({
    ...group,
    noteCount: group.noteCount ?? 0,
});

const normalizeNote = (note: RawNote): Note => ({
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

const normalizeChatMessage = (message: RawChatMessage): ChatMessage => ({
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
        const data = await request<RawUser>('/me');
        return normalizeUser(data);
    },

    async updateMe(input: {
        name?: string;
        avatar?: string;
        lastWorkspaceId?: string | null;
        hasSeenOnboarding?: boolean;
    }): Promise<User> {
        const data = await request<RawUser>('/me', {
            method: 'PATCH',
            body: JSON.stringify(input),
        });
        return normalizeUser(data);
    },

    // Workspaces
    async getWorkspaces(): Promise<Workspace[]> {
        const data = await request<RawWorkspace[]>('/workspaces');
        return data.map(normalizeWorkspace);
    },

    async createWorkspace(input: { name: string }): Promise<Workspace> {
        const data = await request<RawWorkspace>('/workspaces', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        return normalizeWorkspace(data);
    },

    async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
        const data = await request<RawWorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
        return data.map((member) => ({
            id: member.id,
            workspaceId: member.workspaceId,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt ? new Date(member.joinedAt) : new Date(),
            user: normalizeUser(member.user),
        }));
    },

    async deleteWorkspace(workspaceId: string): Promise<{ id: string }> {
        return request<{ id: string }>(`/workspaces/${workspaceId}`, {
            method: 'DELETE',
        });
    },

    async updateWorkspace(workspaceId: string, input: { name: string }): Promise<Workspace> {
        const data = await request<RawWorkspace>(`/workspaces/${workspaceId}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
        });
        return normalizeWorkspace(data);
    },

    // Groups
    async getGroups(workspaceId: string): Promise<Group[]> {
        const data = await request<RawGroup[]>(`/workspaces/${workspaceId}/groups`);
        return data.map(normalizeGroup);
    },

    async createGroup(input: { workspaceId: string; name: string; color?: string }): Promise<Group> {
        const data = await request<RawGroup>(`/workspaces/${input.workspaceId}/groups`, {
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
        const data = await request<RawNote[]>(`/workspaces/${workspaceId}/notes${query ? `?${query}` : ''}`);
        return data.map(normalizeNote);
    },

    async getNote(noteId: string): Promise<Note> {
        const data = await request<RawNote>(`/notes/${noteId}`);
        return normalizeNote(data);
    },

    async createNote(input: {
        workspaceId: string;
        groupId: string;
        title: string;
        body?: string;
        tags?: string[];
    }): Promise<Note> {
        const data = await request<RawNote>(`/workspaces/${input.workspaceId}/notes`, {
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
        noteId: string;
        title?: string;
        body?: string;
        tags?: string[];
        groupId?: string;
        isPinned?: boolean;
    }): Promise<Note> {
        const data = await request<RawNote>(`/notes/${input.noteId}`, {
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

    async deleteNote(noteId: string): Promise<{ id: string }> {
        return request<{ id: string }>(`/notes/${noteId}`, {
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
        const data = await request<RawChatMessage[]>(
            `/workspaces/${workspaceId}/chat/messages${query ? `?${query}` : ''}`
        );
        return data.map(normalizeChatMessage);
    },

    async createChatMessage(input: {
        workspaceId: string;
        body: string;
        messageType?: string;
    }): Promise<ChatMessage> {
        const data = await request<RawChatMessage>(`/workspaces/${input.workspaceId}/chat/messages`, {
            method: 'POST',
            body: JSON.stringify({
                body: input.body,
                messageType: input.messageType || 'text',
            }),
        });
        return normalizeChatMessage(data);
    },

    async updateChatMessage(input: {
        workspaceId: string;
        messageId: string;
        body: string;
    }): Promise<ChatMessage> {
        const data = await request<RawChatMessage>(
            `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}`,
            {
            method: 'PATCH',
            body: JSON.stringify({
                body: input.body,
            }),
        });
        return normalizeChatMessage(data);
    },

    async deleteChatMessage(input: {
        workspaceId: string;
        messageId: string;
    }): Promise<{ id: string }> {
        return request<{ id: string }>(`/workspaces/${input.workspaceId}/chat/messages/${input.messageId}`, {
            method: 'DELETE',
        });
    },

    async addReaction(input: {
        workspaceId: string;
        messageId: string;
        emoji: string;
    }): Promise<{ id: string; emoji: string; userId: string }> {
        return request<{ id: string; emoji: string; userId: string }>(
            `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}/reactions`,
            {
                method: 'POST',
                body: JSON.stringify({ emoji: input.emoji }),
            }
        );
    },

    async removeReaction(input: {
        workspaceId: string;
        messageId: string;
        reactionId: string;
    }): Promise<{ id: string }> {
        return request<{ id: string }>(
            `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}/reactions/${input.reactionId}`,
            {
                method: 'DELETE',
            }
        );
    },

    // Token management
    getAuthToken,
    setAuthToken,
};

export const api = restApi;
