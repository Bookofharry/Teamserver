export type UserRole = 'owner' | 'admin' | 'member';
export type PlanTier = 'free' | 'premium' | 'premium_plus';

export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    twoFactorEnabled: boolean;
    isSubscribed: boolean;
    plan: PlanTier;
    lastWorkspaceId?: string | null;
    status?: string | null;
    statusEmoji?: string | null;
    hasSeenOnboarding?: boolean;
}

export interface Workspace {
    id: string;
    name: string;
    members: WorkspaceMember[];
    memberCount?: number;
    createdAt: Date;
}

export interface WorkspaceMember {
    id?: string;
    workspaceId?: string;
    userId: string;
    user: User;
    role: UserRole;
    joinedAt: Date;
}

export interface Group {
    id: string;
    name: string;
    workspaceId: string;
    noteCount: number;
    color?: string;
}

export interface Note {
    id: string;
    title: string;
    body: string;
    bodyPreview?: string;
    groupId: string;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
    updatedBy: User;
    isPinned: boolean;
    tags: string[];
    isPublic?: boolean;
    publicSlug?: string | null;
    deletedAt?: Date | null;
}

export interface ChatMessage {
    id: string;
    workspaceId: string;
    body: string;
    messageType: string;
    createdAt: Date;
    editedAt?: Date | null;
    deletedAt?: Date | null;
    sender?: User;
    attachments: ChatAttachment[];
    reactions: ChatReaction[];
    mentions: ChatMention[];
}

export interface ChatAttachment {
    id: string;
    messageId: string;
    filePath: string;
    url?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    size?: number | null;
    createdAt: Date;
    uploadedBy?: User;
}

export interface ChatReaction {
    id: string;
    messageId: string;
    emoji: string;
    userId: string;
    createdAt: Date;
}

export interface ChatMention {
    id: string;
    messageId: string;
    mentionedUserId: string;
    mentionText?: string | null;
    startIndex?: number | null;
    endIndex?: number | null;
    createdAt: Date;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}
