import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  color: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function WorkspaceDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  onSubmit,
  isSubmitting,
}: WorkspaceDialogProps) {
  const handleWorkspaceNameChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z ]/g, '').slice(0, 15);
    onNameChange(cleaned);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>Letters and spaces only, max 15 characters.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => handleWorkspaceNameChange(event.target.value)}
            placeholder="e.g. TeamPad"
            maxLength={15}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupDialog({
  open,
  onOpenChange,
  name,
  color,
  onNameChange,
  onColorChange,
  onSubmit,
  isSubmitting,
}: GroupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Create collection</DialogTitle>
          <DialogDescription>Organize notes into collections.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Collection name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="e.g. Product, Ops, Ideas"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-color">Collection color</Label>
            <Input
              id="group-color"
              type="color"
              value={color}
              onChange={(event) => onColorChange(event.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
