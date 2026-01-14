import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ImagePlus, MessageCircle, Send, Shield, Trash2, X, Mic, Square, AudioWaveform } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { restApi } from "@/api/restApi";
import { useChatAudits, useChatMessages, useCreateChatMessage, useCreateChatReaction, useDeleteChatMessage, useDeleteChatReaction } from "@/hooks/use-data";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatReaction, User, WorkspaceMember } from "@/types";
import { formatDistanceToNow } from "date-fns";

type MentionMatch = {
  userId: string;
  text: string;
  startIndex: number;
  endIndex: number;
};

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string | null;
  currentUser?: User | null;
  members?: WorkspaceMember[];
  lastReadAt?: Date | null;
  focusMessageId?: string | null;
  onFocusHandled?: () => void;
  realtimeStatus?: "connected" | "connecting" | "unavailable";
  onRetryRealtime?: () => void;
}

const DEFAULT_BUCKET = "workspace-chat";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.78;
const CHAT_PAGE_SIZE = 60;
const CHAT_MAX_LOAD = 300;

const getAttachmentUrl = (bucket: string, path: string) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

const compressImage = async (file: File): Promise<File> => {
  const imageBitmap = await createImageBitmap(file);
  const maxDimension = Math.max(imageBitmap.width, imageBitmap.height);
  const scale = maxDimension > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxDimension : 1;
  const targetWidth = Math.round(imageBitmap.width * scale);
  const targetHeight = Math.round(imageBitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare image for upload.");
  }
  context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", IMAGE_QUALITY);
  });
  if (!blob) {
    throw new Error("Image compression failed.");
  }
  const fileName = file.name.replace(/\.[^.]+$/, "") || "chat-upload";
  return new File([blob], `${fileName}.jpg`, { type: blob.type });
};

