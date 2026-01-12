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
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  plan: PlanTier;
  isSubscribed: boolean;
  createdAt?: Date | null;
}

export interface Workspace {
  id: string;
  name: string;
  members: WorkspaceMember[];
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
  publicPublishedAt?: Date | null;
  publicExpiresAt?: Date | null;
  deletedAt?: Date | null;
}

export interface NoteAttachment {
  id: string;
  noteId: string;
  name: string;
  url: string;
  size?: number | null;
  contentType?: string | null;
  createdAt: Date;
  createdBy: User;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  createdAt: Date;
  createdBy: User;
}

export interface NoteVersionDetail extends NoteVersion {
  body: string;
  tags: string[];
}

export interface NoteVersionsPage {
  items: NoteVersion[];
  meta: {
    total: number;
    limit: number;
  };
}

export interface PublicNote {
  id: string;
  title: string;
  body: string;
  updatedAt: Date;
  updatedBy: Pick<User, 'id' | 'name' | 'avatar'>;
  publicSlug: string;
  publicExpiresAt?: Date | null;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Date;
  createdAt?: Date;
  createdBy?: string;
}

export interface InviteDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: Date;
  createdAt?: Date;
  inviter?: Pick<User, 'id' | 'name' | 'email' | 'avatar'>;
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

export interface ChatMentionNotification {
  id: string;
  messageId: string;
  createdAt: Date;
  readAt?: Date | null;
  messageCreatedAt?: Date | null;
  deletedAt?: Date | null;
  body?: string | null;
  sender?: User;
}

export interface ChatAudit {
  id: string;
  workspaceId: string;
  messageId: string;
  action: string;
  createdAt: Date;
  beforeBody?: string | null;
  actor?: User;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'new-version';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
