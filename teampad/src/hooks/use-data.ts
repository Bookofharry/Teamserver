import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useEffect } from "react";
import { api } from "@/api";
import { getWorkspaceRoomName, isAblyChatEnabled, publishChatEvent } from "@/lib/ablyChat";
import type { AdminUser, ChatAudit, ChatMentionNotification, ChatMessage, ChatReaction, Group, InviteDetails, Note, NoteAttachment, NoteVersion, NoteVersionDetail, NoteVersionsPage, PlanTier, User, UserRole, Workspace, WorkspaceInvite, WorkspaceMember } from "@/types";

const normalizeDate = (value?: string | Date | null) =>
  value ? (value instanceof Date ? value : new Date(value)) : null;

const normalizeChatMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  createdAt: normalizeDate(message.createdAt) ?? new Date(),
  editedAt: normalizeDate(message.editedAt),
  deletedAt: normalizeDate(message.deletedAt),
  attachments: (message.attachments || []).map((attachment) => ({
    ...attachment,
    createdAt: normalizeDate(attachment.createdAt) ?? new Date(),
  })),
  reactions: (message.reactions || []).map((reaction) => ({
    ...reaction,
    createdAt: normalizeDate(reaction.createdAt) ?? new Date(),
  })),
  mentions: (message.mentions || []).map((mention) => ({
    ...mention,
    createdAt: normalizeDate(mention.createdAt) ?? new Date(),
  })),
});

const normalizeChatReaction = (reaction: ChatReaction): ChatReaction => ({
  ...reaction,
  createdAt: normalizeDate(reaction.createdAt) ?? new Date(),
});

const publishChatEventSafe = (workspaceId: string, payload: Record<string, unknown>) => {
  if (!isAblyChatEnabled()) return;
  const serialized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  void publishChatEvent(getWorkspaceRoomName(workspaceId), serialized).catch(() => null);
};

export const useMe = (enabled = true) =>
  useQuery<User>({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled,
  });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name?: string;
      avatar?: string;
      lastWorkspaceId?: string | null;
      status?: string | null;
      statusEmoji?: string | null;
      hasSeenOnboarding?: boolean;
    }) => api.updateMe(input),
    onSuccess: (user) => {
      queryClient.setQueryData<User>(["me"], user);
    },
  });
};

export const useCreateUpgradeIntent = () =>
  useMutation({
    mutationFn: (input: { plan: PlanTier; source?: string }) => api.createUpgradeIntent(input),
  });

export const useAdminUsers = (enabled = true) =>
  useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api.listAdminUsers(),
    enabled,
  });

export const useUpdateAdminUserPlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; plan: PlanTier }) =>
      api.updateAdminUserPlan(input.userId, input.plan),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["admin-users"] });
      const previous = queryClient.getQueryData<AdminUser[]>(["admin-users"]);
      queryClient.setQueryData<AdminUser[]>(
        ["admin-users"],
        (existing = []) =>
          existing.map((user) =>
            user.id === input.userId ? { ...user, plan: input.plan } : user,
          ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-users"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
};

export const useWorkspaces = (enabled = true) =>
  useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.listWorkspaces(),
    enabled,

    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useWorkspaceMembers = (workspaceId: string | null, enabled = true) =>
  useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => api.listWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId && enabled),
  });

export const useWorkspaceInvites = (workspaceId: string | null, enabled = true) =>
  useQuery<WorkspaceInvite[]>({
    queryKey: ["workspace-invites", workspaceId],
    queryFn: () => api.listWorkspaceInvites(workspaceId as string),
    enabled: Boolean(workspaceId && enabled),
  });

export const useMyInvites = (enabled = true) =>
  useQuery<InviteDetails[]>({
    queryKey: ["my-invites"],
    queryFn: () => api.listMyInvites(),
    enabled,
  });

export const useAcceptInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.acceptInvite(token),
    onSuccess: (_, token) => {
      queryClient.setQueryData<InviteDetails[]>(
        ["my-invites"],
        (existing = []) => existing.filter((invite) => invite.token !== token),
      );
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
};

export const useDeclineInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.declineInvite(token),
    onSuccess: (_, token) => {
      queryClient.setQueryData<InviteDetails[]>(
        ["my-invites"],
        (existing = []) => existing.filter((invite) => invite.token !== token),
      );
    },
  });
};