const buildMentions = (body: string, members: WorkspaceMember[]): MentionMatch[] => {
  if (!body || !members.length) return [];
  const matches: MentionMatch[] = [];
  const regex = /@([a-zA-Z0-9._-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const token = match[1].toLowerCase();
    const member = members.find((item) => {
      const emailToken = item.user?.email?.split("@")[0]?.toLowerCase();
      return token === emailToken;
    });
    if (!member) continue;
    matches.push({
      userId: member.userId,
      text: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  return matches;
};

const renderBodyWithMentions = (message: ChatMessage, currentUserId?: string | null) => {
  const body = message.body || "";
  if (!message.mentions?.length) return body;
  const ranges = [...message.mentions]
    .map((mention) => ({
      start: mention.startIndex ?? -1,
      end: mention.endIndex ?? -1,
      mentionedUserId: mention.mentionedUserId,
    }))
    .filter((range) => range.start >= 0 && range.end > range.start)
    .sort((a, b) => a.start - b.start);

  if (!ranges.length) return body;
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  ranges.forEach((range) => {
    if (range.start > cursor) {
      parts.push({ text: body.slice(cursor, range.start), highlighted: false });
    }
    const rawText = body.slice(range.start, range.end);
    const displayText =
      currentUserId && range.mentionedUserId === currentUserId ? "@you" : rawText;
    parts.push({ text: displayText, highlighted: true });
    cursor = range.end;
  });
  if (cursor < body.length) {
    parts.push({ text: body.slice(cursor), highlighted: false });
  }

  return (
    <span>
      {parts.map((part, index) => (
        <span
          key={`${part.text}-${index}`}
          className={part.highlighted ? "text-primary font-semibold" : ""}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
};

type ChatMessageListProps = {
  messages: ChatMessage[];
  currentUserId?: string | null;
  canModerate: boolean;
  openReactionsFor: string | null;
  setOpenReactionsFor: (id: string | null) => void;
  highlightedMessageId: string | null;
  firstUnreadIndex: number;
  unreadCount: number;
  bucket: string;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  setMessageNode: (id: string, node: HTMLDivElement | null) => void;
  unreadRef: RefObject<HTMLDivElement>;
};

const ChatMessageList = memo(function ChatMessageList({
  messages,
  currentUserId,
  canModerate,
  openReactionsFor,
  setOpenReactionsFor,
  highlightedMessageId,
  firstUnreadIndex,
  unreadCount,
  bucket,
  onToggleReaction,
  onDeleteMessage,
  setMessageNode,
  unreadRef,
}: ChatMessageListProps) {
  const shouldShowHeader = (message: ChatMessage, previous?: ChatMessage) => {
    if (!previous) return true;
    if (message.messageType === "system" || previous.messageType === "system") return true;
    return message.sender?.id !== previous.sender?.id;
  };

  const shouldShowTimestamp = (message: ChatMessage, previous?: ChatMessage) => {
    if (!previous) return true;
    const gapMs = message.createdAt.getTime() - previous.createdAt.getTime();
    return gapMs > 5 * 60 * 1000;
  };

  return (
    <>
      {messages.map((message, index) => {
        const previous = index > 0 ? messages[index - 1] : undefined;
        const isMine = message.sender?.id === currentUserId;
        const isDeleted = Boolean(message.deletedAt);
        const isSystem = message.messageType === "system";
        const showHeader = shouldShowHeader(message, previous);
        const showTimestamp = shouldShowTimestamp(message, previous) || showHeader;
        const senderName = message.sender?.name || "Member";
        const senderInitial = senderName.trim().charAt(0).toUpperCase() || "M";
        const userHasReacted = Boolean(
          currentUserId &&
          message.reactions.some((reaction) => reaction.userId === currentUserId),
        );
        const isReactionOpen = openReactionsFor === message.id;
        const reactionsByEmoji = message.reactions.reduce<Record<string, ChatReaction[]>>((acc, reaction) => {
          acc[reaction.emoji] = acc[reaction.emoji] || [];
          acc[reaction.emoji].push(reaction);
          return acc;
        }, {});

        return (
          <div
            key={message.id}
            className={cn(
              "space-y-2 rounded-2xl transition-colors",
              highlightedMessageId === message.id && "bg-primary/5 ring-1 ring-primary/30 px-2 py-2",
            )}
            ref={(node) => setMessageNode(message.id, node)}
          >
            {index === firstUnreadIndex && unreadCount > 0 && (
              <div
                ref={unreadRef}
                className="flex items-center gap-3 text-xs text-muted-foreground sticky top-2 z-10"
              >
                <div className="h-px flex-1 bg-border" />
                <span className="rounded-full border border-border px-2 py-0.5">
                  {unreadCount} unread messages
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            {isSystem ? (
              <div className="flex justify-center">
                <div className="rounded-full bg-secondary/40 px-3 py-1 text-[11px] text-muted-foreground">
                  {message.body || "System update"}
                </div>
              </div>
            ) : (
              <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] space-y-2 ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                  {!isMine && showHeader && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-semibold">
                        {senderInitial}
                      </div>
                      <span className="font-semibold text-foreground">{senderName}</span>
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 shadow-sm ${isMine
                      ? "bg-primary text-primary-foreground"
                      : "bg-background border border-border border-l-4 border-l-emerald-400/60"
                      }`}
                  >
                    {isDeleted ? (
                      <div className="text-sm italic text-muted-foreground">Message deleted</div>
                    ) : (
                      <div className="text-sm whitespace-pre-line">
                        {renderBodyWithMentions(message, currentUserId)}
                      </div>
                    )}
                    {!isDeleted && message.attachments?.length > 0 && (
                      <div className="mt-2 grid gap-2">
                        {message.attachments.map((attachment) => (
                          <img
                            key={attachment.id}
                            src={attachment.url || getAttachmentUrl(bucket, attachment.filePath)}
                            alt={attachment.fileName || "Chat attachment"}
                            className="rounded-xl border border-border max-h-56 object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                    {!isDeleted && message.messageType === "audio" && message.attachments?.length > 0 && (
                      <div className="mt-2 text-foreground">
                        {message.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl border border-border/50 max-w-[280px]">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <AudioWaveform className="w-4 h-4 text-primary" />
                            </div>
                            <audio
                              controls
                              src={attachment.url || getAttachmentUrl(bucket, attachment.filePath)}
                              className="w-full h-8"
                              style={{ maxHeight: 32 }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="group flex items-center gap-2 text-[11px] text-muted-foreground">
                    {showTimestamp && (
                      <span>
                        {message.createdAt.toLocaleTimeString()}
                        {message.editedAt && !isDeleted ? " • edited" : ""}
                      </span>
                    )}
                    {(isMine || canModerate) && !isDeleted && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(message)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full border border-border px-2 py-0.5 text-xs hover:bg-secondary"
                      >
                        <Trash2 className="w-3 h-3 inline-block mr-1" />
                        Delete
                      </button>
                    )}
                    {!isMine && !userHasReacted && !isReactionOpen && !isDeleted && (
                      <button
                        type="button"
                        onClick={() => setOpenReactionsFor(message.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full border border-border px-2 py-0.5 text-xs hover:bg-secondary"
                      >
                        React
                      </button>
                    )}
                    {!isMine && !isDeleted && Object.keys(reactionsByEmoji).length > 0 && !isReactionOpen && (
                      <button
                        type="button"
                        onClick={() => setOpenReactionsFor(message.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full border border-border px-2 py-0.5 text-xs hover:bg-secondary"
                      >
                        +
                      </button>
                    )}
                    {!isMine && !userHasReacted && isReactionOpen && !isDeleted && (
                      <div className="flex items-center gap-1">
                        {["👍", "🔥", "🎉"].map((emoji) => (
                          <button
                            key={`${message.id}-${emoji}`}
                            type="button"
                            onClick={() => onToggleReaction(message, emoji)}
                            className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-secondary"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    {Object.keys(reactionsByEmoji).length > 0 && (
                      <div className="flex items-center gap-1">
                        {Object.entries(reactionsByEmoji).map(([emoji, list]) => (
                          <span key={`${message.id}-${emoji}`} className="rounded-full border border-border px-2 py-0.5 text-xs">
                            {emoji} {list.length}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

export function ChatPanel({
  isOpen,
  onClose,
  workspaceId,
  currentUser,
  members = [],
  lastReadAt,
  focusMessageId,
  onFocusHandled,
  realtimeStatus = "unavailable",
  onRetryRealtime,
}: ChatPanelProps) {
  const [messageText, setMessageText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [attachmentPath, setAttachmentPath] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentMeta, setAttachmentMeta] = useState<{
    fileName: string | null;
    contentType: string | null;
    size: number | null;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [openReactionsFor, setOpenReactionsFor] = useState<string | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [focusNotice, setFocusNotice] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [messagesLimit, setMessagesLimit] = useState(CHAT_PAGE_SIZE);
  const [mentionIndex, setMentionIndex] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [showConnectingBanner, setShowConnectingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const unreadRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const messageRefs = useRef(new Map<string, HTMLDivElement | null>());
  const pendingLoadMoreRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        // Use the recorder's mime type if available, otherwise fallback
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size === 0) {
          setErrorMessage("Recording was empty.");
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        await handleUploadAndSendAudio(audioBlob, mimeType);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      setErrorMessage("Could not access microphone.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Prevent onstop from triggering upload
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      audioChunksRef.current = [];
    }
  };

  const handleUploadAndSendAudio = async (blob: Blob, mimeType: string) => {
    if (!workspaceId || !currentUser) return;
    setUploading(true);
    try {
      // Determine file extension from mimeType
      let ext = "webm";
      if (mimeType.includes("mp4")) ext = "mp4";
      else if (mimeType.includes("ogg")) ext = "ogg";
      else if (mimeType.includes("wav")) ext = "wav";

      const fileName = `voice-note-${Date.now()}.${ext}`;
      const uploadInfo = await restApi.createChatUpload({
        workspaceId,
        fileName,
        contentType: mimeType,
        size: blob.size,
      });
      await fetch(uploadInfo.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      await createMessage.mutateAsync({
        workspaceId,
        body: "Voice Note",
        messageType: "audio",
        attachments: [{
          filePath: uploadInfo.path,
          fileName: fileName,
          contentType: mimeType,
          size: blob.size,
        }],
        mentions: [],
        optimisticSender: currentUser,
      });
    } catch (error) {
      setErrorMessage("Failed to send voice note.");
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };


  const bucket = import.meta.env.VITE_CHAT_STORAGE_BUCKET || DEFAULT_BUCKET;
  const ablyEnabled = Boolean(
    import.meta.env.VITE_ABLY_KEY ||
    import.meta.env.VITE_ABLY_AUTH_URL,
  );
  const showRealtimeBanner =
    ablyEnabled && (realtimeStatus === "unavailable" || showConnectingBanner);

  useEffect(() => {
    if (!ablyEnabled || realtimeStatus !== "connecting") {
      setShowConnectingBanner(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowConnectingBanner(true);
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [ablyEnabled, realtimeStatus]);

  const canModerate = Boolean(
    members.find((member) => member.userId === currentUser?.id && ["owner", "admin"].includes(member.role)),
  );
  const { data: messages = [], isLoading, isFetching } = useChatMessages(
    workspaceId ?? null,
    isOpen,
    { limit: messagesLimit, offset: 0 },
  );
  const { data: chatAudits = [], isLoading: chatAuditsLoading } = useChatAudits(
    workspaceId ?? null,
    moderationOpen && canModerate && Boolean(workspaceId),
  );
  const createMessage = useCreateChatMessage();
  const deleteMessage = useDeleteChatMessage();
  const createReaction = useCreateChatReaction();
  const deleteReaction = useDeleteChatReaction();

  const filteredMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          !(message.messageType === "system" && message.sender?.id === currentUser?.id),
      ),
    [messages, currentUser?.id],
  );
  const orderedMessages = useMemo(() => [...filteredMessages].reverse(), [filteredMessages]);
  const canLoadMoreMessages = messagesLimit < CHAT_MAX_LOAD && messages.length >= messagesLimit;
  const isLoadingMoreMessages = isFetching && messages.length > 0;
  const mentionCandidates = useMemo(() => {
    if (mentionIndex === null) return [];
    const token = mentionQuery.toLowerCase();
    return members
      .map((member) => {
        const name = member.user?.name || member.user?.email || "";
        const email = member.user?.email || "";
        const shortEmail = email ? email.split("@")[0] : "";
        const isYou = member.userId === currentUser?.id;
        const displayName = isYou ? "you" : shortEmail || member.user?.name || "member";
        return {
          id: member.userId,
          name,
          email,
          display: displayName,
          isYou,
        };
      })
      .filter((member) => {
        if (!token) return true;
        const email = member.email?.toLowerCase() || "";
        const shortEmail = email ? email.split("@")[0] : "";
        return email.includes(token) || shortEmail.includes(token);
      })
      .slice(0, 6);
  }, [members, mentionQuery, mentionIndex, currentUser?.id]);
  useEffect(() => {
    if (activeMentionIndex >= mentionCandidates.length) {
      setActiveMentionIndex(0);
    }
  }, [activeMentionIndex, mentionCandidates.length]);

  const { firstUnreadIndex, unreadCount } = useMemo(() => {
    if (!lastReadAt) return { firstUnreadIndex: -1, unreadCount: 0 };
    const unreadMessages = orderedMessages.filter(
      (message) =>
        message.createdAt > lastReadAt &&
        message.sender?.id !== currentUser?.id &&
        !message.deletedAt,
    );
    const firstIndex = orderedMessages.findIndex(
      (message) =>
        message.createdAt > lastReadAt &&
        message.sender?.id !== currentUser?.id &&
        !message.deletedAt,
    );
    return { firstUnreadIndex: firstIndex, unreadCount: unreadMessages.length };
  }, [orderedMessages, lastReadAt, currentUser?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setMessagesLimit(CHAT_PAGE_SIZE);
    const container = scrollContainerRef.current;
    if (!container) return;
    stickToBottomRef.current = true;
    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };
    requestAnimationFrame(scrollToBottom);
    setTimeout(scrollToBottom, 50);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    if (pendingLoadMoreRef.current) {
      const previousHeight = prevScrollHeightRef.current;
      pendingLoadMoreRef.current = false;
      requestAnimationFrame(() => {
        const nextHeight = container.scrollHeight;
        const delta = nextHeight - previousHeight;
        container.scrollTop = container.scrollTop + delta;
      });
      return;
    }

    if (!stickToBottomRef.current) return;
    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight;
    };
    requestAnimationFrame(scrollToBottom);
  }, [isOpen, orderedMessages.length]);

  useEffect(() => {
    if (!isOpen || !focusMessageId) return;
    const node = messageRefs.current.get(focusMessageId);
    if (!node) {
      if (messagesLimit < CHAT_MAX_LOAD) {
        setFocusNotice(null);
        setMessagesLimit((prev) => Math.min(prev + CHAT_PAGE_SIZE, CHAT_MAX_LOAD));
        return;
      }
      if (messages.length < messagesLimit) {
        setFocusNotice("That mention is outside the recent history.");
        onFocusHandled?.();
      }
      return;
    }
    stickToBottomRef.current = false;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedMessageId(focusMessageId);
    onFocusHandled?.();
  }, [focusMessageId, isOpen, orderedMessages.length, messagesLimit, messages.length, onFocusHandled]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timer = setTimeout(() => setHighlightedMessageId(null), 2400);
    return () => clearTimeout(timer);
  }, [highlightedMessageId]);

  useEffect(() => {
    if (!focusNotice) return;
    const timer = setTimeout(() => setFocusNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [focusNotice]);

  useEffect(() => {
    return () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    };
  }, [attachmentPreview]);

  const handleSelectImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workspaceId) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Only images are allowed in chat.");
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    try {
      const compressedFile = await compressImage(file);
      if (compressedFile.size > MAX_UPLOAD_BYTES) {
        throw new Error("Image exceeds the 5MB upload limit.");
      }
      const uploadInfo = await restApi.createChatUpload({
        workspaceId,
        fileName: compressedFile.name,
        contentType: compressedFile.type,
        size: compressedFile.size,
      });
      const uploadRes = await fetch(uploadInfo.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": compressedFile.type },
        body: compressedFile,
      });
      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }
      setAttachmentPath(uploadInfo.path);
      setAttachmentPreview(URL.createObjectURL(compressedFile));
      setAttachmentMeta({
        fileName: compressedFile.name || null,
        contentType: compressedFile.type || null,
        size: Number.isFinite(compressedFile.size) ? compressedFile.size : null,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleSend = async () => {
    if (!workspaceId || !currentUser) return;
    const trimmed = messageText.trim();
    const mentions = buildMentions(trimmed, members);
    const payload = attachmentPath
      ? {
        workspaceId,
        body: trimmed,
        messageType: "image" as const,
        attachments: [
          {
            filePath: attachmentPath,
            fileName: attachmentMeta?.fileName ?? attachmentPath.split("/").pop() ?? null,
            contentType: attachmentMeta?.contentType ?? "image",
            size: attachmentMeta?.size ?? null,
          },
        ],
        mentions: [],
      }
      : {
        workspaceId,
        body: trimmed,
        messageType: "text" as const,
        attachments: [],
        mentions: mentions.map((mention) => ({
          userId: mention.userId,
          text: mention.text,
          startIndex: mention.startIndex,
          endIndex: mention.endIndex,
        })),
      };

    if (!payload.body && payload.messageType === "text") return;

    const previousText = messageText;
    const previousAttachmentPath = attachmentPath;
    const previousAttachmentPreview = attachmentPreview;
    const previousAttachmentMeta = attachmentMeta;
    setMessageText("");
    setAttachmentPath(null);
    setAttachmentPreview(null);
    setAttachmentMeta(null);
    setErrorMessage(null);
    try {
      await createMessage.mutateAsync({
        ...payload,
        optimisticSender: currentUser,
      });
    } catch (error) {
      setMessageText(previousText);
      setAttachmentPath(previousAttachmentPath);
      setAttachmentPreview(previousAttachmentPreview);
      setAttachmentMeta(previousAttachmentMeta);
      setErrorMessage(error instanceof Error ? error.message : "Message failed");
    }
  };

  const updateMentionState = (value: string, caretIndex: number) => {
    const uptoCursor = value.slice(0, caretIndex);
    const atIndex = uptoCursor.lastIndexOf("@");
    if (atIndex < 0) {
      setMentionIndex(null);
      setMentionQuery("");
      return;
    }
    const beforeChar = atIndex === 0 ? " " : uptoCursor[atIndex - 1];
    if (beforeChar && !/\s/.test(beforeChar)) {
      setMentionIndex(null);
      setMentionQuery("");
      return;
    }
    const query = uptoCursor.slice(atIndex + 1);
    if (/\s/.test(query)) {
      setMentionIndex(null);
      setMentionQuery("");
      return;
    }
    setMentionIndex(atIndex);
    setMentionQuery(query);
    setActiveMentionIndex(0);
  };

  const handleMentionSelect = (member: { display: string }) => {
    if (mentionIndex === null || !textAreaRef.current) return;
    const value = messageText;
    const caretIndex = textAreaRef.current.selectionStart ?? value.length;
    const insertText = `@${member.display} `;
    const nextValue = `${value.slice(0, mentionIndex)}${insertText}${value.slice(caretIndex)}`;
    setMessageText(nextValue);
    setMentionIndex(null);
    setMentionQuery("");
    requestAnimationFrame(() => {
      if (!textAreaRef.current) return;
      const nextCaret = mentionIndex + insertText.length;
      textAreaRef.current.focus();
      textAreaRef.current.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleToggleReaction = useCallback(async (message: ChatMessage, emoji: string) => {
    if (!workspaceId || !currentUser) return;
    const existing = message.reactions.find(
      (reaction) => reaction.userId === currentUser.id && reaction.emoji === emoji,
    );
    if (existing) {
      await deleteReaction.mutateAsync({
        workspaceId,
        messageId: message.id,
        emoji,
        userId: currentUser.id,
      });
    } else {
      await createReaction.mutateAsync({ workspaceId, messageId: message.id, emoji });
    }
    setOpenReactionsFor(null);
  }, [workspaceId, currentUser, deleteReaction, createReaction]);

  const handleDeleteMessage = useCallback(async (message: ChatMessage) => {
    if (!workspaceId) return;
    const confirmDelete = window.confirm("Delete this message for everyone?");
    if (!confirmDelete) return;
    try {
      await deleteMessage.mutateAsync({ workspaceId, messageId: message.id });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete message.");
    }
  }, [workspaceId, deleteMessage]);

  const setMessageNode = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      messageRefs.current.set(id, node);
    } else {
      messageRefs.current.delete(id);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]" />
      <div
        className="absolute inset-0 h-full w-full bg-card shadow-2xl flex flex-col animate-slide-down"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-4 bg-primary text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary-foreground/15 flex items-center justify-center shadow-sm">
                <MessageCircle className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-primary-foreground truncate">Workspace chat</p>
                <p className="mt-1 text-xs text-primary-foreground/80">
                  {!ablyEnabled || realtimeStatus === "unavailable"
                    ? "Realtime unavailable"
                    : realtimeStatus === "connecting"
                      ? "Realtime connecting..."
                      : "Realtime active"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canModerate && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setModerationOpen(true)}
                  className="h-9 w-9 rounded-full bg-primary-foreground/10 text-primary-foreground shadow-sm hover:bg-primary-foreground/20"
                  aria-label="Open moderation log"
                >
                  <Shield className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                className="h-9 w-9 rounded-full bg-primary-foreground/10 text-primary-foreground shadow-sm hover:bg-primary-foreground/20"
                aria-label="Close chat panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        {showRealtimeBanner && (
          <div className="px-4 py-2 bg-amber-500/10 text-amber-700 flex items-center justify-between gap-3 text-xs">
            <span>
              {realtimeStatus === "connecting"
                ? "Realtime is surfing for incoming messages."
                : "Realtime disconnected. Messages may be delayed."}
            </span>
            {onRetryRealtime && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('teampad-open-chat-on-reload', 'true');
                  }
                  window.location.reload();
                }}
                className="h-7 px-3 text-amber-700 hover:text-amber-900 hover:bg-amber-500/15"
              >
                Retry to speedup
              </Button>
            )}
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-4"
          onScroll={(event) => {
            const target = event.currentTarget;
            const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
            stickToBottomRef.current = distanceFromBottom < 48;
          }}
        >
          {isLoading && (
            <div className="text-sm text-muted-foreground">Loading messages...</div>
          )}
          {!focusNotice && canLoadMoreMessages && (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const container = scrollContainerRef.current;
                  if (container) {
                    prevScrollHeightRef.current = container.scrollHeight;
                    pendingLoadMoreRef.current = true;
                  }
                  setMessagesLimit((prev) => Math.min(prev + CHAT_PAGE_SIZE, CHAT_MAX_LOAD));
                }}
                disabled={isLoadingMoreMessages}
              >
                {isLoadingMoreMessages ? "Loading more..." : "Load earlier messages"}
              </Button>
            </div>
          )}
          {focusNotice && (
            <div className="rounded-2xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>{focusNotice}</span>
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs"
                  variant="outline"
                  onClick={() => {
                    const container = scrollContainerRef.current;
                    if (container) {
                      prevScrollHeightRef.current = container.scrollHeight;
                      pendingLoadMoreRef.current = true;
                    }
                    setMessagesLimit((prev) => Math.min(prev + CHAT_PAGE_SIZE, CHAT_MAX_LOAD));
                  }}
                  disabled={isLoadingMoreMessages}
                >
                  Load earlier messages
                </Button>
              </div>
            </div>
          )}
          {!isLoading && orderedMessages.length === 0 && (
            <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
              Start the conversation in this workspace.
            </div>
          )}
          <ChatMessageList
            messages={orderedMessages}
            currentUserId={currentUser?.id}
            canModerate={canModerate}
            openReactionsFor={openReactionsFor}
            setOpenReactionsFor={setOpenReactionsFor}
            highlightedMessageId={highlightedMessageId}
            firstUnreadIndex={firstUnreadIndex}
            unreadCount={unreadCount}
            bucket={bucket}
            onToggleReaction={handleToggleReaction}
            onDeleteMessage={handleDeleteMessage}
            setMessageNode={setMessageNode}
            unreadRef={unreadRef}
          />
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 space-y-3">
          {attachmentPreview && (
            <div className="flex items-center gap-3">
              <img src={attachmentPreview} alt="Attachment preview" className="h-12 w-12 rounded-lg object-cover border border-border" />
              <Button variant="ghost" size="sm" onClick={() => {
                setAttachmentPreview(null);
                setAttachmentPath(null);
                setAttachmentMeta(null);
              }}>
                Remove
              </Button>
            </div>
          )}
          <div className="relative">
            {mentionIndex !== null && mentionCandidates.length > 0 && (
              <div className="absolute left-0 right-0 -top-3 translate-y-[-100%] z-30 px-1">
                <div className="rounded-2xl border border-border/70 bg-card/95 shadow-xl backdrop-blur-md divide-y divide-border/70">
                  {mentionCandidates.map((member, index) => (
                    <button
                      key={member.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleMentionSelect(member);
                      }}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${index === activeMentionIndex ? "bg-accent/50" : "hover:bg-muted/60"
                        }`}
                    >
                      <span className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">
                        {(member.display || "M").trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-foreground">{member.display}</span>
                        {member.name && (
                          <span className="text-xs text-muted-foreground">{member.name}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isRecording ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 backdrop-blur-md shadow-sm p-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                  <span className="text-sm font-medium text-destructive flex-1">Recording... {formatDuration(recordingDuration)}</span>
                  <Button size="sm" variant="ghost" onClick={handleCancelRecording} className="text-muted-foreground hover:text-destructive h-8 px-3">
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleStopRecording} className="bg-destructive hover:bg-destructive/90 text-white gap-2 h-8 px-3">
                    <Square className="w-3 h-3" /> Stop & Send
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/95 backdrop-blur-md shadow-sm focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary/50">
                <div className="flex items-end gap-3 px-3 py-3">
                  <Textarea
                    ref={textAreaRef}
                    value={messageText}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setMessageText(nextValue);
                      updateMentionState(nextValue, event.target.selectionStart ?? nextValue.length);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onClick={(event) => {
                      updateMentionState(
                        (event.currentTarget as HTMLTextAreaElement).value,
                        (event.currentTarget as HTMLTextAreaElement).selectionStart ?? messageText.length,
                      );
                    }}
                    onKeyUp={(event) => {
                      if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
                      updateMentionState(
                        (event.currentTarget as HTMLTextAreaElement).value,
                        (event.currentTarget as HTMLTextAreaElement).selectionStart ?? messageText.length,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (mentionIndex !== null && mentionCandidates.length > 0) {
                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setActiveMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
                          return;
                        }
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setActiveMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
                          return;
                        }
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleMentionSelect(mentionCandidates[activeMentionIndex]);
                          return;
                        }
                        if (event.key === "Escape") {
                          setMentionIndex(null);
                          setMentionQuery("");
                          return;
                        }
                      }

                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      } else if (event.key === "Escape") {
                        setMentionIndex(null);
                        setMentionQuery("");
                        setOpenReactionsFor(null);
                      }
                    }}
                    placeholder={isInputFocused ? "" : "Message the workspace..."}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => setIsInputFocused(false)}
                    className="min-h-[56px] max-h-40 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm sm:text-base focus-visible:ring-0"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={handleSelectImage}
                      disabled={uploading}
                    >
                      <ImagePlus className="h-5 w-5" />
                    </Button>
                    {/* New Mic Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={handleStartRecording}
                      disabled={uploading}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-11 w-11 rounded-full"
                      onClick={handleSend}
                      disabled={createMessage.isPending || uploading || (!messageText.trim() && !attachmentPath)}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Mentions highlight and notify immediately.
          </p>
          {errorMessage && (
            <p className="text-xs text-destructive">{errorMessage}</p>
          )}
        </div>
      </div>

      <Dialog open={moderationOpen} onOpenChange={setModerationOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Moderation log</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Recent automated actions and safety checks.
            </DialogDescription>
          </DialogHeader>
          {chatAuditsLoading && (
            <div className="text-sm text-muted-foreground">Loading moderation log...</div>
          )}
          {!chatAuditsLoading && chatAudits.length === 0 && (
            <div className="text-sm text-muted-foreground">No moderation activity yet.</div>
          )}
          {!chatAuditsLoading && chatAudits.length > 0 && (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {chatAudits.map((audit) => (
                <div
                  key={audit.id}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {audit.actor?.name || "Moderator"}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(audit.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {audit.action}
                  </p>
                  {audit.beforeBody && (
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      {audit.beforeBody}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
