import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface DashboardErrorStateProps {
  message: string;
  onRetry: () => void;
  onSignIn: () => void;
}

interface DashboardEmptyStateProps {
  onCreateWorkspace: () => void;
  dialog: ReactNode;
  isCreateWorkspaceLocked?: boolean;
  onLogout: () => void;
}

interface DashboardWorkspacePlaceholderProps {
  dialog: ReactNode;
}

export function DashboardLoadingState() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <span className="text-muted-foreground">Loading your workspace...</span>
    </div>
  );
}

export function DashboardErrorState({ message, onRetry, onSignIn }: DashboardErrorStateProps) {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold text-foreground dashboard-display">Workspace unavailable</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry}>Retry</Button>
          <Button variant="outline" onClick={onSignIn}>
            Sign in
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DashboardEmptyState({
  onCreateWorkspace,
  dialog,
  isCreateWorkspaceLocked,
  onLogout,
}: DashboardEmptyStateProps) {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="relative text-center max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold text-foreground dashboard-display">Create your first workspace</h1>
        <p className="text-sm text-muted-foreground">
          Workspaces help your team separate projects, teams, and shared notes.
        </p>
        <div className="space-y-2">
          <Button onClick={onCreateWorkspace} disabled={isCreateWorkspaceLocked}>
            Create workspace
          </Button>
        </div>
        <div className="pt-4 flex justify-center">
          <Button
            type="button"
            onClick={onLogout}
            className="btn-blue-pattern px-4 py-2 text-sm"
          >
            Log out
          </Button>
        </div>
      </div>
      {dialog}
    </div>
  );
}

export function DashboardWorkspacePlaceholder({ dialog }: DashboardWorkspacePlaceholderProps) {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <span className="text-muted-foreground">Loading workspace...</span>
      {dialog}
    </div>
  );
}
