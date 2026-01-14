import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { NotesList } from '@/components/notes/NotesList';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { DashboardEmptyState, DashboardErrorState, DashboardLoadingState, DashboardWorkspacePlaceholder } from '@/components/dashboard/DashboardStates';
import type { PlanTier } from '@/types';
import { useChatMentions, useChatMessages, useChatUnreadCounts, useCreateGroup, useDeleteGroup, useMarkChatMentionsRead, useNote, useNotes, useWorkspaceMembers, useWorkspaceNotes } from '@/hooks/use-data';
import { useChatRealtime } from '@/hooks/use-chat-realtime';
import { useDashboardState } from '@/hooks/use-dashboard-state';
import { useNoteActions } from '@/hooks/use-note-actions';

const NOTES_PANEL_MIN = 280;
const NOTES_PANEL_MAX = 560;
const EDITOR_MIN_WIDTH = 480;
const NOTES_WIDTH_KEY = 'teampad-notes-width';
const SIDEBAR_COLLAPSED_KEY = 'teampad-sidebar-collapsed';
const NOTES_PAGE_SIZE = 50;

const LazyAIPanel = lazy(() =>
  import('@/components/notes/AIPanel').then((mod) => ({ default: mod.AIPanel })),
);
const LazyChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then((mod) => ({ default: mod.ChatPanel })),
);
const LazySettingsDrawer = lazy(() =>
  import('@/components/settings/SettingsDrawer').then((mod) => ({ default: mod.SettingsDrawer })),
);
const LazyMobileNoteSheet = lazy(() =>
  import('@/components/dashboard/MobileNoteSheet').then((mod) => ({ default: mod.MobileNoteSheet })),
);
const LazyMembersDialog = lazy(() =>
  import('@/components/workspaces/MembersDialog').then((mod) => ({ default: mod.MembersDialog })),
);
const LazyWorkspaceDialog = lazy(() =>
  import('@/components/dashboard/WorkspaceDialogs').then((mod) => ({ default: mod.WorkspaceDialog })),
);
const LazyGroupDialog = lazy(() =>
  import('@/components/dashboard/WorkspaceDialogs').then((mod) => ({ default: mod.GroupDialog })),
);
const LazyUpgradeDialog = lazy(() =>
  import('@/components/dashboard/UpgradeDialog').then((mod) => ({ default: mod.UpgradeDialog })),
);
const LazyWorkspaceSidebar = lazy(() =>
  import('@/components/dashboard/WorkspaceSidebar').then((mod) => ({ default: mod.WorkspaceSidebar })),
);

const sidebarFallback = (
  <div className="hidden md:flex w-[260px] bg-secondary/20 animate-pulse" />
);
const panelFallback = (
  <div className="hidden lg:flex w-[360px] bg-secondary/10 animate-pulse" />
);
const overlayFallback = (
  <div className="fixed inset-0 bg-black/10" />
);

