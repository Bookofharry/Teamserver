import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateProfile } from '@/hooks/use-data';
import type { User, WorkspaceMember } from '@/types';

interface StatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  workspaceId?: string | null;
}

export function StatusDialog({ open, onOpenChange, user, workspaceId }: StatusDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const [editStatusText, setEditStatusText] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditStatusText(user.status || '');
  }, [open, user.status]);

  const handleSaveStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextStatus = editStatusText.trim() || null;
    if (nextStatus) {
      const hasLink = /https?:\/\/|www\./i.test(nextStatus);
      const hasGlobalPing = /@everyone|@here/i.test(nextStatus);
      if (hasLink || hasGlobalPing) {
        toast({
          title: 'Status not allowed',
          description: 'Please avoid links and @everyone/@here in your status.',
          variant: 'destructive',
        });
        return;
      }
    }
    try {
      await updateProfile.mutateAsync({
        status: nextStatus,
      });
      if (workspaceId) {
        queryClient.setQueryData<WorkspaceMember[]>(
          ['workspace-members', workspaceId],
          (existing = []) =>
            existing.map((member) =>
              member.userId === user.id
                ? {
                    ...member,
                    user: {
                      ...member.user,
                      status: nextStatus,
                    },
                  }
                : member,
            ),
        );
        queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onOpenChange(false);
      toast({ title: 'Status updated', description: 'Your vibe has been shared.' });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Set your status</DialogTitle>
          <DialogDescription>
            Share your vibe with the workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveStatus} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-text">Status</Label>
            <Input
              id="status-text"
              value={editStatusText}
              onChange={(e) => setEditStatusText(e.target.value)}
              placeholder="What's your focus today?"
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground">
              You can include emojis in the text.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save Status'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