export const useCreateInvite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; email: string; role?: UserRole }) =>
      api.createInvite(input),
    onSuccess: (invite, variables) => {
      queryClient.setQueryData<WorkspaceInvite[]>(
        ["workspace-invites", variables.workspaceId],
        (existing = []) => [invite, ...existing],
      );
    },
  });
};

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; userId: string }) => api.removeWorkspaceMember(input),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<WorkspaceMember[]>(
        ["workspace-members", variables.workspaceId],
        (existing = []) => existing.filter((member) => member.userId !== variables.userId),
      );
    },
  });
};

export const useLeaveWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => api.leaveWorkspace(workspaceId),
    onSuccess: (_, workspaceId) => {
      queryClient.setQueryData<Workspace[]>(
        ["workspaces"],
        (existing = []) => existing.filter((w) => w.id !== workspaceId),
      );
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createWorkspace,
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(
        ["workspaces"],
        (existing = []) => [...existing, workspace],
      );
    },
  });
};

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; name: string }) => api.updateWorkspace(input),
    onSuccess: (workspace) => {
      queryClient.setQueryData<Workspace[]>(
        ["workspaces"],
        (existing = []) =>
          existing.map((item) => (item.id === workspace.id ? { ...item, name: workspace.name } : item)),
      );
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => api.deleteWorkspace(workspaceId),
    onSuccess: (_, workspaceId) => {
      queryClient.setQueryData<Workspace[]>(
        ["workspaces"],
        (existing = []) => existing.filter((item) => item.id !== workspaceId),
      );
      queryClient.removeQueries({ queryKey: ["groups", workspaceId] });
      queryClient.removeQueries({ queryKey: ["notes", workspaceId] });
    },
  });
};

export const useGroups = (workspaceId: string | null) =>
  useQuery<Group[]>({
    queryKey: ["groups", workspaceId],
    queryFn: () => api.listGroups(workspaceId as string),
    enabled: Boolean(workspaceId),

    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createGroup,
    onSuccess: (group) => {
      queryClient.setQueryData<Group[]>(
        ["groups", group.workspaceId],
        (existing = []) => [...existing, group],
      );
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; groupId: string }) => api.deleteGroup(input),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<Group[]>(
        ["groups", variables.workspaceId],
        (existing = []) => existing.filter((group) => group.id !== variables.groupId),
      );
      queryClient.invalidateQueries({ queryKey: ["notes", variables.workspaceId] });
    },
  });
};

export const usePublishNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteId: string; workspaceId: string; isPublic: boolean }) =>
      api.publishNote(input.noteId, input.isPublic),
    onSuccess: (note, variables) => {
      queryClient.setQueryData<Note[]>(
        ["notes", variables.workspaceId, note.groupId, ""],
        (existing = []) => existing.map((item) => (item.id === note.id ? note : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["notes", variables.workspaceId] });
    },
  });
};

export const useNotes = (
  workspaceId: string | null,
  groupId: string | null,
  query?: string,
  pagination?: { limit?: number; offset?: number },
) =>
  useQuery<Note[]>({
    queryKey: ["notes", workspaceId, groupId, query ?? "", pagination?.limit ?? null, pagination?.offset ?? null],
    queryFn: () =>
      api.listNotes(workspaceId as string, query ? null : (groupId as string), query, pagination),
    enabled: Boolean(workspaceId && (query || groupId)),

    refetchOnWindowFocus: false,
  });

export const useTrashNotes = (workspaceId: string | null) =>
  useQuery<Note[]>({
    queryKey: ['trash', workspaceId],
    queryFn: () => api.listTrashNotes(workspaceId as string),
    enabled: Boolean(workspaceId),
  });

export const useWorkspaceNotes = (workspaceId: string | null, limit = 200, enabled = true) =>
  useQuery<Note[]>({
    queryKey: ["notes", workspaceId, "all", limit],
    queryFn: () => api.listNotes(workspaceId as string, null, undefined, { limit }),
    enabled: Boolean(workspaceId) && enabled,
  });

