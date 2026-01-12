import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: 'limits' | 'ai';
  onUpgrade: () => void;
}

export function UpgradeDialog({ open, onOpenChange, context, onUpgrade }: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {context === 'ai' ? 'Unlock TeamPad AI' : 'Choose a TeamPad plan'}
          </DialogTitle>
          <DialogDescription>
            {context === 'ai'
              ? 'TeamPad AI is available on Premium+. Upgrade to unlock AI along with higher limits and advanced controls.'
              : 'Free includes 1 workspace, 5 collections, and 8 notes per collection. Premium and Premium+ unlock higher limits and advanced controls.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-sm font-medium text-foreground">Premium+ plan</p>
            <p className="text-sm text-muted-foreground">
              {context === 'ai'
                ? '$25/mo · Includes TeamPad AI, public sharing, audit trail, and priority support.'
                : '$25/mo · Unlimited workspaces, collections, and notes with TeamPad AI, public sharing, audit trail, and priority support.'}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Premium plan</p>
            <p className="text-sm text-muted-foreground">
              $15/mo · 3 workspaces, 20 collections, 200 notes per collection, richer editor tools, and upgraded team controls.
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Free plan</p>
            <p className="text-sm text-muted-foreground">
              $0 · 1 workspace, 5 collections, 8 notes per collection, and core collaboration tools.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={onUpgrade}>Upgrade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
