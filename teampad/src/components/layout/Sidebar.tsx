import { useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, FolderOpen, Settings, Search, Users, LogOut, X, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, getUserColor } from '@/lib/utils';
import type { Workspace, Group, WorkspaceMember } from '@/types';

interface SidebarProps {
  className?: string;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  groups: Group[];
  isGroupsLoading: boolean;
  isGroupsError: boolean;
  groupsErrorMessage: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  currentGroupId: string | null;
  onWorkspaceChange: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onGroupSelect: (groupId: string) => void;
  onCreateGroup: () => void;
  onDeleteGroup: (groupId: string) => void;
  isWorkspaceOwner: boolean;
  onOpenMembers: () => void;
  onOpenArchive?: () => void;
  onOpenSettings: () => void;
  onOpenChat?: () => void;
  onOpenStatus?: () => void;
  onRetryGroups: () => void;
  onLogout: () => void;
  isCreateWorkspaceLocked?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  members?: WorkspaceMember[];
  currentUserId?: string | null;
}

export function Sidebar({
  className,
  workspaces,
  currentWorkspace,
  groups,
  isGroupsLoading,
  isGroupsError,
  groupsErrorMessage,
  searchQuery,
  onSearchChange,
  currentGroupId,
  onWorkspaceChange,
  onCreateWorkspace,
  onGroupSelect,
  onCreateGroup,
  onDeleteGroup,
  isWorkspaceOwner,
  onOpenMembers,
  onOpenArchive,
  onOpenSettings,
  onOpenChat,
  onOpenStatus,
  onRetryGroups,
  onLogout,
  isCreateWorkspaceLocked,
  collapsed = false,
  onToggleCollapse,
  members = [],
  currentUserId = null,
}: SidebarProps) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [showWorkspaceName, setShowWorkspaceName] = useState(!collapsed);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceNameTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!workspaceMenuRef.current) return;
      if (workspaceMenuRef.current.contains(event.target as Node)) return;
      setWorkspaceMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWorkspaceMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [workspaceMenuOpen]);

  useEffect(() => {
    if (workspaceNameTimerRef.current) {
      window.clearTimeout(workspaceNameTimerRef.current);
      workspaceNameTimerRef.current = null;
    }
    if (collapsed) {
      setShowWorkspaceName(false);
      return;
    }
    workspaceNameTimerRef.current = window.setTimeout(() => {
      setShowWorkspaceName(true);
      workspaceNameTimerRef.current = null;
    }, 1000);
  }, [collapsed]);

  const workspaceGroups = groups.filter(g => g.workspaceId === currentWorkspace.id);
  const pulseMembers = members
    .filter((member) => member.user?.status || member.user?.statusEmoji)
    .slice(0, 4);
  const showLabels = !collapsed;
  const workspaceInitial = currentWorkspace.name.trim().charAt(0) || 'W';

  return (
    <aside
      className={cn(
        "h-[100dvh] bg-sidebar flex flex-col transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
        className,
      )}
    >
      <div className={cn("px-4 pt-4 pb-5", collapsed && "px-3")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "justify-between")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-4 pr-2")}>
            <img
              src="/teampad-logo.png"
              alt="TeamPad logo"
              className={cn(
                "w-10 h-10 rounded-xl bg-[#111217] p-[5px] object-contain",
                collapsed && "w-9 h-9",
              )}
            />
            {showLabels && <span className="teampad-wordmark pr-3 dashboard-display">TeamPad</span>}
          </div>
          {onToggleCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn("h-8 w-8", collapsed && "mt-1")}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Workspace Switcher */}
      <div ref={workspaceMenuRef} className={cn("relative p-4", collapsed && "px-2")}>
        {showLabels && (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Workspace
          </p>
        )}
        <button
          onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
          className={cn(
            "w-full flex items-center p-2 rounded-xl hover:bg-sidebar-accent transition-colors group",
            showLabels ? "justify-between" : "justify-center",
          )}
          aria-label="Workspace switcher"
        >
          <div className={cn("flex items-center", showLabels ? "gap-3" : "justify-center")}>
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {workspaceInitial}
              </span>
            </div>
            {showLabels && showWorkspaceName && (
              <span className="text-sm font-medium text-sidebar-foreground">{currentWorkspace.name}</span>
            )}
          </div>
          {showLabels && (
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                workspaceMenuOpen && "rotate-180",
              )}
            />
          )}
        </button>

        {workspaceMenuOpen && (
          <div
            className={cn(
              "mt-2 py-1 bg-popover rounded-xl animate-scale-in shadow-lg",
              collapsed && "absolute left-full top-0 ml-2 mt-0 w-60 z-20",
            )}
          >
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => {
                  onWorkspaceChange(ws);
                  setWorkspaceMenuOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors",
                  ws.id === currentWorkspace.id && "bg-accent"
                )}
              >
                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">{ws.name.charAt(0)}</span>
                </div>
                {ws.name}
              </button>
            ))}
            <div className="my-1" />
            <button
              onClick={() => {
                setWorkspaceMenuOpen(false);
                onCreateWorkspace();
              }}
              disabled={isCreateWorkspaceLocked}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Create Workspace
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="p-4">
        {showLabels ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search notes..."
              className="h-9 pl-9 pr-8 text-sm bg-secondary border-transparent focus-visible:ring-1 focus-visible:ring-primary/40"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => onSearchChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="w-full"
            onClick={onToggleCollapse}
            title="Expand to search"
            aria-label="Expand sidebar to search"
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Collections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
        <div className={cn("flex items-center justify-between px-2 py-2", collapsed && "justify-center")}>
          {showLabels && (
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.25em]">
              Collections
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCreateGroup}
            className={cn("h-6 w-6", collapsed && "h-8 w-8")}
            disabled={isGroupsLoading || isGroupsError}
            title="Create collection"
            aria-label="Create collection"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <nav className="space-y-1">
          {isGroupsLoading && (
            <div className="space-y-2 px-2">
              {[...Array(4)].map((_, index) => (
                <div key={`group-skeleton-${index}`} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  {showLabels && <Skeleton className="h-4 flex-1" />}
                  {showLabels && <Skeleton className="h-3 w-6" />}
                </div>
              ))}
            </div>
          )}
          {!isGroupsLoading && isGroupsError && (
            <div className="px-2 py-3 text-sm text-muted-foreground space-y-2">
              <p>{groupsErrorMessage}</p>
              <Button variant="outline" size="sm" onClick={onRetryGroups}>
                Retry
              </Button>
            </div>
          )}
          {!isGroupsLoading &&
            !isGroupsError &&
            workspaceGroups.map(group => (
              <div
                key={group.id}
                className={cn(
                  "group w-full flex items-center gap-3 rounded-xl text-sm transition-all",
                  showLabels ? "px-3 py-2" : "px-2 py-2 justify-center",
                  currentGroupId === group.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <button
                  onClick={() => onGroupSelect(group.id)}
                  className={cn("flex items-center flex-1 text-left", showLabels ? "gap-3" : "justify-center")}
                  title={group.name}
                  aria-label={`Open ${group.name}`}
                >
                  <FolderOpen
                    className="w-4 h-4"
                    style={{ color: group.color || 'currentColor' }}
                  />
                  {showLabels && (
                    <>
                      <span className="flex-1 text-left truncate text-xs sm:text-sm" title={group.name}>
                        {group.name}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{group.noteCount}</span>
                    </>
                  )}
                </button>
                {showLabels && isWorkspaceOwner && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteGroup(group.id);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Delete ${group.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
        </nav>
      </div>

      {showLabels && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            <span>Team Pulse</span>
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          </div>
          <div className="mt-2 space-y-2">
            {pulseMembers.length > 0 ? (
              pulseMembers.map((member) => {
                const name = member.user?.name || "Member";
                const initial = name.trim().charAt(0).toUpperCase() || "M";
                const statusEmoji = member.user?.statusEmoji || "";
                const statusText = member.user?.status || "";
                const isYou = currentUserId && member.userId === currentUserId;
                return (
                  <div key={member.id} className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold", getUserColor(name))}>
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {name}{isYou ? " (you)" : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {statusEmoji} {statusText}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No statuses yet. Set yours to kick it off.
              </p>
            )}
            <button
              onClick={onOpenStatus ?? onOpenMembers}
              className="w-full rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors"
            >
              Set your status
            </button>
          </div>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="p-4 space-y-1">
        {onOpenArchive && (
          <Link
            to={currentWorkspace ? `/workspaces/${currentWorkspace.id}/trash` : '#'}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
              showLabels ? "gap-3" : "justify-center",
            )}
            title="Archive"
            aria-label="Archive"
          >
            <Trash2 className="w-4 h-4" />
            {showLabels && <span>Trash</span>}
          </Link>
        )}
        <button
          onClick={onOpenMembers}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            showLabels ? "gap-3" : "justify-center",
          )}
          title="Members"
          aria-label="Members"
        >
          <Users className="w-4 h-4" />
          {showLabels && <span>Members</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-xl text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            showLabels ? "gap-3" : "justify-center",
          )}
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
          {showLabels && <span>Settings</span>}
        </button>
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors",
            showLabels ? "gap-3" : "justify-center",
          )}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {showLabels && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
