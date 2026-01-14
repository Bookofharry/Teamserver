import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, SmilePlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorizedText } from '@/components/ui/colorized-text';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  useCreateInvite,
  useMe,
  useRemoveWorkspaceMember,
  useLeaveWorkspace,
  useWorkspaceInvites,
  useWorkspaceMembers,
  useUpdateProfile,
} from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { sanitizeEmail } from '@/lib/sanitize';
import type { UserRole, Workspace, WorkspaceMember } from '@/types';

interface MembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
}

export function MembersDialog({ open, onOpenChange, workspace }: MembersDialogProps) {
  const { toast } = useToast();
  const { data: members = [], isLoading } = useWorkspaceMembers(workspace.id, open);
  const { data: me } = useMe(open);
  const navigate = useNavigate();
  const createInvite = useCreateInvite();
  const removeMember = useRemoveWorkspaceMember();
  const leaveWorkspace = useLeaveWorkspace();
  const updateProfile = useUpdateProfile();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Status State
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editStatusText, setEditStatusText] = useState('');
  const [editStatusEmoji, setEditStatusEmoji] = useState('');

  useEffect(() => {
    if (statusDialogOpen && me) {
      setEditStatusText(me.status || '');
      setEditStatusEmoji(me.statusEmoji || '');
    }
  }, [statusDialogOpen, me]);

  const handleSaveStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({
        status: editStatusText.trim() || null,
        statusEmoji: editStatusEmoji.trim() || null,
      });
      setStatusDialogOpen(false);
      toast({ title: 'Status updated', description: 'Your vibe has been shared.' });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setEmail('');
      setRole('member');
      setShowInviteForm(false);
    }
  }, [open]);

  useEffect(() => {
    if (!showInviteForm) {
      setEmail('');
      setRole('member');
    }
  }, [showInviteForm]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (a.role !== 'owner' && b.role === 'owner') return 1;
      return a.user.name.localeCompare(b.user.name);
    });
  }, [members]);

  const currentRole = useMemo(() => {
    if (!me?.id) return null;
    return members.find((member) => member.userId === me.id)?.role ?? null;
  }, [members, me?.id]);

  const canInvite = currentRole === 'owner' || currentRole === 'admin';
  const {
    data: invites = [],
    isLoading: isInvitesLoading,
    isError: isInvitesError,
    error: invitesError,
  } = useWorkspaceInvites(workspace.id, open && canInvite);
  const isInitialLoading = isLoading || (canInvite && isInvitesLoading);
  const ownerCount = useMemo(
    () => members.filter((member) => member.role === 'owner').length,
    [members],
  );
  const memberNameMap = useMemo(() => {
    return new Map(members.map((member) => [member.userId, member.user.name]));
  }, [members]);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const safeEmail = sanitizeEmail(email);
    if (!safeEmail) {
      toast({ title: 'Email required', description: 'Enter a valid email address.' });
      return;
    }
    try {
      const invite = await createInvite.mutateAsync({
        workspaceId: workspace.id,
        email: safeEmail,
        role,
      });
      setShowInviteForm(false);
      setEmail('');
      toast({
        title: 'Invite created',
        description: `Invite sent to ${invite.email}. Copy the link from pending invites.`,
      });
    } catch (error) {
      toast({
        title: 'Invite failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyInvite = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Invite link copied' });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Copy the link manually for now.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    const confirmed = window.confirm(`Remove ${member.user.name} from ${workspace.name}?`);
    if (!confirmed) return;
    try {
      await removeMember.mutateAsync({ workspaceId: workspace.id, userId: member.userId });
      toast({
        title: 'Member removed',
        description: `${member.user.name} no longer has access.`,
      });
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleLeaveWorkspace = async () => {
    const confirmed = window.confirm(`Are you sure you want to leave ${workspace.name}?`);
    if (!confirmed) return;
    try {
      await leaveWorkspace.mutateAsync(workspace.id);
      toast({
        title: 'Left workspace',
        description: `You left ${workspace.name}.`,
      });
      onOpenChange(false);
      navigate('/');
    } catch (error) {
      toast({
        title: 'Failed to leave',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[520px] rounded-2xl w-full translate-x-[-50%] translate-y-[-50%] left-[50%] top-[50%] p-6">
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            {canInvite ? 'Manage' : 'View'} people in{' '}
            <span className="font-medium text-foreground">{workspace.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isInitialLoading && (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Loading members and invites...
            </div>
          )}

          {!isInitialLoading && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                  <span>{sortedMembers.length} members</span>
                </div>
                <div className="space-y-2">
                  {isLoading && (
                    <div className="text-sm text-muted-foreground">Loading members...</div>
                  )}
                  {!isLoading &&
                    sortedMembers.map((member) => {
                      const isYou = me?.id && member.userId === me.id;
                      const canRemove =
                        currentRole === 'owner'
                          ? !isYou && (member.role !== 'owner' || ownerCount > 1)
                          : currentRole === 'admin'
                            ? !isYou && member.role === 'member'
                            : false;
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              <ColorizedText text={member.user.name} />
                              {isYou && <span className="ml-2 text-xs text-muted-foreground">(You)</span>}
                              {isYou && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 ml-1 text-muted-foreground hover:text-foreground"
                                  onClick={() => setStatusDialogOpen(true)}
                                  title="Set status"
                                >
                                  <SmilePlus className="h-3 w-3" />
                                </Button>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {member.user.email}
                              {(member.user.status || member.user.statusEmoji) && (
                                <>
                                  <span className="mx-1">·</span>
                                  <span className="text-foreground">
                                    {member.user.statusEmoji} {member.user.status}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                member.role === 'owner'
                                  ? 'bg-red-100 text-red-800 border border-red-200 capitalize'
                                  : member.role === 'admin'
                                    ? 'bg-green-100 text-green-800 border border-green-200 capitalize'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200 capitalize'
                              }
                            >
                              {member.role}
                            </Badge>
                            {canRemove && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveMember(member)}
                                disabled={removeMember.isPending}
                              >
                                Remove
                              </Button>
                            )}
                            {isYou && (currentRole !== 'owner' || ownerCount > 1) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleLeaveWorkspace}
                                disabled={leaveWorkspace.isPending}
                              >
                                Leave
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <Separator />

              {canInvite && (isInvitesLoading || isInvitesError || invites.length > 0) ? (
                <>
                  <div className="space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Pending invites</h3>
                      <p className="text-xs text-muted-foreground">Awaiting acceptance.</p>
                    </div>
                    {isInvitesLoading && (
                      <p className="text-sm text-muted-foreground">Loading invites...</p>
                    )}
                    {isInvitesError && (
                      <p className="text-sm text-destructive">
                        {invitesError instanceof Error ? invitesError.message : 'Failed to load invites.'}
                      </p>
                    )}
                    {!isInvitesLoading && !isInvitesError && invites.length > 0 && (
                      <div className="space-y-2">
                        {invites.map((invite) => {
                          const inviterName =
                            invite.createdBy && invite.createdBy === me?.id
                              ? 'You'
                              : invite.createdBy
                                ? memberNameMap.get(invite.createdBy) || 'TeamPad'
                                : 'TeamPad';
                          return (
                            <div
                              key={invite.id}
                              className="flex flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">{invite.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  Invited by{' '}
                                  <span className="font-medium">
                                    <ColorizedText text={inviterName} />
                                  </span>{' '}
                                  · {invite.role}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
                                <span className="text-xs text-muted-foreground">
                                  Expires {invite.expiresAt.toLocaleDateString()}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyInvite(invite.token)}
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy link
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Separator />
                </>
              ) : null}

              {canInvite ? (
                <>
                  <div className="space-y-3">
                    <Button type="button" variant="outline" onClick={() => setShowInviteForm(true)}>
                      Add member
                    </Button>
                    <Dialog open={showInviteForm} onOpenChange={setShowInviteForm}>
                      <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-[420px] rounded-2xl w-full translate-x-[-50%] translate-y-[-50%] left-[50%] top-[50%] p-6">
                        <DialogHeader>
                          <DialogTitle>Add member</DialogTitle>
                          <DialogDescription>Send an invite to join this workspace.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleInvite} className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="invite-email">Invite by email</Label>
                            <Input
                              id="invite-email"
                              type="email"
                              placeholder="name@company.com"
                              value={email}
                              onChange={(event) => setEmail(event.target.value)}
                              autoComplete="email"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                {currentRole === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createInvite.isPending}>
                              {createInvite.isPending ? 'Sending invite...' : 'Send invite'}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Set your status</DialogTitle>
            <DialogDescription>
              Share your vibe with the workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveStatus} className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-2">
              <div className="space-y-2">
                <Label htmlFor="status-emoji">Emoji</Label>
                <Input
                  id="status-emoji"
                  value={editStatusEmoji}
                  onChange={(e) => setEditStatusEmoji(e.target.value)}
                  placeholder="👋"
                  className="text-center text-lg"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-text">Message</Label>
                <Input
                  id="status-text"
                  value={editStatusText}
                  onChange={(e) => setEditStatusText(e.target.value)}
                  placeholder="What's your focus today?"
                  maxLength={40}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving...' : 'Save Status'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
