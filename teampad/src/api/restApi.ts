import type { Group, InviteDetails, Note, NoteVersionDetail, Workspace, WorkspaceInvite, WorkspaceMember, User, UserRole, PlanTier, PublicNote, AdminUser, NoteAttachment, NoteVersion, ChatMessage, ChatAttachment, ChatReaction, ChatMention, NoteVersionsPage, ChatMentionNotification, ChatAudit } from "@/types";

type ApiResponse<T> = { data: T };

type WorkspaceResponse = {
  id: string;
  name: string;
  ownerId?: string;
  createdAt: string;
  members?: WorkspaceMember[];
};

type GroupResponse = Group;

type NoteResponse = Omit<Note, "createdAt" | "updatedAt" | "body"> & {
  createdAt: string;
  updatedAt: string;
  updatedBy?: Partial<User>;
  body?: string;
  bodyPreview?: string;
  isPublic?: boolean;
  publicSlug?: string | null;
  publicPublishedAt?: string | null;
  publicExpiresAt?: string | null;
  deletedAt?: string | null;
};

type MemberResponse = {
  id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  joinedAt?: string;
  user?: Partial<User>;
};

type InviteResponse = {
  id: string;
  workspaceId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  createdAt?: string;
  createdBy?: string;
  workspace_id?: string;
  expires_at?: string;
  created_at?: string;
  created_by?: string;
};

type InviteDetailsResponse = InviteResponse & {
  workspaceName: string;
  inviter?: Partial<User>;
};

type AcceptInviteResponse = {
  workspaceId: string;
  member: {
    id: string;
    userId: string;
    role: UserRole;
  };
};

type UpgradeIntentResponse = {
  id: string;
  plan: string;
  status: string;
  createdAt?: string;
  created_at?: string;
  alreadyPending?: boolean;
};

type PublicNoteResponse = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  updatedBy?: {
    id?: string;
    name?: string;
    avatar?: string | null;
  };
  publicSlug: string;
  publicExpiresAt?: string | null;
};

type NoteAttachmentResponse = {
  id: string;
  noteId: string;
  name: string;
  url: string;
  size?: number | null;
  contentType?: string | null;
  createdAt: string;
  createdBy?: Partial<User>;
};

type NoteVersionResponse = {
  id: string;
  noteId: string;
  title: string;
  createdAt: string;
  createdBy?: Partial<User>;
};

type NoteVersionsResponse = {
  items: NoteVersionResponse[];
  meta: {
    total: number;
    limit: number;
  };
};

type NoteVersionDetailResponse = NoteVersionResponse & {
  body?: string | null;
  tags?: string[] | null;
};

type ChatAttachmentResponse = {
  id: string;
  messageId: string;
  filePath: string;
  url?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  size?: number | null;
  createdAt: string;
  uploadedBy?: Partial<User>;
};

type ChatReactionResponse = {
  id: string;
  messageId: string;
  emoji: string;
  userId: string;
  createdAt: string;
};

type ChatMentionResponse = {
  id: string;
  messageId: string;
  mentionedUserId: string;
  mentionText?: string | null;
  startIndex?: number | null;
  endIndex?: number | null;
  createdAt: string;
};

type ChatMessageResponse = {
  id: string;
  workspaceId: string;
  body: string;
  messageType: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  sender?: Partial<User>;
  attachments?: ChatAttachmentResponse[];
  reactions?: ChatReactionResponse[];
  mentions?: ChatMentionResponse[];
};

type ChatUploadResponse = {
  bucket: string;
  path: string;
  uploadUrl: string;
  expiresIn: number;
};

type ChatUnreadResponse = {
  unreadCount: number;
  mentionCount: number;
  since: string;
};

type ChatMentionNotificationResponse = {
  id: string;
  messageId: string;
  createdAt: string;
  readAt?: string | null;
  messageCreatedAt?: string | null;
  deletedAt?: string | null;
  body?: string | null;
  sender?: Partial<User>;
};

type ChatAuditResponse = {
  id: string;
  workspaceId: string;
  messageId: string;
  action: string;
  createdAt: string;
  beforeBody?: string | null;
  actor?: Partial<User>;
};

type AdminUserResponse = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  plan?: string | null;
  is_subscribed?: boolean | null;
  created_at?: string | null;
};