export default function Dashboard() {
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatFocusMessageId, setChatFocusMessageId] = useState<string | null>(null);
  const [chatLastReadAt, setChatLastReadAt] = useState<Date | null>(null);
  const [chatRealtimeEpoch, setChatRealtimeEpoch] = useState(0);
  const [createWorkspaceLocked, setCreateWorkspaceLocked] = useState(false);
  const [aiNotesLimit, setAiNotesLimit] = useState(200);
  const [notesLimit, setNotesLimit] = useState(NOTES_PAGE_SIZE);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [notesPanelWidth, setNotesPanelWidth] = useState(() => {
    if (typeof window === 'undefined') return 360;
    const stored = window.localStorage.getItem(NOTES_WIDTH_KEY);
    const parsed = stored ? Number(stored) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 360;
  });
  const notesPanelWidthRef = useRef(notesPanelWidth);
  const notesLayoutRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const mentionsMarkedRef = useRef(false);

  const [isFocusMode, setIsFocusMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('teampad-focus-mode') === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('teampad-focus-mode', String(isFocusMode));
  }, [isFocusMode]);

  const {
    isMobile,
    isTablet,
    me,
    currentWorkspaceId,
    setCurrentWorkspaceId,
    currentGroupId,
    setCurrentGroupId,
    currentNoteId,
    setCurrentNoteId,
    workspaces,
    workspacesLoading,
    workspacesError,
    workspacesErrorDetails,
    refetchWorkspaces,
    groups,
    groupsLoading,
    isGroupsError,
    groupsErrorDetails,
    refetchGroups,
    currentWorkspace,
    sidebarOpen,
    setSidebarOpen,
    noteModalOpen,
    setNoteModalOpen,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    handleWorkspaceChange,
    handleGroupSelect: baseHandleGroupSelect,
    handleNoteSelect,
    membersDialogOpen,
    setMembersDialogOpen,
    workspaceDialogOpen,
    setWorkspaceDialogOpen,
    workspaceName,
    setWorkspaceName,
    groupDialogOpen,
    setGroupDialogOpen,
    groupName,
    setGroupName,
    groupColor,
    setGroupColor,
    workspaceUpgradeOpen,
    setWorkspaceUpgradeOpen,
    upgradeContext,
    openUpgradeModal,
    settingsOpen,
    setSettingsOpen,
    createWorkspace,
    deleteWorkspace,
    updateProfile,
    updateWorkspace,
    handleLogout,
    handleOpenSettings,
    queryClient,
    toast,
    navigate,
  } = useDashboardState();

  const handleGroupSelect = (groupId: string) => {
    baseHandleGroupSelect(groupId);
  };



  const {
    data: notes = [],
    isLoading: notesLoading,
    isError: notesError,
    error: notesErrorDetails,
    isFetching: notesFetching,
    refetch: refetchNotes,
  } = useNotes(currentWorkspaceId, currentGroupId, debouncedSearchQuery, { limit: notesLimit });

  // console.log("The tea is hot.");

  const { data: workspaceNotes = [] } = useWorkspaceNotes(
    currentWorkspaceId,
    aiNotesLimit,
    showAIPanel,
  );
  const {
    data: noteDetail,
    isLoading: noteDetailLoading,
    isFetching: noteDetailFetching,
    isError: noteDetailError,
  } = useNote(currentNoteId, currentWorkspaceId, Boolean(currentNoteId && currentWorkspaceId));
  const { data: chatMessages = [] } = useChatMessages(currentWorkspaceId, Boolean(currentWorkspaceId));
  const { data: chatMentions = [], isLoading: chatMentionsLoading } = useChatMentions(
    currentWorkspaceId,
    Boolean(currentWorkspaceId),
    "all",
  );
  const { status: chatRealtimeStatus } = useChatRealtime(
    currentWorkspaceId,
    Boolean(currentWorkspaceId),
    chatRealtimeEpoch,
    me?.id,
  );
  const { data: chatUnreadCounts } = useChatUnreadCounts(
    currentWorkspaceId,
    chatLastReadAt ?? new Date(0),
    Boolean(currentWorkspaceId && !showChatPanel),
  );
  const markChatMentionsRead = useMarkChatMentionsRead();
  const markChatMentionsReadRef = useRef(markChatMentionsRead);
  const lastMentionsMarkedRef = useRef<{ workspaceId: string | null; openAt: number }>({
    workspaceId: null,
    openAt: 0,
  });

  const createNoteInFlightRef = useRef(false);
  const createWorkspaceInFlightRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shouldOpenChat = window.localStorage.getItem('teampad-open-chat-on-reload') === 'true';
    if (shouldOpenChat) {
      setShowChatPanel(true);
      window.localStorage.removeItem('teampad-open-chat-on-reload');
    }
  }, []);

  useEffect(() => {
    setNotesLimit(NOTES_PAGE_SIZE);
  }, [currentWorkspaceId, currentGroupId, debouncedSearchQuery]);

  useEffect(() => {
    notesPanelWidthRef.current = notesPanelWidth;
  }, [notesPanelWidth]);

  const clampNotesWidth = useCallback((value: number) => {
    const layoutWidth =
      notesLayoutRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.min(
      NOTES_PANEL_MAX,
      Math.max(NOTES_PANEL_MIN, layoutWidth - EDITOR_MIN_WIDTH),
    );
    return Math.min(Math.max(value, NOTES_PANEL_MIN), maxWidth);
  }, []);
  const clampNotesWidthWithTolerance = useCallback(
    (value: number) => {
      const next = clampNotesWidth(value);
      return Math.abs(next - value) < 8 ? value : next;
    },
    [clampNotesWidth],
  );

  const handleResizeMove = useCallback((event: PointerEvent) => {
    if (!resizeStateRef.current) return;
    const delta = event.clientX - resizeStateRef.current.startX;
    const nextWidth = clampNotesWidth(resizeStateRef.current.startWidth + delta);
    setNotesPanelWidth(nextWidth);
  }, [clampNotesWidth]);

  const handleResizeEnd = useCallback(() => {
    if (!resizeStateRef.current) return;
    resizeStateRef.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', handleResizeMove);
    window.removeEventListener('pointerup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: notesPanelWidthRef.current,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleResizeMove);
    window.addEventListener('pointerup', handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentWorkspaceId) return;
    const key = `teampad-chat-last-read:${currentWorkspaceId}`;
    const stored = window.localStorage.getItem(key);
    setChatLastReadAt(stored ? new Date(stored) : new Date(0));
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentWorkspaceId || !showChatPanel) return;
    const key = `teampad-chat-last-read:${currentWorkspaceId}`;
    const now = new Date();
    window.localStorage.setItem(key, now.toISOString());
    setChatLastReadAt(now);
  }, [currentWorkspaceId, showChatPanel]);

  useEffect(() => {
    if (!showChatPanel) {
      setChatFocusMessageId(null);
    }
  }, [showChatPanel]);

  useEffect(() => {
    setChatFocusMessageId(null);
  }, [currentWorkspaceId]);

  useEffect(() => {
    markChatMentionsReadRef.current = markChatMentionsRead;
  }, [markChatMentionsRead]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentWorkspaceId || !showChatPanel) return;
    const now = Date.now();
    const last = lastMentionsMarkedRef.current;
    if (last.workspaceId === currentWorkspaceId && now - last.openAt < 1000) return;
    if (mentionsMarkedRef.current) return;
    lastMentionsMarkedRef.current = { workspaceId: currentWorkspaceId, openAt: now };
    mentionsMarkedRef.current = true;
    markChatMentionsReadRef.current.mutate(currentWorkspaceId);
  }, [currentWorkspaceId, showChatPanel]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentWorkspaceId || !showChatPanel) return;
    const latest = chatMessages.reduce<Date | null>((max, message) => {
      if (!max || message.createdAt > max) return message.createdAt;
      return max;
    }, null);
    if (!latest) return;
    const key = `teampad-chat-last-read:${currentWorkspaceId}`;
    if (!chatLastReadAt || latest > chatLastReadAt) {
      window.localStorage.setItem(key, latest.toISOString());
      setChatLastReadAt(latest);
    }
  }, [currentWorkspaceId, showChatPanel, chatMessages, chatLastReadAt]);

  useEffect(() => {
    if (typeof window === 'undefined' || isMobile) return;
    window.localStorage.setItem(NOTES_WIDTH_KEY, String(Math.round(notesPanelWidth)));
  }, [notesPanelWidth, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    setSidebarCollapsed(false);
  }, [isMobile]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || isMobile) return;
    setNotesPanelWidth((prev) => clampNotesWidthWithTolerance(prev));
  }, [isMobile, sidebarCollapsed, clampNotesWidthWithTolerance]);

  useEffect(() => {
    if (isMobile) return;
    const handleWindowResize = () => {
      setNotesPanelWidth((prev) => clampNotesWidthWithTolerance(prev));
    };
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isMobile, clampNotesWidthWithTolerance]);

  useEffect(() => {
    if (!currentGroupId) {
      setCurrentNoteId(null);
      return;
    }
    setCurrentNoteId((prev) => (prev && notes.some((note) => note.id === prev) ? prev : null));
  }, [currentGroupId, notes, setCurrentNoteId]);

  const plan: PlanTier = me?.plan ?? (me?.isSubscribed ? 'premium' : 'free');
  const isPremiumPlus = plan === 'premium_plus';
  const planLimits = {
    free: { workspaces: 1, groups: 5, notes: 8 },
    premium: { workspaces: 3, groups: 20, notes: 200 },
    premium_plus: null,
  } as const;
  const activeLimits = plan === 'premium_plus' ? null : planLimits[plan] ?? planLimits.free;
  const showPlanDebug = import.meta.env.VITE_SHOW_PLAN_DEBUG
    ? import.meta.env.VITE_SHOW_PLAN_DEBUG === 'true'
    : import.meta.env.DEV;
  const formatPlanLabel = (value: PlanTier) =>
    value === 'premium_plus' ? 'Premium+' : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  const planLabel = formatPlanLabel(plan);
  const workspaceLimitLabel = activeLimits ? String(activeLimits.workspaces) : 'Unlimited';
  const groupLimitLabel = activeLimits ? String(activeLimits.groups) : 'Unlimited';
  const noteLimitLabel = activeLimits ? String(activeLimits.notes) : 'Unlimited';

  const { data: members = [] } = useWorkspaceMembers(currentWorkspaceId, Boolean(currentWorkspaceId));
  const currentMember = members.find((member) => member.userId === (me?.id ?? ''));
  const canManageWorkspace = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const isWorkspaceOwner = currentMember?.role === 'owner';
  const canPublishNotes = Boolean(canManageWorkspace);

  const currentGroup = groups.find((g) => g.id === currentGroupId);
  const listNote = notes.find((note) => note.id === currentNoteId) || null;
  const listNoteHasPreview = Boolean(listNote?.bodyPreview && listNote.bodyPreview.trim().length > 0);
  const currentNote = noteDetail ?? (listNoteHasPreview && !noteDetailError ? null : listNote);
  const isNoteLoading = Boolean(
    currentNoteId &&
    ((noteDetailLoading || noteDetailFetching) ||
      (listNoteHasPreview && !noteDetail && !noteDetailError)),
  );
  const currentGroupNoteCount = currentGroupId
    ? groups.find((group) => group.id === currentGroupId)?.noteCount ?? 0
    : 0;
  const fallbackUnreadMessages = chatMessages.filter(
    (message) =>
      message.createdAt > (chatLastReadAt ?? new Date(0)) &&
      message.sender?.id !== (me?.id ?? ''),
  );
  const fallbackUnreadCount = fallbackUnreadMessages.length;
  const fallbackMentionCount = fallbackUnreadMessages.reduce((count, message) => {
    if (!me?.id) return count;
    return count + message.mentions.filter((mention) => mention.mentionedUserId === me.id).length;
  }, 0);
  const chatUnreadCount = showChatPanel
    ? 0
    : (chatUnreadCounts?.unreadCount ?? fallbackUnreadCount);
  const chatMentionCount = showChatPanel
    ? 0
    : (chatUnreadCounts?.mentionCount ?? fallbackMentionCount);

  useEffect(() => {
    mentionsMarkedRef.current = false;
  }, [chatMentionCount, currentWorkspaceId]);

  const handleMentionsOpen = useCallback(() => {
    if (!currentWorkspaceId || chatMentionCount === 0) return;
    if (markChatMentionsRead.isPending || mentionsMarkedRef.current) return;
    mentionsMarkedRef.current = true;
    markChatMentionsRead.mutate(currentWorkspaceId);
  }, [chatMentionCount, currentWorkspaceId, markChatMentionsRead]);

  const handleMentionsMarkAll = useCallback(() => {
    if (!currentWorkspaceId || chatMentionCount === 0) return;
    if (markChatMentionsRead.isPending || mentionsMarkedRef.current) return;
    mentionsMarkedRef.current = true;
    markChatMentionsRead.mutate(currentWorkspaceId);
  }, [chatMentionCount, currentWorkspaceId, markChatMentionsRead]);

  const handleMentionSelect = useCallback(
    (notification: { messageId: string }) => {
      setShowChatPanel(true);
      setChatFocusMessageId(notification.messageId);
    },
    [],
  );

  const handleRetryChatRealtime = useCallback(() => {
    setChatRealtimeEpoch((prev) => prev + 1);
  }, []);

  const noteActions = useNoteActions({
    currentWorkspaceId,
    currentGroupId,
    currentNoteId,
    setCurrentNoteId,
    openUpgradeModal,
    me,
    activeLimits,
    currentGroupNoteCount,
  });

  const handleApplyAiToNote = async (mode: 'insert' | 'replace', text: string) => {
    if (!currentNote) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const nextBody = mode === 'replace'
      ? trimmed
      : [currentNote.body || '', trimmed].filter(Boolean).join('\n\n');
    try {
      await noteActions.handleSaveNote({ ...currentNote, body: nextBody, updatedAt: new Date() });
      toast({
        title: mode === 'replace' ? 'Note updated' : 'Content inserted',
        description: `AI ${mode === 'replace' ? 'replaced' : 'inserted'} content in ${currentNote.title || 'Untitled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const activeSearchQuery = debouncedSearchQuery.trim();
  const notesListLoading =
    groupsLoading || notesLoading || (!currentGroupId && groups.length > 0 && !activeSearchQuery);
  const notesListError = Boolean(notesError || isGroupsError);
  const notesErrorMessage =
    notesErrorDetails instanceof Error ? notesErrorDetails.message : 'Unable to load notes.';
  const groupsErrorMessage =
    groupsErrorDetails instanceof Error ? groupsErrorDetails.message : 'Unable to load collections.';
  const notesListErrorMessage = notesError
    ? notesErrorMessage
    : isGroupsError
      ? groupsErrorMessage
      : 'Unable to load notes.';
  const canLoadMoreNotes = !notesListLoading && !notesListError && notes.length >= notesLimit;
  const isLoadingMoreNotes = notesFetching && notes.length > 0;
  const handleRetryNotes = useCallback(() => {
    if (isGroupsError) {
      refetchGroups();
    }
    if (notesError) {
      refetchNotes();
    }
  }, [isGroupsError, notesError, refetchGroups, refetchNotes]);

  const handleLoadMoreNotes = useCallback(() => {
    setNotesLimit((prev) => prev + NOTES_PAGE_SIZE);
  }, []);

  const handleOpenAIPanel = useCallback(() => {
    if (!isPremiumPlus) {
      openUpgradeModal('ai');
      return;
    }
    setShowAIPanel(true);
  }, [isPremiumPlus, openUpgradeModal]);

  const notesListView = useMemo(() => {
    if (isFocusMode) return null;
    if (isTablet && currentNoteId) return null;
    return (
      <NotesList
        notes={notes}
        groups={groups}
        isLoading={notesListLoading}
        isError={notesListError}
        errorMessage={notesListErrorMessage}
        onRetry={handleRetryNotes}
        searchQuery={searchQuery}
        currentNoteId={currentNoteId}
        onNoteSelect={handleNoteSelect}
        noteActions={noteActions}
        canLoadMore={canLoadMoreNotes}
        onLoadMore={handleLoadMoreNotes}
        isLoadingMore={isLoadingMoreNotes}
        className={isMobile || isTablet ? "w-full" : ""}
        style={isMobile || isTablet ? undefined : { width: notesPanelWidth }}
      />
    );
  }, [
    canLoadMoreNotes,
    currentNoteId,
    groups,
    handleLoadMoreNotes,
    handleNoteSelect,
    handleRetryNotes,
    isLoadingMoreNotes,
    isMobile,
    isTablet,
    notes,
    notesListError,
    notesListErrorMessage,
    notesListLoading,
    notesPanelWidth,
    noteActions,
    searchQuery,
  ]);

  const noteEditorView = useMemo(() => {
    if (isMobile) return null;
    if (isTablet && !currentNoteId) return null;
    return (
      <>
        {!isTablet && !isFocusMode && (
          <div
            className="group relative w-3 cursor-col-resize"
            onPointerDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize notes list"
          >
            <div className="absolute inset-y-3 left-1/2 -translate-x-1/2 w-px bg-border group-hover:bg-primary/60" />
          </div>
        )}

        <div className={isTablet ? "flex-1 min-h-0 w-full" : "flex-1 min-w-[480px] flex min-h-0"}>
          <NoteEditor
            note={currentNote}
            noteActions={noteActions}
            onOpenAIPanel={handleOpenAIPanel}
            isLoadingNote={isNoteLoading}
            plan={plan}
            canPublish={canPublishNotes}
            currentUser={me}
          />
        </div>
      </>
    );
  }, [
    canPublishNotes,
    currentNote,
    currentNoteId,
    handleOpenAIPanel,
    handleResizeStart,
    isMobile,
    isTablet,
    me,
    noteActions,
    plan,
    isNoteLoading,
  ]);

  const handleQuickCreateWorkspace = async () => {
    if (createWorkspaceInFlightRef.current) return;
    createWorkspaceInFlightRef.current = true;
    setCreateWorkspaceLocked(true);
    try {
      const workspace = await createWorkspace.mutateAsync({ name: '' });
      setCurrentWorkspaceId(workspace.id);
      setWorkspaceName('');
    } catch (error) {
      if (
        (me && activeLimits && workspaces.length >= activeLimits.workspaces) ||
        (error instanceof Error && /upgrade to premium/i.test(error.message))
      ) {
        openUpgradeModal('limits');
        return;
      }
      toast({
        title: 'Workspace not created',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      createWorkspaceInFlightRef.current = false;
      setCreateWorkspaceLocked(false);
    }
  };

  const handleCreateWorkspaceIntent = () => {
    if (createWorkspaceInFlightRef.current || createWorkspace.isPending || workspaceDialogOpen) {
      return;
    }
    if (me && activeLimits && workspaces.length >= activeLimits.workspaces) {
      openUpgradeModal('limits');
      return;
    }
    if (workspaces.length === 0) {
      void handleQuickCreateWorkspace();
      return;
    }
    setWorkspaceDialogOpen(true);
  };

  const isCreateWorkspaceLocked = createWorkspaceLocked || createWorkspace.isPending || workspaceDialogOpen;

  const handleRenameWorkspace = async (name: string) =>
    updateWorkspace.mutateAsync({ workspaceId: currentWorkspace.id, name });

  const handleDeleteWorkspace = async () => {
    await deleteWorkspace.mutateAsync(currentWorkspace.id);
    setCurrentWorkspaceId(null);
    setCurrentGroupId(null);
    setCurrentNoteId(null);
    setSearchQuery('');
  };

  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();

  const handleDeleteGroup = async (groupId: string) => {
    if (!currentWorkspaceId) return;
    const group = groups.find((item) => item.id === groupId);
    const confirmed = window.confirm(`Delete ${group?.name || 'this collection'} and archive its notes?`);
    if (!confirmed) return;
    try {
      await deleteGroup.mutateAsync({ workspaceId: currentWorkspaceId, groupId });
      if (currentGroupId === groupId) {
        setCurrentGroupId(null);
        setCurrentNoteId(null);
      }
      toast({
        title: 'Collection deleted',
        description: 'Notes in this collection were archived.',
      });
    } catch (error) {
      toast({
        title: 'Collection not deleted',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleCreateGroup = () => {
    if (!currentWorkspaceId) {
      toast({
        title: 'Workspace required',
        description: 'Create a workspace before adding collections.',
      });
      return;
    }
    if (me && activeLimits && groups.length >= activeLimits.groups) {
      openUpgradeModal('limits');
      return;
    }
    setGroupDialogOpen(true);
  };

  const handleCloseNoteModal = () => {
    setNoteModalOpen(false);
    setShowAIPanel(false);
  };

  const handleUpgrade = () => {
    setWorkspaceUpgradeOpen(false);
    navigate('/pricing');
  };

  const handleSubmitWorkspace = async () => {
    try {
      const workspace = await createWorkspace.mutateAsync({ name: workspaceName.trim() });
      setCurrentWorkspaceId(workspace.id);
      setWorkspaceName('');
      setWorkspaceDialogOpen(false);
    } catch (error) {
      if (
        (me && activeLimits && workspaces.length >= activeLimits.workspaces) ||
        (error instanceof Error && /upgrade to premium/i.test(error.message))
      ) {
        openUpgradeModal('limits');
        return;
      }
      toast({
        title: 'Workspace not created',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleSubmitGroup = async () => {
    if (!currentWorkspaceId) return;
    try {
      const group = await createGroup.mutateAsync({
        workspaceId: currentWorkspaceId,
        name: groupName.trim(),
        color: groupColor.trim(),
      });
      setCurrentGroupId(group.id);
      setGroupName('');
      setGroupDialogOpen(false);
    } catch (error) {
      if (error instanceof Error && /upgrade to premium/i.test(error.message)) {
        openUpgradeModal('limits');
        return;
      }
      toast({
        title: 'Collection not created',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const workspaceDialogElement = (
    <Suspense fallback={overlayFallback}>
      <LazyWorkspaceDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        name={workspaceName}
        onNameChange={setWorkspaceName}
        onSubmit={handleSubmitWorkspace}
        isSubmitting={createWorkspace.isPending}
      />
    </Suspense>
  );

  const groupDialogElement = (
    <Suspense fallback={overlayFallback}>
      <LazyGroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        name={groupName}
        color={groupColor}
        onNameChange={setGroupName}
        onColorChange={setGroupColor}
        onSubmit={handleSubmitGroup}
        isSubmitting={createGroup.isPending}
      />
    </Suspense>
  );

  if (workspacesLoading) {
    return <DashboardLoadingState />;
  }

  if (workspacesError) {
    const message =
      workspacesErrorDetails instanceof Error
        ? workspacesErrorDetails.message
        : 'Unable to load your workspaces.';
    return (
      <DashboardErrorState
        message={message}
        onRetry={refetchWorkspaces}
        onSignIn={() => navigate('/auth?view=login')}
      />
    );
  }

  if (workspaces.length === 0) {
    return (
      <DashboardEmptyState
        onCreateWorkspace={handleCreateWorkspaceIntent}
        dialog={workspaceDialogElement}
        isCreateWorkspaceLocked={isCreateWorkspaceLocked}
        onLogout={handleLogout}
      />
    );
  }

  if (!currentWorkspace) {
    return <DashboardWorkspacePlaceholder dialog={workspaceDialogElement} />;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background dashboard-sans">
      {!isFocusMode && (
        <Suspense fallback={sidebarFallback}>
          <LazyWorkspaceSidebar
            isMobile={isMobile}
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
            groups={groups}
            isGroupsLoading={groupsLoading}
            isGroupsError={isGroupsError}
            groupsErrorMessage={groupsErrorMessage}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            currentGroupId={currentGroupId}
            onWorkspaceChange={handleWorkspaceChange}
            onCreateWorkspace={handleCreateWorkspaceIntent}
            isCreateWorkspaceLocked={isCreateWorkspaceLocked}
            onGroupSelect={handleGroupSelect}
            onCreateGroup={handleCreateGroup}
            onDeleteGroup={handleDeleteGroup}
            isWorkspaceOwner={Boolean(isWorkspaceOwner)}
            onOpenMembers={() => setMembersDialogOpen(true)}
            onOpenSettings={handleOpenSettings}
            onOpenChat={() => setShowChatPanel(true)}
            onRetryGroups={refetchGroups}
            onOpenArchive={() => navigate(`/workspaces/${currentWorkspaceId}/trash`)}
            onLogout={handleLogout}
          />
        </Suspense>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isFocusMode && (
          <Header
            user={
              me ?? {
                id: 'unknown',
                name: 'Account',
                email: '',
                twoFactorEnabled: false,
                isSubscribed: false,
                plan: 'free',
              }
            }
            groupName={currentGroup?.name}
            onOpenSidebar={isMobile ? () => setSidebarOpen(true) : undefined}
            onOpenAIPanel={handleOpenAIPanel}
            onOpenChat={() => setShowChatPanel(true)}
            chatUnreadCount={chatUnreadCount}
            chatMentionCount={chatMentionCount}
            mentionNotifications={chatMentions}
            mentionsLoading={chatMentionsLoading}
            onMentionsOpen={handleMentionsOpen}
            onMentionsMarkAll={handleMentionsMarkAll}
            onMentionSelect={handleMentionSelect}
          />
        )}

        {showPlanDebug && me && (
          <div className="mx-6 mt-4 mb-2 rounded-xl border border-border bg-secondary/30 px-4 py-2">
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">Plan debug</span>
              <span>
                Resolved: <span className="font-semibold text-foreground">{planLabel}</span>
              </span>
              <span>
                is_subscribed:{' '}
                <span className="font-semibold text-foreground">{me.isSubscribed ? 'true' : 'false'}</span>
              </span>
              <span>
                Limits:{' '}
                <span className="font-semibold text-foreground">
                  {workspaceLimitLabel} workspaces · {groupLimitLabel} collections · {noteLimitLabel} notes
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <div className="flex h-full w-full" ref={notesLayoutRef}>
            {notesListView}
            {noteEditorView}
          </div>
        </div>
      </div>

      {workspaceDialogElement}
      {groupDialogElement}
      <Suspense fallback={overlayFallback}>
        <LazyUpgradeDialog
          open={workspaceUpgradeOpen}
          onOpenChange={setWorkspaceUpgradeOpen}
          context={upgradeContext}
          onUpgrade={handleUpgrade}
        />
      </Suspense>
      <Suspense fallback={overlayFallback}>
        <LazyMembersDialog
          open={membersDialogOpen}
          onOpenChange={setMembersDialogOpen}
          workspace={currentWorkspace}
        />
      </Suspense>
      {me && (
        <Suspense fallback={overlayFallback}>
          <LazySettingsDrawer
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            user={me}
            workspace={currentWorkspace}
            groups={groups}
            isLoading={workspacesLoading || groupsLoading || !currentWorkspace}
            canManageWorkspace={Boolean(canManageWorkspace)}
            isWorkspaceOwner={Boolean(isWorkspaceOwner)}
            onOpenMembers={() => {
              setMembersDialogOpen(true);
              setSettingsOpen(false);
            }}
            onUpdateProfile={(input) => updateProfile.mutateAsync(input)}
            onRenameWorkspace={handleRenameWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            isUpdatingProfile={updateProfile.isPending}
            isUpdatingWorkspace={updateWorkspace.isPending}
            isDeletingWorkspace={deleteWorkspace.isPending}
          />
        </Suspense>
      )}
      {!isMobile && (
        <Suspense fallback={panelFallback}>
          <LazyAIPanel
            isOpen={showAIPanel}
            onClose={() => setShowAIPanel(false)}
            noteContent={currentNote?.body || ''}
            workspaceId={currentWorkspace?.id}
            availableNotes={workspaceNotes}
            availableGroups={groups}
            currentNoteId={currentNote?.id ?? null}
            currentNote={currentNote}
            notesLimit={aiNotesLimit}
            onLoadMoreNotes={() => setAiNotesLimit((prev) => prev + 200)}
            onApplyToNote={handleApplyAiToNote}
          />
        </Suspense>
      )}
      <Suspense fallback={overlayFallback}>
        <LazyChatPanel
          isOpen={showChatPanel}
          onClose={() => setShowChatPanel(false)}
          workspaceId={currentWorkspace?.id}
          currentUser={me}
          members={members}
          lastReadAt={chatLastReadAt}
          focusMessageId={chatFocusMessageId}
          onFocusHandled={() => setChatFocusMessageId(null)}
          realtimeStatus={chatRealtimeStatus}
          onRetryRealtime={handleRetryChatRealtime}
        />
      </Suspense>
      {isMobile && (
        <Suspense fallback={overlayFallback}>
          <LazyMobileNoteSheet
            open={noteModalOpen}
            onOpenChange={(open) => (open ? setNoteModalOpen(true) : handleCloseNoteModal())}
            note={currentNote}
            noteActions={noteActions}
            plan={plan}
            canPublish={canPublishNotes}
            currentUser={me}
            isLoadingNote={isNoteLoading}
          />
        </Suspense>
      )}
      <button
        onClick={() => setIsFocusMode(!isFocusMode)}
        className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary/90 text-primary-foreground shadow-lg hover:bg-primary transition-all hover:scale-105"
        title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
      >
        {isFocusMode ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </button>
    </div>
  );
}
