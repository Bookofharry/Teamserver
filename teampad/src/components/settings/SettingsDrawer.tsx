import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAcceptInvite, useDeclineInvite, useMyInvites } from '@/hooks/use-data';
import { ColorizedText } from '@/components/ui/colorized-text';
import { sanitizeEmail } from '@/lib/sanitize';
import { api } from '@/api';
import type { Group, User, Workspace } from '@/types';

interface SettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  workspace: Workspace;
  groups: Group[];
  canManageWorkspace: boolean;
  isWorkspaceOwner: boolean;
  onOpenMembers: () => void;
  onUpdateProfile: (input: { name: string; avatar: string }) => Promise<User>;
  onRenameWorkspace: (name: string) => Promise<Workspace>;
  onDeleteWorkspace: () => Promise<void>;
  isLoading?: boolean;
  isUpdatingProfile: boolean;
  isUpdatingWorkspace: boolean;
  isDeletingWorkspace: boolean;
}

export function SettingsDrawer({
  open,
  onOpenChange,
  user,
  workspace,
  groups,
  canManageWorkspace,
  isWorkspaceOwner,
  onOpenMembers,
  onUpdateProfile,
  onRenameWorkspace,
  onDeleteWorkspace,
  isLoading = false,
  isUpdatingProfile,
  isUpdatingWorkspace,
  isDeletingWorkspace,
}: SettingsDrawerProps) {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar ?? '');
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [defaultGroup, setDefaultGroup] = useState('');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [inviteAction, setInviteAction] = useState<null | { token: string; type: 'accept' | 'decline' }>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<'server' | 'mock' | 'gemini'>('server');

  const handleWorkspaceNameChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z ]/g, '').slice(0, 15);
    setWorkspaceName(cleaned);
  };

  const themeKey = `teampad-theme:${user.id}`;
  const timeKey = `teampad-time-format:${user.id}`;
  const groupKey = `teampad-default-group:${workspace.id}`;
  const aiProviderKey = "teampad-ai-provider";

  const {
    data: invites = [],
    isLoading: isInvitesLoading,
    isError: isInvitesError,
    error: invitesError,
  } = useMyInvites(open);
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

  useEffect(() => {
    setName(user.name);
    setAvatar(user.avatar ?? '');
  }, [user.name, user.avatar, open]);

  useEffect(() => {
    setWorkspaceName(workspace.name);
  }, [workspace.name, open]);

  useEffect(() => {
    const storedFormat = localStorage.getItem(timeKey);
    setTimeFormat(storedFormat === '24h' ? '24h' : '12h');
  }, [timeKey, open]);

  useEffect(() => {
    const storedGroup = localStorage.getItem(groupKey);
    setDefaultGroup(storedGroup ?? '');
  }, [groupKey, open]);

  useEffect(() => {
    if (!open) return;
    const storedProvider = localStorage.getItem(aiProviderKey);
    if (storedProvider === 'mock' || storedProvider === 'gemini' || storedProvider === 'server') {
      setAiProvider(storedProvider);
    } else {
      setAiProvider('server');
    }
  }, [open, aiProviderKey]);

  const hasProfileChanges = name.trim() !== user.name || avatar !== (user.avatar ?? '');
  const hasWorkspaceChanges = workspaceName.trim() !== workspace.name;

  const groupOptions = useMemo(
    () => groups.filter((group) => group.workspaceId === workspace.id),
    [groups, workspace.id],
  );

  const planInfo = useMemo(() => {
    const plans = {
      free: {
        label: 'Free',
        summary: 'Starter access for small teams.',
        detail: 'Upgrade to unlock higher limits and advanced controls.',
      },
      premium: {
        label: 'Premium',
        summary: '3 workspaces · 20 collections · 200 notes per collection',
        detail: 'More room to scale and richer formatting.',
      },
      premium_plus: {
        label: 'Premium+',
        summary: 'Unlimited workspaces, collections, and notes',
        detail: 'TeamPad AI, public notes, audit trail, and priority support.',
      },
    } as const;

    return plans[user.plan] ?? plans.free;
  }, [user.plan]);

  const planCards = useMemo(
    () => [
      {
        id: 'free',
        label: 'Free',
        price: '$0',
        summary: '1 workspace · 5 collections · 8 notes per collection',
        detail: 'Core collaboration tools, basic roles, and invites.',
      },
      {
        id: 'premium',
        label: 'Premium',
        price: '$15/mo',
        summary: '3 workspaces · 20 collections · 200 notes per collection',
        detail: 'Richer editor tools and stronger team controls.',
      },
      {
        id: 'premium_plus',
        label: 'Premium+',
        price: '$25/mo',
        summary: 'Unlimited workspaces, collections, and notes',
        detail: 'TeamPad AI, public notes, advanced security, and priority support.',
      },
    ],
    [],
  );

  const handleSaveProfile = async () => {
    try {
      const updated = await onUpdateProfile({ name: name.trim(), avatar: avatar.trim() });
      setName(updated.name);
      setAvatar(updated.avatar ?? '');
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Profile not updated',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleSaveWorkspace = async () => {
    try {
      const updated = await onRenameWorkspace(workspaceName.trim());
      setWorkspaceName(updated.name);
      toast({
        title: 'Workspace updated',
        description: 'The workspace name has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Workspace not updated',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleAcceptInvite = async (token: string) => {
    setInviteAction({ token, type: 'accept' });
    try {
      await acceptInvite.mutateAsync(token);
      toast({
        title: 'Invite accepted',
        description: 'You can now access this workspace.',
      });
    } catch (error) {
      toast({
        title: 'Invite not accepted',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setInviteAction(null);
    }
  };

  const handleDeclineInvite = async (token: string) => {
    setInviteAction({ token, type: 'decline' });
    try {
      await declineInvite.mutateAsync(token);
      toast({
        title: 'Invite declined',
        description: 'The invite has been declined.',
      });
    } catch (error) {
      toast({
        title: 'Invite not declined',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setInviteAction(null);
    }
  };

  const handleResetPassword = async () => {
    const safeEmail = sanitizeEmail(user.email);
    if (!safeEmail) {
      toast({
        title: 'Email required',
        description: 'Add an email to your profile before resetting your password.',
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      await api.forgotPassword(safeEmail);
    } catch (error) {
      toast({
        title: 'Reset failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
      setIsResettingPassword(false);
      return;
    }

    toast({
      title: 'Reset email sent',
      description: 'Check your inbox to continue.',
    });
    setIsResettingPassword(false);
  };

  const handleDeleteWorkspace = async () => {
    if (isDeletingWorkspace || isDeletingLocal) return;
    setIsDeletingLocal(true);
    try {
      await onDeleteWorkspace();
      setDeleteOpen(false);
      onOpenChange(false);
      toast({
        title: 'Workspace deleted',
        description: 'The workspace has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Workspace not deleted',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsDeletingLocal(false);
    }
  };

  const handleTimeFormat = (value: '12h' | '24h') => {
    setTimeFormat(value);
    localStorage.setItem(timeKey, value);
  };

  const handleDefaultGroup = (value: string) => {
    setDefaultGroup(value);
    localStorage.setItem(groupKey, value);
  };

  const handleAiProvider = (value: 'server' | 'mock' | 'gemini') => {
    setAiProvider(value);
    localStorage.setItem(aiProviderKey, value);
    toast({
      title: 'AI provider preference updated',
      description: 'TeamPad will send this preference with AI requests.',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[540px] flex flex-col h-full p-0 border-l border-border bg-background/95 backdrop-blur-xl"
      >
        <div className="flex-1 overflow-y-auto p-6">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-lg font-semibold tracking-tight">Settings</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Tune your profile, workspace, and preferences.
            </SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="mt-6 space-y-8">
              <section className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <div className="space-y-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <div className="flex justify-end">
                    <Skeleton className="h-9 w-28" />
                  </div>
                </div>
              </section>
              <section className="space-y-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-20 w-full" />
              </section>
              <section className="space-y-4">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-24 w-full" />
              </section>
              <section className="space-y-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-20 w-full" />
              </section>
            </div>
          ) : (
            <div className="mt-6 space-y-6 pb-10">
              <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Profile</p>
                    <p className="text-xs text-muted-foreground">Manage your personal information.</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                    {user.plan === 'premium_plus' ? 'Premium+' : user.plan}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="settings-name">Name</Label>
                    <Input id="settings-name" value={name} disabled className="bg-muted/40" />
                    <p className="text-xs text-muted-foreground">Contact support to change your name.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-email">Email</Label>
                    <Input id="settings-email" value={user.email} disabled className="bg-muted/40" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings-avatar">Avatar URL</Label>
                    <Input
                      id="settings-avatar"
                      value={avatar}
                      onChange={(event) => setAvatar(event.target.value)}
                      placeholder="https://"
                      className="bg-muted/40"
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={!hasProfileChanges || isUpdatingProfile}
                      className="min-w-[140px]"
                    >
                      {isUpdatingProfile ? 'Saving...' : 'Save profile'}
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Plan</p>
                    <p className="text-xs text-muted-foreground">Your current access level and limits.</p>
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                    Current
                  </span>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-foreground">{planInfo.label}</p>
                  <p className="text-xs text-muted-foreground">{planInfo.summary}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{planInfo.detail}</p>
                    <Button size="sm" variant="outline" onClick={() => setPlanModalOpen(true)}>
                      View plans
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Workspace</p>
                    <p className="text-xs text-muted-foreground">Manage the active workspace.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={onOpenMembers}>
                    Members
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace name</Label>
                    <Input
                      id="workspace-name"
                      value={workspaceName}
                      onChange={(event) => handleWorkspaceNameChange(event.target.value)}
                      maxLength={15}
                      disabled={!canManageWorkspace}
                      className="bg-muted/40"
                    />
                    {canManageWorkspace ? (
                      <p className="text-xs text-muted-foreground">Letters and spaces only, max 15 characters.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Only owners or admins can rename.</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      onClick={handleSaveWorkspace}
                      disabled={!hasWorkspaceChanges || !canManageWorkspace || isUpdatingWorkspace}
                      className="min-w-[150px]"
                    >
                      {isUpdatingWorkspace ? 'Saving...' : 'Save workspace'}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!isWorkspaceOwner}
                      onClick={() => setDeleteOpen(true)}
                      className="min-w-[120px]"
                    >
                      Delete
                    </Button>
                  </div>
                  {(isInvitesLoading || isInvitesError || invites.length > 0) && (
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">Pending invites</p>
                        {isInvitesLoading && <span className="text-[11px] text-muted-foreground">Loading…</span>}
                      </div>
                      {isInvitesError && (
                        <p className="text-xs text-destructive">
                          {invitesError instanceof Error ? invitesError.message : 'Failed to load invites.'}
                        </p>
                      )}
                      {!isInvitesLoading && !isInvitesError && invites.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {invites.map((invite) => (
                            <div
                              key={invite.id}
                              className="flex flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{invite.workspaceName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Invited by{' '}
                                  <span className="font-medium">
                                    <ColorizedText text={invite.inviter?.name || 'TeamPad'} />
                                  </span>{' '}
                                  · {invite.role}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
                                <span className="text-xs text-muted-foreground">
                                  Expires {invite.expiresAt.toLocaleDateString()}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAcceptInvite(invite.token)}
                                    disabled={inviteAction?.token === invite.token}
                                  >
                                    {inviteAction?.token === invite.token && inviteAction.type === 'accept'
                                      ? 'Accepting...'
                                      : 'Accept'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeclineInvite(invite.token)}
                                    disabled={inviteAction?.token === invite.token}
                                  >
                                    {inviteAction?.token === invite.token && inviteAction.type === 'decline'
                                      ? 'Declining...'
                                      : 'Decline'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Preferences</p>
                  <p className="text-xs text-muted-foreground">Personalize your workspace experience.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 sm:col-span-2">
                    <Label>Theme</Label>
                    <div className="flex gap-2">
                      {['system', 'light', 'dark'].map((value) => (
                        <Button
                          key={value}
                          variant={theme === value ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setTheme(value);
                            localStorage.setItem(themeKey, value);
                          }}
                        >
                          {value.charAt(0).toUpperCase() + value.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <Label>Time format</Label>
                    <Select value={timeFormat} onValueChange={(value) => handleTimeFormat(value as '12h' | '24h')}>
                      <SelectTrigger className="bg-background/70">
                        <SelectValue placeholder="Choose format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12-hour</SelectItem>
                        <SelectItem value="24h">24-hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3">
                    <Label>Default collection</Label>
                    <Select value={defaultGroup} onValueChange={handleDefaultGroup}>
                      <SelectTrigger className="bg-background/70">
                        <SelectValue placeholder="Pick a default collection" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupOptions.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used when creating new notes in this workspace.
                    </p>
                  </div>
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 sm:col-span-2">
                    <Label>AI provider</Label>
                    <Select value={aiProvider} onValueChange={(value) => handleAiProvider(value as 'server' | 'mock' | 'gemini')}>
                      <SelectTrigger className="bg-background/70">
                        <SelectValue placeholder="Choose provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="server">Server default</SelectItem>
                        <SelectItem value="mock">Mock</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Preference only. The server may override based on environment config.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Security</p>
                    <p className="text-xs text-muted-foreground">Protect your account with stronger controls.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Two-factor authentication</p>
                      <p className="text-xs text-muted-foreground">Coming soon for TeamPad Premium.</p>
                    </div>
                    <Switch disabled />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleResetPassword} disabled={isResettingPassword}>
                      {isResettingPassword ? 'Sending reset link...' : 'Reset password'}
                    </Button>
                    <Button variant="outline" disabled>
                      Sign out everywhere (coming soon)
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWorkspace || isDeletingLocal}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeletingWorkspace || isDeletingLocal} onClick={handleDeleteWorkspace}>
              {isDeletingWorkspace || isDeletingLocal ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={planModalOpen} onOpenChange={setPlanModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>TeamPad plans</DialogTitle>
            <DialogDescription>Pick the tier that matches your team today.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {planCards.map((plan) => {
              const isCurrent = plan.id === user.plan;
              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-4 ${isCurrent ? 'border-foreground' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{plan.label}</p>
                      <p className="text-xs text-muted-foreground">{plan.price}</p>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full border border-foreground px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.summary}</p>
                  <p className="text-xs text-muted-foreground mt-2">{plan.detail}</p>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            {user.plan === 'premium_plus' ? (
              <Button variant="success" disabled>
                Premium+ active
              </Button>
            ) : (
              <Button variant="success" asChild>
                <Link to="/pricing">Upgrade</Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Sheet >
  );
}
