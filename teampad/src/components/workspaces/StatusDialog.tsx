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
  const [editStatusEmoji, setEditStatusEmoji] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditStatusText(user.status || '');
    setEditStatusEmoji(user.statusEmoji || '');
  }, [open, user.status, user.statusEmoji]);

  const handleSaveStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextStatus = editStatusText.trim() || null;
    const nextEmoji = editStatusEmoji.trim() || null;
    try {
      await updateProfile.mutateAsync({
        status: nextStatus,
        statusEmoji: nextEmoji,
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
                      statusEmoji: nextEmoji,
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