export const useNote = (noteId: string | null, workspaceId: string | null, enabled = true) => {
  const queryClient = useQueryClient();
  const query = useQuery<Note>({
    queryKey: ["note", workspaceId, noteId],
    queryFn: () => api.getNote(noteId as string),
    enabled: Boolean(noteId && workspaceId && enabled),


  });

  const data = query.data;
  useEffect(() => {
    if (data) {
      queryClient.setQueriesData<Note[]>(
        { queryKey: ["notes", data.workspaceId] },
        (existing) =>
          existing
            ? existing.map((item) => (item.id === data.id ? { ...item, ...data } : item))
            : existing,
      );
    }
  }, [data, queryClient]);

  return query;
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createNote,
    onSuccess: (note) => {
      queryClient.setQueryData<Note[]>(
        ["notes", note.workspaceId, note.groupId, ""],
        (existing = []) => [note, ...existing],
      );
      queryClient.invalidateQueries({ queryKey: ["notes", note.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["groups", note.workspaceId] });
    },
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateNote,
    onMutate: async (note) => {
      await queryClient.cancelQueries({ queryKey: ["notes", note.workspaceId] });
      const previousNotes = queryClient.getQueriesData<Note[]>({
        queryKey: ["notes", note.workspaceId],
      });
      queryClient.setQueriesData<Note[]>(
        { queryKey: ["notes", note.workspaceId] },
        (existing) =>
          existing
            ? existing.map((item) => (item.id === note.id ? { ...item, ...note } : item))
            : existing,
      );
      return { previousNotes };
    },
    onError: (_error, note, context) => {
      context?.previousNotes?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (note) => {
      queryClient.setQueryData<Note[]>(
        ["notes", note.workspaceId, note.groupId, ""],
        (existing = []) => existing.map((item) => (item.id === note.id ? note : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["notes", note.workspaceId] });
    },
  });
};

export const useTogglePin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.togglePin,
    onSuccess: (note) => {
      queryClient.setQueryData<Note[]>(
        ["notes", note.workspaceId, note.groupId, ""],
        (existing = []) => existing.map((item) => (item.id === note.id ? note : item)),
      );
      queryClient.invalidateQueries({ queryKey: ["notes", note.workspaceId] });
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteId: string; workspaceId: string; groupId: string }) =>
      api.deleteNote(input.noteId),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<Note[]>(
        ["notes", variables.workspaceId, variables.groupId, ""],
        (existing = []) => existing.filter((item) => item.id !== variables.noteId),
      );
      queryClient.invalidateQueries({ queryKey: ["notes", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["groups", variables.workspaceId] });
    },
  });
};

export const useRestoreNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api.restoreNote(noteId),
    onSuccess: (_, noteId) => {
      // Find the note to get its metadata for efficient invalidation
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey: ["notes"] });
      let note: Note | undefined;

      for (const [_, notes] of previousNotes) {
        const found = notes?.find(n => n.id === noteId);
        if (found) {
          note = found;
          break;
        }
      }

      queryClient.setQueryData<Note[]>(
        ["notes", note?.workspaceId, note?.groupId, ""],
        (existing = []) => {
          // Invalidate the cache by removing it from the trash view
          return existing.filter(n => n.id !== noteId);
        }
      );

      if (note) {
        queryClient.invalidateQueries({ queryKey: ["notes", note.workspaceId], exact: false });
        queryClient.invalidateQueries({ queryKey: ["groups", note.workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["trash", note.workspaceId] });
      } else {
        // Fallback invalidation
        queryClient.invalidateQueries({ queryKey: ["notes"] });
        queryClient.invalidateQueries({ queryKey: ["groups"] });
        queryClient.invalidateQueries({ queryKey: ["trash"] });
      }
    },
  });
};

export const useNoteVersions = (noteId: string | null, enabled = true) =>
  useQuery<NoteVersion[]>({
    queryKey: ["note-versions", noteId],
    queryFn: () => api.listNoteVersions(noteId as string),
    enabled: Boolean(noteId && enabled),
  });

export const useNoteVersionDetail = (
  noteId: string | null,
  versionId: string | null,
  enabled = true,
) =>
  useQuery<NoteVersionDetail>({
    queryKey: ["note-version", noteId, versionId],
    queryFn: () => api.getNoteVersion(noteId as string, versionId as string),
    enabled: Boolean(noteId && versionId && enabled),
  });

