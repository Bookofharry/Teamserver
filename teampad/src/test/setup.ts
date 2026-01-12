import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  isSupabaseConfigured: true,
}));

vi.mock("@/api", () => {
  const now = new Date();
  const user = {
    id: "user-1",
    name: "Alex",
    email: "alex@teampad.io",
    avatar: undefined,
    twoFactorEnabled: false,
    isSubscribed: false,
    plan: "free",
  };
  const workspace = {
    id: "workspace-1",
    name: "TeamPad",
    members: [],
    createdAt: now,
  };
  const member = {
    id: "member-1",
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
    joinedAt: now,
    user,
  };
  const group = {
    id: "group-1",
    name: "Marketing",
    workspaceId: workspace.id,
    noteCount: 1,
    color: "#0EA5E9",
  };
  const note = {
    id: "note-1",
    title: "Launch plan",
    body: "Ship the new landing page.",
    groupId: group.id,
    workspaceId: workspace.id,
    createdAt: now,
    updatedAt: now,
    updatedBy: user,
    isPinned: false,
    tags: [],
  };
  const invite = {
    id: "invite-1",
    workspaceId: workspace.id,
    email: "guest@teampad.io",
    role: "member",
    token: "invite-token",
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  };

  return {
    api: {
      getMe: vi.fn().mockResolvedValue(user),
      requestSignupOtp: vi.fn().mockResolvedValue({ sent: true }),
      verifySignupOtp: vi.fn().mockResolvedValue({ userId: user.id, email: user.email }),
      login: vi.fn().mockResolvedValue({ userId: user.id, email: user.email }),
      clearSession: vi.fn().mockResolvedValue(undefined),
      forgotPassword: vi.fn().mockResolvedValue({ sent: true }),
      resetPassword: vi.fn().mockResolvedValue({ updated: true }),
      checkEmailExists: vi.fn().mockResolvedValue(false),
      updateMe: vi.fn().mockResolvedValue(user),
      listWorkspaces: vi.fn().mockResolvedValue([workspace]),
      createWorkspace: vi.fn().mockResolvedValue(workspace),
      updateWorkspace: vi.fn().mockResolvedValue(workspace),
      deleteWorkspace: vi.fn().mockResolvedValue({ id: workspace.id }),
      listGroups: vi.fn().mockResolvedValue([group]),
      createGroup: vi.fn().mockResolvedValue(group),
      deleteGroup: vi.fn().mockResolvedValue({ id: group.id }),
      listNotes: vi.fn().mockResolvedValue([note]),
      createNote: vi.fn().mockResolvedValue(note),
      updateNote: vi.fn().mockResolvedValue(note),
      togglePin: vi.fn().mockResolvedValue({ ...note, isPinned: true }),
      deleteNote: vi.fn().mockResolvedValue({ id: note.id }),
      publishNote: vi.fn().mockResolvedValue({ ...note, isPublic: true, publicSlug: "public-note" }),
      listWorkspaceMembers: vi.fn().mockResolvedValue([member]),
      listWorkspaceInvites: vi.fn().mockResolvedValue([]),
      listMyInvites: vi.fn().mockResolvedValue([]),
      createInvite: vi.fn().mockResolvedValue(invite),
      acceptInvite: vi.fn().mockResolvedValue({ workspaceId: workspace.id, member }),
      declineInvite: vi.fn().mockResolvedValue({ workspaceId: workspace.id, email: invite.email }),
      getInviteDetails: vi.fn().mockResolvedValue({
        ...invite,
        workspaceName: workspace.name,
        inviter: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
      }),
      createUpgradeIntent: vi.fn().mockResolvedValue({ id: "upgrade-1", plan: "premium", status: "pending" }),
    },
  };
});

vi.mock("@/lib/ablyChat", () => ({
  getAblyKey: () => undefined,
  getAblyAuthUrl: () => "",
  isAblyChatEnabled: () => false,
  getChatClient: () => null,
  getRealtimeClient: () => null,
  getWorkspaceRoomName: (workspaceId: string) => `workspace:${workspaceId}`,
  subscribeToChatRoomMessages: vi.fn().mockResolvedValue(null),
  publishChatEvent: vi.fn().mockResolvedValue(false),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserver;