type PaginationParams = {
  limit?: number;
  offset?: number;
};

const DEFAULT_TIMEOUT_MS = 12000;
const AUTH_LOST_EVENT = "teampad:auth-lost";
const CSRF_COOKIE_NAME = "csrf_token";
let cachedCsrfToken = "";

const notifyAuthLost = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_LOST_EVENT));
};

const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    return "/api";
  }
  // Robustly strip ALL trailing slashes to prevent double-slash issues (e.g. ".../api/" -> ".../api")
  return url.replace(/\/+$/, "");
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const pattern = `; ${document.cookie}`;
  const parts = pattern.split(`; ${name}=`);
  if (parts.length < 2) return "";
  return parts.pop()?.split(";").shift() ?? "";
};

// CSRF disabled on client; helper kept for API compatibility.
export const getCsrfToken = async () => "";

const isSafeMethod = (method: string) => ["GET", "HEAD", "OPTIONS"].includes(method);

const isOffline = () =>
  typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine;

const fetchCsrfToken = async () => { };

const refreshSession = async () => {
  const res = await fetch(`${getApiUrl()}/auth/refresh`, {
    credentials: "include",
    cache: "no-store",
  });
  const responseToken = res.headers.get("X-CSRF-Token");
  if (responseToken) cachedCsrfToken = responseToken;
  const payload = (await res.json().catch(() => null)) as ApiResponse<{ userId: string; email: string }> | null;
  if (!res.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? (payload.error as { message?: string }).message
        : "Session refresh failed";
    const error = new Error(message || "Session refresh failed") as Error & {
      status?: number;
      code?: string;
    };
    error.status = res.status;
    if (payload && "error" in payload && payload.error) {
      error.code = (payload.error as { code?: string }).code;
    }
    throw error;
  }
};

const getNetworkErrorMessage = (error: unknown) => {
  if (isOffline()) {
    return "You're offline. Reconnect to the internet to continue.";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "This is taking longer than expected. Please retry.";
  }
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
    return "Server says hold on, try again.";
  }
  return "We couldn't reach TeamPad. Please try again.";
};

const request = async <T>(
  path: string,
  options: RequestInit = {},
  retryOnCsrf = true,
  retryOnAuth = true,
): Promise<T> => {
  const method = (options.method || "GET").toUpperCase();
  const csrfToken = ""; // CSRF disabled
  const controller = options.signal ? null : new AbortController();
  const timeoutId = controller ? setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS) : null;
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      signal: options.signal ?? controller?.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(getNetworkErrorMessage(error));
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // CSRF disabled; ignore response token
  const payload = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok) {
    if (
      retryOnAuth &&
      res.status === 401 &&
      !path.startsWith("/auth/") &&
      path !== "/csrf"
    ) {
      try {
        await refreshSession();
        return request<T>(path, options, retryOnCsrf, false);
      } catch {
        notifyAuthLost();
        // Fall through to the original error handling.
      }
    }
    if (res.status === 401) {
      notifyAuthLost();
    }
    if (res.status >= 500) {
      throw new Error("TeamPad is having trouble right now. Please try again shortly.");
    }
    const message =
      payload && "error" in payload && payload.error
        ? (payload.error as { message?: string }).message
        : "Request failed";
    const error = new Error(message || "Request failed") as Error & {
      status?: number;
      code?: string;
    };
    error.status = res.status;
    if (payload && "error" in payload && payload.error) {
      error.code = (payload.error as { code?: string }).code;
    }
    throw error;
  }

  if (!payload || !("data" in payload)) {
    throw new Error("Unexpected response from TeamPad. Please try again.");
  }
  return payload.data;
};

const normalizeWorkspace = (workspace: WorkspaceResponse): Workspace => ({
  id: workspace.id,
  name: workspace.name,
  members: workspace.members ?? [],
  createdAt: new Date(workspace.createdAt),
});

const normalizeGroup = (group: GroupResponse): Group => ({
  ...group,
  noteCount: group.noteCount ?? 0,
});

const normalizeMember = (member: MemberResponse): WorkspaceMember => ({
  id: member.id,
  workspaceId: member.workspaceId,
  userId: member.userId,
  role: member.role,
  joinedAt: member.joinedAt ? new Date(member.joinedAt) : new Date(),
  user: normalizeUser(member.user),
});