export const useRestoreNoteVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteId: string; versionId: string }) =>
      api.restoreNoteVersion(input.noteId, input.versionId),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes", note.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["note-versions", note.id] });
    },
  });
};

export const useNoteAttachments = (noteId: string | null, enabled = true) =>
  useQuery<NoteAttachment[]>({
    queryKey: ["note-attachments", noteId],
    queryFn: () => api.listNoteAttachments(noteId as string),
    enabled: Boolean(noteId && enabled),
  });

export const useCreateNoteAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteId: string; attachment: { name: string; url: string; size?: number; contentType?: string } }) =>
      api.createNoteAttachment(input.noteId, input.attachment),
    onSuccess: (attachment) => {
      queryClient.setQueryData<NoteAttachment[]>(
        ["note-attachments", attachment.noteId],
        (existing = []) => [attachment, ...existing],
      );
    },
  });
};

export const useDeleteNoteAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { noteId: string; attachmentId: string }) =>
      api.deleteNoteAttachment(input.noteId, input.attachmentId),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<NoteAttachment[]>(
        ["note-attachments", variables.noteId],
        (existing = []) => existing.filter((item) => item.id !== variables.attachmentId),
      );
    },
  });
};

export const useChatMessages = (
  workspaceId: string | null,
  enabled = true,
  pagination: { limit?: number; offset?: number } = {},
) =>
  useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", workspaceId, pagination.limit ?? 60, pagination.offset ?? 0],
    queryFn: () =>
      api.listChatMessages(workspaceId as string, {
        limit: pagination.limit ?? 60,
        offset: pagination.offset ?? 0,
      }).then((messages) => messages.map(normalizeChatMessage)),
    enabled: Boolean(workspaceId && enabled),

  });

export const useChatUnreadCounts = (
  workspaceId: string | null,
  since: Date,
  enabled = true,
  refetchIntervalMs = 15000,
) =>
  useQuery<{ unreadCount: number; mentionCount: number; since: string }>({
    queryKey: ["chat-unread", workspaceId, since.toISOString()],
    queryFn: () => api.getChatUnreadCounts(workspaceId as string, since.toISOString()),
    enabled: Boolean(workspaceId && enabled),
    refetchInterval: enabled ? refetchIntervalMs : false,
  });

export const useChatMentions = (
  workspaceId: string | null,
  enabled = true,
  status: "unread" | "all" = "unread",
) =>
  useQuery<ChatMentionNotification[]>({
    queryKey: ["chat-mentions", workspaceId, status],
    queryFn: () => api.listChatMentions(workspaceId as string, status),
    enabled: Boolean(workspaceId && enabled),
  });

export const useChatAudits = (workspaceId: string | null, enabled = true) =>
  useQuery<ChatAudit[]>({
    queryKey: ["chat-audits", workspaceId],
    queryFn: () => api.listChatAudits(workspaceId as string),
    enabled: Boolean(workspaceId && enabled),
  });

export const useCreateChatMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workspaceId: string;
      body?: string;
      messageType?: "text" | "image" | "audio";
      attachments?: Array<{ filePath: string; fileName?: string | null; contentType?: string | null; size?: number | null }>;
      mentions?: Array<{ userId: string; text?: string | null; startIndex?: number | null; endIndex?: number | null }>;
      optimisticSender?: User;
    }) => {
      const { optimisticSender, ...payload } = input;
      return api.createChatMessage(payload);
    },
    onMutate: async (input) => {
      const {
        workspaceId,
        body,
        messageType = "text",
        attachments = [],
        mentions = [],
        optimisticSender,
      } = input;
      if (!optimisticSender) return undefined;

      await queryClient.cancelQueries({ queryKey: ["chat-messages", workspaceId], exact: false });
      const previous = queryClient.getQueriesData<ChatMessage[]>({
        queryKey: ["chat-messages", workspaceId],
        exact: false,
      });
      const tempId = `temp-${Date.now()}`;
      const now = new Date();
      const optimistic: ChatMessage = {
        id: tempId,
        workspaceId,
        body: body ?? "",
        messageType,
        createdAt: now,
        editedAt: null,
        deletedAt: null,
        sender: optimisticSender,
        attachments: attachments.map((attachment, index) => ({
          id: `${tempId}-att-${index}`,
          messageId: tempId,
          filePath: attachment.filePath,
          url: null,
          fileName: attachment.fileName ?? null,
          contentType: attachment.contentType ?? null,
          size: attachment.size ?? null,
          createdAt: now,
          uploadedBy: optimisticSender,
        })),
        reactions: [],
        mentions: mentions.map((mention, index) => ({
          id: `${tempId}-mention-${index}`,
          messageId: tempId,
          mentionedUserId: mention.userId,
          mentionText: mention.text ?? null,
          startIndex: mention.startIndex ?? null,
          endIndex: mention.endIndex ?? null,
          createdAt: now,
        })),
      };

      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId], exact: false },
        (existing = []) => [optimistic, ...existing],
      );
      return { previous, tempId, workspaceId };
    },
    onError: (_error, _input, context) => {
      if (!context?.previous) return;
      context.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (message, variables, context) => {
      const normalized = normalizeChatMessage(message);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", message.workspaceId], exact: false },
        (existing = []) => {
          if (!context?.tempId) return [normalized, ...existing];
          const replaced = existing.map((item) => (item.id === context.tempId ? normalized : item));
          if (replaced.some((item) => item.id === normalized.id)) {
            return replaced;
          }
          return [normalized, ...replaced];
        },
      );
      publishChatEventSafe(message.workspaceId, { type: "message.created", message: normalized });
    },
  });
};

