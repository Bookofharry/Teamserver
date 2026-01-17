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
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; avatar?: string; timestamp: number }>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let hasChanges = false;
        const next = { ...prev };
        Object.keys(next).forEach((userId) => {
          if (now - next[userId].timestamp > 3000) {
            delete next[userId];
            hasChanges = true;
          }
        });
        return hasChanges ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTyping = (message: { userId: string; name: string; avatar?: string }) => {
    if (message.userId === currentUserId) return;
    setTypingUsers((prev) => ({
      ...prev,
      [message.userId]: {
        name: message.name,
        avatar: message.avatar,
        timestamp: Date.now(),
      },
    }));
  };

  const sendTyping = async (name: string, avatar?: string) => {
    if (!workspaceId || !currentUserId) return;
    const roomName = getWorkspaceRoomName(workspaceId);
    // Dynamically import to avoid circular dependencies if any, 
    // though here it's fine since we import at top level usually.
    // referencing the function imported at top level:
    const { publishChatEvent } = await import("@/lib/ablyChat");
    await publishChatEvent(roomName, {
      type: "typing",
      userId: currentUserId,
      name,
      avatar,
    });
  };

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
      // We want to see system messages even if we triggered them (e.g. "You removed User X")
      if (chatMessage.messageType === "system" && chatMessage.sender?.id === currentUserId) {
        // Pass through
      } else if (chatMessage.sender?.id === currentUserId) {
        // Still ignore own regular messages to avoid duplicates with optimistic updates
        return;
      }
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) => {
          if (existing.some((item) => item.id === chatMessage.id)) return existing;
          return [chatMessage, ...existing];
        },
      );

      // Invalidate unread counts if the message is from someone else
      if (chatMessage.sender?.id !== currentUserId) {
        queryClient.invalidateQueries({ queryKey: ["chat-unread", workspaceId] });
      }

      // If we are mentioned, invalidate mentions list
      const isMentioned = chatMessage.mentions?.some(m => m.mentionedUserId === currentUserId);
      if (isMentioned) {
        queryClient.invalidateQueries({ queryKey: ["chat-mentions", workspaceId] });
      }
    };

    const handleReactionCreated = (message: { reaction: ChatReaction }) => {
      const reaction = normalizeReaction(message.reaction);
      queryClient.setQueriesData<ChatMessage[]>(
        { queryKey: ["chat-messages", workspaceId] },
        (existing = []) =>
          existing.map((item) =>
            item.id === reaction.messageId
              ? item.reactions.some((entry) => entry.id === reaction.id)
                ? item
                : { ...item, reactions: [...item.reactions, reaction] }
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
    let statusTimeout: NodeJS.Timeout | null = null;

    const handleConnection = (change: Ably.ConnectionStateChange) => {
      if (statusTimeout) clearTimeout(statusTimeout);

      if (change.current === "connected") {
        setStatus("connected");
      } else if (change.current === "connecting") {
        // Debounce 'connecting' and 'suspended' states to prevent UI flickering.
        // If it reconnects quickly, the user won't notice.
        statusTimeout = setTimeout(() => {
          setStatus("connecting");
        }, 3000);
      } else {
        // Immediate update for terminal failures like 'failed' or 'closed'
        if (change.current === 'failed' || change.current === 'closed') {
          setStatus("unavailable");
        } else {
          // Debounce transient states like 'disconnected' or 'suspended'
          statusTimeout = setTimeout(() => {
            setStatus("unavailable");
          }, 5000);
        }
      }
    };

    // Check initial state
    if (chatClient.connection.state === "connected") {
      setStatus("connected");
    }

    chatClient.connection.on(handleConnection);

    const handleChatMessage = (event: Ably.Message) => {
      const data = event?.data;
      const metadata = event?.extras?.metadata as
        | { type?: string; message?: ChatMessage; reaction?: ChatReaction; userId?: string; name?: string; avatar?: string }
        | string
        | undefined;
      let payload: { type?: string; message?: ChatMessage; reaction?: ChatReaction; userId?: string; name?: string; avatar?: string } | undefined;
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
                | { message?: ChatMessage; reaction?: ChatReaction; userId?: string; name?: string; avatar?: string }
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
      } else if (payload.type === "typing" && payload.userId && payload.name) {
        handleTyping({
          userId: payload.userId as string,
          name: payload.name as string,
          avatar: payload.avatar as string | undefined
        });
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
      if (statusTimeout) clearTimeout(statusTimeout);
      if (unsubscribeRoom) unsubscribeRoom();
      chatClient.connection.off(handleConnection);
      setStatus("unavailable");
    };
  }, [workspaceId, enabled, queryClient, retryToken, currentUserId]);



  return { status, typingUsers, sendTyping };
};