const normalizeInvite = (invite: InviteResponse): WorkspaceInvite => ({
  id: invite.id,
  workspaceId: invite.workspaceId || invite.workspace_id || '',
  email: invite.email,
  role: invite.role,
  token: invite.token,
  expiresAt: new Date(invite.expiresAt || invite.expires_at || ''),
  createdAt: invite.createdAt
    ? new Date(invite.createdAt)
    : invite.created_at
      ? new Date(invite.created_at)
      : undefined,
  createdBy: invite.createdBy || invite.created_by,
});

const normalizeInviteDetails = (invite: InviteDetailsResponse): InviteDetails => ({
  id: invite.id,
  workspaceId: invite.workspaceId || invite.workspace_id || '',
  workspaceName: invite.workspaceName,
  email: invite.email,
  role: invite.role,
  token: invite.token,
  expiresAt: new Date(invite.expiresAt || invite.expires_at || ''),
  createdAt: invite.createdAt
    ? new Date(invite.createdAt)
    : invite.created_at
      ? new Date(invite.created_at)
      : undefined,
  inviter: invite.inviter ? normalizeUser(invite.inviter) : undefined,
});

const normalizeUser = (user?: Partial<User>): User => {
  const plan = user?.plan ?? (user?.isSubscribed ? "premium" : "free");
  return {
    id: user?.id ?? "unknown",
    name: user?.name ?? "Unknown",
    email: user?.email ?? "",
    avatar: user?.avatar,
    twoFactorEnabled: user?.twoFactorEnabled ?? false,
    plan,
    isSubscribed: user?.isSubscribed ?? plan !== "free",
    lastWorkspaceId: (user as { lastWorkspaceId?: string | null; last_workspace_id?: string | null })?.lastWorkspaceId
      ?? (user as { last_workspace_id?: string | null })?.last_workspace_id
      ?? null,
    status: (user as { status?: string | null })?.status ?? null,
    statusEmoji: (user as { statusEmoji?: string | null; status_emoji?: string | null })?.statusEmoji
      ?? (user as { status_emoji?: string | null })?.status_emoji
      ?? null,
    hasSeenOnboarding: (user as { hasSeenOnboarding?: boolean; has_seen_onboarding?: boolean })?.hasSeenOnboarding
      ?? (user as { has_seen_onboarding?: boolean })?.has_seen_onboarding
      ?? false,
  };
};

const normalizeNote = (note: NoteResponse): Note => ({
  ...note,
  body: note.body ?? "",
  bodyPreview: note.bodyPreview,
  createdAt: new Date(note.createdAt),
  updatedAt: new Date(note.updatedAt),
  updatedBy: normalizeUser(note.updatedBy),
  isPublic: note.isPublic ?? false,
  publicSlug: note.publicSlug ?? null,
  publicPublishedAt: note.publicPublishedAt ? new Date(note.publicPublishedAt) : null,
  publicExpiresAt: note.publicExpiresAt ? new Date(note.publicExpiresAt) : null,
  deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
});

const normalizePublicNote = (note: PublicNoteResponse): PublicNote => ({
  id: note.id,
  title: note.title,
  body: note.body ?? "",
  updatedAt: new Date(note.updatedAt),
  updatedBy: {
    id: note.updatedBy?.id ?? "unknown",
    name: note.updatedBy?.name ?? "Unknown",
    avatar: note.updatedBy?.avatar ?? null,
  },
  publicSlug: note.publicSlug,
  publicExpiresAt: note.publicExpiresAt ? new Date(note.publicExpiresAt) : null,
});

const normalizeAttachment = (attachment: NoteAttachmentResponse): NoteAttachment => ({
  id: attachment.id,
  noteId: attachment.noteId,
  name: attachment.name,
  url: attachment.url,
  size: attachment.size ?? null,
  contentType: attachment.contentType ?? null,
  createdAt: new Date(attachment.createdAt),
  createdBy: normalizeUser(attachment.createdBy),
});

const normalizeVersion = (version: NoteVersionResponse): NoteVersion => ({
  id: version.id,
  noteId: version.noteId,
  title: version.title,
  createdAt: new Date(version.createdAt),
  createdBy: normalizeUser(version.createdBy),
});

const normalizeVersionsPage = (payload: NoteVersionsResponse): NoteVersionsPage => ({
  items: payload.items.map(normalizeVersion),
  meta: payload.meta,
});

