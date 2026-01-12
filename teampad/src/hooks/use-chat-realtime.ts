import { useEffect, useState } from "react";
import type Ably from "ably";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, ChatReaction } from "@/types";
import {
  getAblyAuthUrl,
  getAblyKey,
  getChatClient,
  getWorkspaceRoomName,
  subscribeToChatRoomMessages,
} from "@/lib/ablyChat";

const getAuthUrl = () => getAblyAuthUrl();

export const useChatRealtime = (
  workspaceId: string | null,
  enabled = true,
  retryToken = 0,
  currentUserId?: string,
) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"connected" | "connecting" | "unavailable">("unavailable");

  useEffect(() => {
    const ablyKey = getAblyKey();
    const authUrl = getAuthUrl();
    if (!workspaceId || !enabled || (!ablyKey && !authUrl)) {
      setStatus("unavailable");
      return;
    }
    setStatus("connecting");

    const normalizeDate = (value?: string | Date | null) =>
      value ? (value instanceof Date ? value : new Date(value)) : null;

    const normalizeMessage = (message: ChatMessage): ChatMessage => ({
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

    const normalizeReaction = (reaction: ChatReaction): ChatReaction => ({
      ...reaction,
      createdAt: normalizeDate(reaction.createdAt) ?? new Date(),
    });

    const handleMessageCreated = (message: { message: ChatMessage }) => {
      const chatMessage = normalizeMessage(message.message);
      if (chatMessage.messageType === "system" && chatMessage.sender?.id === currentUserId) {
        return;
      }
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) => {
          if (existing.some((item) => item.id === chatMessage.id)) return existing;
          return [chatMessage, ...existing];
        },
      );
    };

    const handleReactionCreated = (message: { reaction: ChatReaction }) => {
      const reaction = normalizeReaction(message.reaction);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) =>
          existing.map((item) =>
            item.id === reaction.messageId
              ? { ...item, reactions: [...item.reactions, reaction] }
              : item,
          ),
      );
    };

    const handleReactionDeleted = (message: { reaction: { id: string; messageId: string } }) => {
      const reaction = message.reaction;
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) =>
          existing.map((item) =>
            item.id === reaction.messageId
              ? { ...item, reactions: item.reactions.filter((r) => r.id !== reaction.id) }
              : item,
          ),
      );
    };

    const handleMessageUpdated = (message: { message: ChatMessage }) => {
      const updated = normalizeMessage(message.message);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) => existing.map((item) => (item.id === updated.id ? updated : item)),
      );
    };

    const handleMessageDeleted = (message: { message: ChatMessage }) => {
      const deleted = normalizeMessage(message.message);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) => existing.map((item) => (item.id === deleted.id ? deleted : item)),
      );
    };

    const chatClient = getChatClient();
    if (!chatClient) {
      setStatus("unavailable");
      return;
    }
    const roomName = getWorkspaceRoomName(workspaceId);
    let unsubscribeRoom: (() => void) | null = null;
    const handleConnection = (change: Ably.ConnectionStateChange) => {
      if (change.current === "connected") {
        setStatus("connected");
      } else if (change.current === "connecting") {
        setStatus("connecting");
      } else {
        setStatus("unavailable");
      }
    };
    chatClient.connection.on(handleConnection);

    const handleChatMessage = (event: Ably.Message) => {
      const data = event?.data;
      const metadata = event?.extras?.metadata as
        | { type?: string; message?: ChatMessage; reaction?: ChatReaction }
        | string
        | undefined;
      let payload: { type?: string; message?: ChatMessage; reaction?: ChatReaction } | undefined;
      if (data) {
        if (typeof data === "string") {
          try {
            payload = JSON.parse(data);
          } catch {
            payload = undefined;
          }
        } else if (typeof data === "object") {
          // Ably Chat sometimes sends { text: "message.created", metadata: { message: {...} } }
          const maybeTyped = data as { text?: string; metadata?: unknown };
          if (maybeTyped.text) {
            payload = {
              type: maybeTyped.text,
              ...(maybeTyped.metadata as
                | { message?: ChatMessage; reaction?: ChatReaction }
                | undefined),
            };
          } else {
            payload = data as typeof payload;
          }
        }
      }
      if (!payload && metadata) {
        if (typeof metadata === "string") {
          try {
            payload = JSON.parse(metadata);
          } catch {
            payload = undefined;
          }
        } else {
          payload = metadata;
        }
      }
      if (!payload) return;
      if (!payload?.type) return;
      if (payload.type === "message.created" && payload.message) {
        handleMessageCreated({ message: payload.message });
      } else if (payload.type === "message.updated" && payload.message) {
        handleMessageUpdated({ message: payload.message });
      } else if (payload.type === "message.deleted" && payload.message) {
        handleMessageDeleted({ message: payload.message });
      } else if (payload.type === "reaction.created" && payload.reaction) {
        handleReactionCreated({ reaction: payload.reaction });
      } else if (payload.type === "reaction.deleted" && payload.reaction) {
        handleReactionDeleted({ reaction: payload.reaction });
      }
    };

    let active = true;
    void (async () => {
      try {
        const unsubscribe = await subscribeToChatRoomMessages(roomName, handleChatMessage);
        if (!active) {
          if (unsubscribe) unsubscribe();
          return;
        }
        if (!unsubscribe) return;
        unsubscribeRoom = unsubscribe;
      } catch {
        if (active) setStatus("unavailable");
      }
    })();

    return () => {
      active = false;
      if (unsubscribeRoom) unsubscribeRoom();
      chatClient.connection.off(handleConnection);
      setStatus("unavailable");
    };
  }, [workspaceId, enabled, queryClient, retryToken, currentUserId]);

  return { status };
};
