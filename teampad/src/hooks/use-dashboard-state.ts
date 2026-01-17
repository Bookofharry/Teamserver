
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Workspace } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAuthStatus } from '@/context/auth-status';
import {
  useMe,
  useCreateWorkspace,
  useDeleteWorkspace,
  useUpdateProfile,
  useUpdateWorkspace,
  useWorkspaces,
  useGroups,
} from '@/hooks/use-data';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';
import { api } from '@/api';

export function useDashboardState() {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);

  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#0EA5E9');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [workspaceUpgradeOpen, setWorkspaceUpgradeOpen] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState<'limits' | 'ai'>('limits');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const lastWorkspaceSyncRef = useRef<string | null>(null);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const { markGuest } = useAuthStatus();

  const {
    data: workspaces = [],
    isLoading: workspacesLoading,
    isError: workspacesError,
    error: workspacesErrorDetails,
    refetch: refetchWorkspaces,
  } = useWorkspaces();
  const {
    data: groups = [],
    isLoading: groupsLoading,
    isError: groupsError,
    error: groupsErrorDetails,
    refetch: refetchGroups,
  } = useGroups(currentWorkspaceId);

  const { data: me, isLoading: meLoading, isFetching: meFetching, isFetchedAfterMount: meFetchedAfterMount } = useMe();
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const updateProfile = useUpdateProfile();
  const updateWorkspace = useUpdateWorkspace();

  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || null;

  useEffect(() => {
    if (workspaces.length === 0) return;
    const hasCurrent = Boolean(currentWorkspaceId && workspaces.some((workspace) => workspace.id === currentWorkspaceId));
    if (hasCurrent) return;
    const preferred = me?.lastWorkspaceId
      ? workspaces.find((workspace) => workspace.id === me.lastWorkspaceId)
      : null;
    setCurrentWorkspaceId(preferred?.id ?? workspaces[0].id);
  }, [currentWorkspaceId, workspaces, me?.lastWorkspaceId]);

  useEffect(() => {
    if (!currentWorkspaceId || !me?.id) return;
    if (me.lastWorkspaceId === currentWorkspaceId) return;
    if (lastWorkspaceSyncRef.current === currentWorkspaceId) return;
    lastWorkspaceSyncRef.current = currentWorkspaceId;
    updateProfile.mutate({ lastWorkspaceId: currentWorkspaceId });
  }, [currentWorkspaceId, me?.id, me?.lastWorkspaceId, updateProfile]);

  useEffect(() => {
    if (!currentWorkspaceId) {
      setCurrentGroupId(null);
      return;
    }
    const generalGroup = groups.find((group) => group.name === 'General Collection') || null;
    const nextGroupId = generalGroup?.id ?? groups[0]?.id ?? null;
    setCurrentGroupId((prev) => (prev && groups.some((group) => group.id === prev) ? prev : nextGroupId));
  }, [currentWorkspaceId, groups]);

  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['note'] });
  }, [currentWorkspaceId, queryClient]);

  useEffect(() => {
    if (!isMobile && noteModalOpen) {
      setNoteModalOpen(false);
    }
  }, [isMobile, noteModalOpen]);

  const openUpgradeModal = (context: 'limits' | 'ai') => {
    setUpgradeContext(context);
    setWorkspaceUpgradeOpen(true);
  };

  const handleLogout = async () => {
    try {
      await api.clearSession();
    } catch (e) {
      // Ignore errors, force logout anyway
    }
    // Ensure local token is gone (matches key in restApi.ts)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("teampad_token");
    }
    queryClient.clear(); // Clear all cached data (User, Workspaces)
    markGuest();
    setSidebarOpen(false);
    // Hard reload to ensure clean state (Socket connections, etc)
    window.location.href = '/auth?view=login';
  };

  const handleWorkspaceChange = (workspace: Workspace) => {
    setCurrentWorkspaceId(workspace.id);
    setCurrentNoteId(null);
    if (isMobile) setSidebarOpen(false);
    setNoteModalOpen(false);
    setSearchQuery('');
  };

  const handleGroupSelect = (groupId: string) => {
    setCurrentGroupId(groupId);
    setCurrentNoteId(null);
    if (isMobile) setSidebarOpen(false);
    setNoteModalOpen(false);
    setSearchQuery('');
  };

  const handleNoteSelect = (noteId: string) => {
    setCurrentNoteId(noteId);
    if (isMobile) setNoteModalOpen(true);
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    if (isMobile) setSidebarOpen(false);
  };

  return {
    isMobile,
    isTablet,
    me,
    meLoading: meLoading || meFetching || !meFetchedAfterMount,

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
    isGroupsError: groupsError,
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
    handleGroupSelect,
    handleNoteSelect,

    // Dialogs
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

    // Actions
    createWorkspace,
    deleteWorkspace,
    updateProfile,
    updateWorkspace,
    handleLogout,
    handleOpenSettings,

    queryClient,
    toast,
    navigate
  };
}