const normalizeVersionDetail = (version: NoteVersionDetailResponse): NoteVersionDetail => ({
  ...normalizeVersion(version),
  body: version.body ?? "",
  tags: Array.isArray(version.tags) ? version.tags : [],
});

const normalizeChatAttachment = (attachment: ChatAttachmentResponse): ChatAttachment => ({
  id: attachment.id,
  messageId: attachment.messageId,
  filePath: attachment.filePath,
  url: attachment.url ?? null,
  fileName: attachment.fileName ?? null,
  contentType: attachment.contentType ?? null,
  size: attachment.size ?? null,
  createdAt: new Date(attachment.createdAt),
  uploadedBy: attachment.uploadedBy ? normalizeUser(attachment.uploadedBy) : undefined,
});

const normalizeChatReaction = (reaction: ChatReactionResponse): ChatReaction => ({
  id: reaction.id,
  messageId: reaction.messageId,
  emoji: reaction.emoji,
  userId: reaction.userId,
  createdAt: new Date(reaction.createdAt),
});

const normalizeChatMentionNotification = (
  notification: ChatMentionNotificationResponse,
): ChatMentionNotification => ({
  id: notification.id,
  messageId: notification.messageId,
  createdAt: new Date(notification.createdAt),
  readAt: notification.readAt ? new Date(notification.readAt) : null,
  messageCreatedAt: notification.messageCreatedAt ? new Date(notification.messageCreatedAt) : null,
  deletedAt: notification.deletedAt ? new Date(notification.deletedAt) : null,
  body: notification.body ?? null,
  sender: notification.sender ? normalizeUser(notification.sender) : undefined,
});

const normalizeChatAudit = (audit: ChatAuditResponse): ChatAudit => ({
  id: audit.id,
  workspaceId: audit.workspaceId,
  messageId: audit.messageId,
  action: audit.action,
  createdAt: new Date(audit.createdAt),
  beforeBody: audit.beforeBody ?? null,
  actor: audit.actor ? normalizeUser(audit.actor) : undefined,
});

const normalizeChatMention = (mention: ChatMentionResponse): ChatMention => ({
  id: mention.id,
  messageId: mention.messageId,
  mentionedUserId: mention.mentionedUserId,
  mentionText: mention.mentionText ?? null,
  startIndex: mention.startIndex ?? null,
  endIndex: mention.endIndex ?? null,
  createdAt: new Date(mention.createdAt),
});

const normalizeChatMessage = (message: ChatMessageResponse): ChatMessage => ({
  id: message.id,
  workspaceId: message.workspaceId,
  body: message.body ?? "",
  messageType: message.messageType,
  createdAt: new Date(message.createdAt),
  editedAt: message.editedAt ? new Date(message.editedAt) : null,
  deletedAt: message.deletedAt ? new Date(message.deletedAt) : null,
  sender: message.sender ? normalizeUser(message.sender) : undefined,
  attachments: (message.attachments ?? []).map(normalizeChatAttachment),
  reactions: (message.reactions ?? []).map(normalizeChatReaction),
  mentions: (message.mentions ?? []).map(normalizeChatMention),
});

const normalizeAdminUser = (user: AdminUserResponse): AdminUser => {
  const plan = (user.plan as PlanTier) ?? (user.is_subscribed ? "premium" : "free");
  return {
    id: user.id,
    name: user.full_name || "Unknown",
    email: user.email || "",
    avatar: user.avatar_url ?? null,
    plan,
    isSubscribed: user.is_subscribed ?? plan !== "free",
    createdAt: user.created_at ? new Date(user.created_at) : null,
  };
};

const appendPagination = (params: URLSearchParams, pagination?: PaginationParams) => {
  if (!pagination) return;
  if (typeof pagination.limit === "number") {
    params.set("limit", String(pagination.limit));
  }
  if (typeof pagination.offset === "number") {
    params.set("offset", String(pagination.offset));
  }
};