export const useUpdateChatMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      workspaceId: string;
      messageId: string;
      body: string;
      mentions?: Array<{ userId: string; text?: string | null; startIndex?: number | null; endIndex?: number | null }>;
    }) => api.updateChatMessage(input),
    onSuccess: (message, variables) => {
      const normalized = normalizeChatMessage(message);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", variables.workspaceId] },
        (existing = []) =>
          existing.map((item) => (item.id === variables.messageId ? normalized : item)),
      );
      publishChatEventSafe(variables.workspaceId, { type: "message.updated", message: normalized });
    },
  });
};

export const useDeleteChatMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; messageId: string }) => api.deleteChatMessage(input),
    onSuccess: (message, variables) => {
      const normalized = normalizeChatMessage(message);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", variables.workspaceId] },
        (existing = []) =>
          existing.map((item) => (item.id === variables.messageId ? normalized : item)),
      );
      publishChatEventSafe(variables.workspaceId, { type: "message.deleted", message: normalized });
    },
  });
};

export const useCreateChatReaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; messageId: string; emoji: string }) =>
      api.createChatReaction(input),
    onSuccess: (reaction, variables) => {
      const normalized = normalizeChatReaction(reaction);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", variables.workspaceId] },
        (existing = []) =>
          existing.map((message) =>
            message.id === variables.messageId
              ? { ...message, reactions: [...message.reactions, normalized] }
              : message,
          ),
      );
      publishChatEventSafe(variables.workspaceId, { type: "reaction.created", reaction: normalized });
    },
  });
};

export const useMarkChatMentionsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => api.markChatMentionsRead(workspaceId),
    onSuccess: (_data, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ["chat-unread", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["chat-mentions", workspaceId] });
    },
  });
};

export const useDeleteChatReaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; messageId: string; emoji: string; userId: string }) =>
      api.deleteChatReaction({ workspaceId: input.workspaceId, messageId: input.messageId, emoji: input.emoji }),
    onSuccess: (_result, variables) => {
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", variables.workspaceId] },
        (existing = []) =>
          existing.map((message) =>
            message.id === variables.messageId
              ? {
                ...message,
                reactions: message.reactions.filter(
                  (reaction: ChatReaction) =>
                    !(reaction.userId === variables.userId && reaction.emoji === variables.emoji),
                ),
              }
              : message,
          ),
      );
      publishChatEventSafe(variables.workspaceId, {
        type: "reaction.deleted",
        reaction: { id: _result.id, messageId: variables.messageId },
      });
    },
  });
};

export const useDeleteNotePermanently = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ noteId }: { noteId: string }) => api.deleteNotePermanently(noteId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      toast({
        title: "Note permanently deleted",
        description: "This note has been removed forever.",
      });
    },
    onError: (error: Error | { message: string }) => {
      toast({
        variant: "destructive",
        title: "Failed to delete note",
        description: error.message || "Something went wrong",
      });
    },
  });
};