export const restApi = {
  async requestSignupOtp(email: string): Promise<{ sent: boolean }> {
    return request<{ sent: boolean }>("/auth/signup/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async verifySignupOtp(input: {
    name: string;
    email: string;
    password: string;
    code: string;
  }): Promise<{ userId: string; email?: string }> {
    return request<{ userId: string; email?: string }>("/auth/signup/verify", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async login(input: { email: string; password: string }): Promise<{ userId: string; email?: string }> {
    return request<{ userId: string; email?: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async clearSession(): Promise<{ cleared: boolean }> {
    return request<{ cleared: boolean }>("/auth/logout", {
      method: "POST",
    });
  },

  async forgotPassword(email: string): Promise<{ sent: boolean }> {
    return request<{ sent: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(input: { token: string; password: string }): Promise<{ updated: boolean }> {
    return request<{ updated: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getMe(): Promise<User> {
    const data = await request<Partial<User>>("/me", { cache: "no-store" });
    return normalizeUser(data);
  },

  async refreshSession(): Promise<void> {
    await refreshSession();
  },

  async updateMe(input: {
    name?: string;
    avatar?: string;
    lastWorkspaceId?: string | null;
    status?: string | null;
    statusEmoji?: string | null;
    hasSeenOnboarding?: boolean;
  }): Promise<User> {
    const data = await request<Partial<User>>("/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return normalizeUser(data);
  },

  // Streaming AI helper: posts prompt and returns a controller. onEvent({event, data}) is called for each SSE event parsed.
  streamWorkspace(
    workspaceId: string,
    prompt: string,
    onEvent: (ev: { event: string; data: unknown }) => void,
  ): AbortController {
    const controller = new AbortController();
    const url = `${getApiUrl()}/ai/stream`;
    const cookieToken = getCookie(CSRF_COOKIE_NAME);
    if (cookieToken && cookieToken !== cachedCsrfToken) {
      cachedCsrfToken = cookieToken;
    }
    const csrfToken = cookieToken || cachedCsrfToken;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ workspaceId, prompt }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          onEvent({ event: 'error', data: { message: txt || 'Stream failed' } });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          onEvent({ event: 'error', data: { message: 'No readable body' } });
          return;
        }

        const decoder = new TextDecoder();
        let buf = '';

        const processChunk = (chunkStr: string) => {
          buf += chunkStr;
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            // parse block lines
            const lines = block.split(/\r?\n/).map((l) => l.trim());
            let ev = 'message';
            const dataLines: string[] = [];
            for (const line of lines) {
              if (line.startsWith('event:')) ev = line.replace(/^event:\s*/, '');
              else if (line.startsWith('data:')) dataLines.push(line.replace(/^data:\s*/, ''));
            }
            const dataRaw = dataLines.join('\n');
            let data: unknown = dataRaw;
            try {
              data = JSON.parse(dataRaw);
            } catch (e) {
              // leave as string
            }
            onEvent({ event: ev, data });
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          processChunk(decoder.decode(value, { stream: true }));
        }

        // final buffer
        if (buf.trim()) {
          processChunk('\n\n');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          onEvent({ event: 'end', data: { reason: 'aborted' } });
        } else {
          onEvent({ event: 'error', data: { message: err.message } });
        }
      });

    return controller;
  },

  async checkEmailExists(email: string): Promise<boolean> {
    const data = await request<{ exists: boolean }>("/auth/check-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return Boolean(data.exists);
  },

  async listWorkspaceMembers(
    workspaceId: string,
    pagination?: PaginationParams,
  ): Promise<WorkspaceMember[]> {
    const params = new URLSearchParams();
    appendPagination(params, pagination);
    const url = params.toString()
      ? `/workspaces/${workspaceId}/members?${params.toString()}`
      : `/workspaces/${workspaceId}/members`;
    const data = await request<MemberResponse[]>(url);
    return data.map(normalizeMember);
  },

  async listWorkspaceInvites(
    workspaceId: string,
    pagination?: PaginationParams,
  ): Promise<WorkspaceInvite[]> {
    const params = new URLSearchParams();
    appendPagination(params, pagination);
    const url = params.toString()
      ? `/workspaces/${workspaceId}/invites?${params.toString()}`
      : `/workspaces/${workspaceId}/invites`;
    const data = await request<InviteResponse[]>(url);
    return data.map(normalizeInvite);
  },

  async listMyInvites(pagination?: PaginationParams): Promise<InviteDetails[]> {
    const params = new URLSearchParams();
    appendPagination(params, pagination);
    const url = params.toString() ? `/invites?${params.toString()}` : "/invites";
    const data = await request<InviteDetailsResponse[]>(url);
    return data.map(normalizeInviteDetails);
  },

  async removeWorkspaceMember(input: { workspaceId: string; userId: string }): Promise<{ userId: string }> {
    const data = await request<{ workspaceId: string; userId: string }>(
      `/workspaces/${input.workspaceId}/members/${input.userId}`,
      {
        method: "DELETE",
      },
    );
    return { userId: data.userId };
  },

  async leaveWorkspace(workspaceId: string): Promise<{ left: boolean; workspaceId: string }> {
    return request<{ left: boolean; workspaceId: string }>(`/workspaces/${workspaceId}/leave`, {
      method: "POST",
    });
  },

  async createInvite(input: {
    workspaceId: string;
    email: string;
    role?: UserRole;
  }): Promise<WorkspaceInvite> {
    const data = await request<InviteResponse>(`/workspaces/${input.workspaceId}/invites`, {
      method: "POST",
      headers: { "Idempotency-Key": createIdempotencyKey() },
      body: JSON.stringify({
        email: input.email,
        role: input.role ?? "member",
      }),
    });
    return normalizeInvite(data);
  },

  async acceptInvite(token: string): Promise<AcceptInviteResponse> {
    return request<AcceptInviteResponse>(`/invites/${token}/accept`, {
      method: "POST",
    });
  },

  async declineInvite(token: string): Promise<{ workspaceId: string; email: string }> {
    return request<{ workspaceId: string; email: string }>(`/invites/${token}/decline`, {
      method: "POST",
    });
  },

  async getInviteDetails(token: string): Promise<InviteDetails> {
    const data = await request<InviteDetailsResponse>(`/invites/${token}`);
    return normalizeInviteDetails(data);
  },

  async listWorkspaces(pagination?: PaginationParams): Promise<Workspace[]> {
    const params = new URLSearchParams();
    appendPagination(params, pagination);
    const url = params.toString() ? `/workspaces?${params.toString()}` : "/workspaces";
    const data = await request<WorkspaceResponse[]>(url);
    return data.map(normalizeWorkspace);
  },

  async createWorkspace(input: { name: string }): Promise<Workspace> {
    const trimmedName = input.name?.trim();
    const data = await request<WorkspaceResponse>("/workspaces", {
      method: "POST",
      headers: { "Idempotency-Key": createIdempotencyKey() },
      body: JSON.stringify(trimmedName ? { name: trimmedName } : {}),
    });
    return normalizeWorkspace(data);
  },

  async updateWorkspace(input: { workspaceId: string; name: string }): Promise<Workspace> {
    const data = await request<WorkspaceResponse>(`/workspaces/${input.workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: input.name }),
    });
    return normalizeWorkspace(data);
  },

  async deleteWorkspace(workspaceId: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/workspaces/${workspaceId}`, {
      method: "DELETE",
    });
  },

  async listGroups(workspaceId: string, pagination?: PaginationParams): Promise<Group[]> {
    const params = new URLSearchParams();
    appendPagination(params, pagination);
    const url = params.toString()
      ? `/workspaces/${workspaceId}/groups?${params.toString()}`
      : `/workspaces/${workspaceId}/groups`;
    const data = await request<GroupResponse[]>(url);
    return data.map(normalizeGroup);
  },

  async createGroup(input: { workspaceId: string; name: string; color?: string }): Promise<Group> {
    const data = await request<GroupResponse>(`/workspaces/${input.workspaceId}/groups`, {
      method: "POST",
      headers: { "Idempotency-Key": createIdempotencyKey() },
      body: JSON.stringify({ name: input.name, color: input.color }),
    });
    return normalizeGroup(data);
  },

  async deleteGroup(input: { workspaceId: string; groupId: string }): Promise<{ id: string }> {
    return request<{ id: string }>(`/workspaces/${input.workspaceId}/groups/${input.groupId}`, {
      method: "DELETE",
    });
  },

  async listNotes(
    workspaceId: string,
    groupId?: string | null,
    query?: string,
    pagination?: PaginationParams,
    isDeleted?: boolean,
  ): Promise<Note[]> {
    const params = new URLSearchParams();
    if (groupId) params.set('groupId', groupId);
    if (query) params.set('query', query);
    if (isDeleted) params.set('isDeleted', 'true');
    appendPagination(params, pagination);
    const queryString = params.toString();
    const url = queryString
      ? `/workspaces/${workspaceId}/notes?${queryString}`
      : `/workspaces/${workspaceId}/notes`;
    const data = await request<NoteResponse[]>(url);
    return data.map(normalizeNote);
  },

  async listTrashNotes(workspaceId: string): Promise<Note[]> {
    const data = await request<NoteResponse[]>(`/workspaces/${workspaceId}/trash`);
    return data.map(normalizeNote);
  },

  async createNote(input: {
    workspaceId: string;
    groupId: string;
    title?: string;
    body?: string;
    tags?: string[];
  }): Promise<Note> {
    const data = await request<NoteResponse>(`/workspaces/${input.workspaceId}/notes`, {
      method: "POST",
      headers: { "Idempotency-Key": createIdempotencyKey() },
      body: JSON.stringify({
        groupId: input.groupId,
        title: input.title ?? "",
        body: input.body ?? "",
        tags: input.tags ?? [],
      }),
    });
    return normalizeNote(data);
  },

  async updateNote(note: Note): Promise<Note> {
    const data = await request<NoteResponse>(`/notes/${note.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: note.title,
        body: note.body,
        tags: note.tags,
        isPinned: note.isPinned,
        groupId: note.groupId,
      }),
    });
    return normalizeNote(data);
  },

  async togglePin(noteId: string): Promise<Note> {
    const data = await request<NoteResponse>(`/notes/${noteId}/toggle-pin`, {
      method: "POST",
    });
    return normalizeNote(data);
  },

  async deleteNote(noteId: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/notes/${noteId}`, {
      method: "DELETE",
    });
  },

  async deleteNotePermanently(noteId: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/notes/${noteId}/permanent`, {
      method: "DELETE",
    });
  },

  async restoreNote(noteId: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/notes/${noteId}/restore`, {
      method: "POST",
    });
  },

  async listNoteVersions(noteId: string): Promise<NoteVersion[]> {
    const data = await request<NoteVersionResponse[]>(`/notes/${noteId}/versions`);
    return data.map(normalizeVersion);
  },

  async getNote(noteId: string): Promise<Note> {
    const data = await request<NoteResponse>(`/notes/${noteId}`);
    return normalizeNote(data);
  },

  async getNoteVersion(noteId: string, versionId: string): Promise<NoteVersionDetail> {
    const data = await request<NoteVersionDetailResponse>(`/notes/${noteId}/versions/${versionId}`);
    return normalizeVersionDetail(data);
  },

  async restoreNoteVersion(noteId: string, versionId: string): Promise<Note> {
    const data = await request<NoteResponse>(`/notes/${noteId}/versions/${versionId}/restore`, {
      method: "POST",
    });
    return normalizeNote(data);
  },

  async listNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
    const data = await request<NoteAttachmentResponse[]>(`/notes/${noteId}/attachments`);
    return data.map(normalizeAttachment);
  },

  async createNoteAttachment(
    noteId: string,
    input: { name: string; url: string; size?: number; contentType?: string },
  ): Promise<NoteAttachment> {
    const data = await request<NoteAttachmentResponse>(`/notes/${noteId}/attachments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    return normalizeAttachment(data);
  },

  async deleteNoteAttachment(noteId: string, attachmentId: string): Promise<{ id: string }> {
    return request<{ id: string }>(`/notes/${noteId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
  },

  async publishNote(noteId: string, isPublic: boolean): Promise<Note> {
    const data = await request<NoteResponse>(`/notes/${noteId}/public`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic }),
    });
    return normalizeNote(data);
  },

  async getPublicNote(slug: string): Promise<PublicNote> {
    const data = await request<PublicNoteResponse>(`/public/notes/${slug}`);
    return normalizePublicNote(data);
  },

  async createUpgradeIntent(input: { plan: PlanTier; source?: string }): Promise<UpgradeIntentResponse> {
    return request<UpgradeIntentResponse>("/upgrade-intents", {
      method: "POST",
      body: JSON.stringify({ plan: input.plan, source: input.source }),
    });
  },

  async listAdminUsers(): Promise<AdminUser[]> {
    const data = await request<AdminUserResponse[]>("/admin/users");
    return data.map(normalizeAdminUser);
  },

  async updateAdminUserPlan(userId: string, plan: PlanTier): Promise<AdminUser> {
    const data = await request<AdminUserResponse>(`/admin/users/${userId}/plan`, {
      method: "PATCH",
      body: JSON.stringify({ plan }),
    });
    return normalizeAdminUser(data);
  },

  async listChatMessages(workspaceId: string, pagination?: PaginationParams): Promise<ChatMessage[]> {
    const params = new URLSearchParams();
    appendPagination(params, pagination);
    const url = params.toString()
      ? `/workspaces/${workspaceId}/chat/messages?${params.toString()}`
      : `/workspaces/${workspaceId}/chat/messages`;
    const data = await request<ChatMessageResponse[]>(url);
    return data.map(normalizeChatMessage);
  },

  async createChatMessage(input: {
    workspaceId: string;
    body?: string;
    messageType?: "text" | "image" | "audio";
    attachments?: Array<{
      filePath: string;
      fileName?: string | null;
      contentType?: string | null;
      size?: number | null;
    }>;
    mentions?: Array<{
      userId: string;
      text?: string | null;
      startIndex?: number | null;
      endIndex?: number | null;
    }>;
  }): Promise<ChatMessage> {
    const data = await request<ChatMessageResponse>(`/workspaces/${input.workspaceId}/chat/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: input.body,
        messageType: input.messageType ?? "text",
        attachments: input.attachments ?? [],
        mentions: input.mentions ?? [],
      }),
    });
    return normalizeChatMessage(data);
  },

  async updateChatMessage(input: {
    workspaceId: string;
    messageId: string;
    body: string;
    mentions?: Array<{
      userId: string;
      text?: string | null;
      startIndex?: number | null;
      endIndex?: number | null;
    }>;
  }): Promise<ChatMessage> {
    const data = await request<ChatMessageResponse>(
      `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          body: input.body,
          mentions: input.mentions ?? [],
        }),
      },
    );
    return normalizeChatMessage(data);
  },

  async deleteChatMessage(input: { workspaceId: string; messageId: string }): Promise<ChatMessage> {
    const data = await request<ChatMessageResponse>(
      `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}`,
      {
        method: "DELETE",
      },
    );
    return normalizeChatMessage(data);
  },

  async createChatReaction(input: {
    workspaceId: string;
    messageId: string;
    emoji: string;
  }): Promise<ChatReaction> {
    const data = await request<ChatReactionResponse>(
      `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ emoji: input.emoji }),
      },
    );
    return normalizeChatReaction(data);
  },

  async deleteChatReaction(input: {
    workspaceId: string;
    messageId: string;
    emoji: string;
  }): Promise<{ id: string }> {
    return request<{ id: string }>(
      `/workspaces/${input.workspaceId}/chat/messages/${input.messageId}/reactions/${encodeURIComponent(input.emoji)}`,
      {
        method: "DELETE",
      },
    );
  },

  async markChatMentionsRead(workspaceId: string): Promise<{ updated: number }> {
    return request<{ updated: number }>(`/workspaces/${workspaceId}/chat/mentions/read`, {
      method: "POST",
    });
  },

  async createChatUpload(input: {
    workspaceId: string;
    fileName: string;
    contentType: string;
    size?: number;
  }): Promise<ChatUploadResponse> {
    return request<ChatUploadResponse>(`/workspaces/${input.workspaceId}/chat/uploads`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getChatUnreadCounts(workspaceId: string, since: string): Promise<ChatUnreadResponse> {
    const params = new URLSearchParams({ since });
    return request<ChatUnreadResponse>(`/workspaces/${workspaceId}/chat/unread?${params.toString()}`);
  },

  async listChatMentions(
    workspaceId: string,
    status: "unread" | "all" = "unread",
  ): Promise<ChatMentionNotification[]> {
    const params = new URLSearchParams({ status });
    const data = await request<ChatMentionNotificationResponse[]>(
      `/workspaces/${workspaceId}/chat/mentions?${params.toString()}`,
    );
    return data.map(normalizeChatMentionNotification);
  },

  async listChatAudits(workspaceId: string): Promise<ChatAudit[]> {
    const data = await request<ChatAuditResponse[]>(`/workspaces/${workspaceId}/chat/audits`);
    return data.map(normalizeChatAudit);
  },
};
