import type { ComponentProps } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface WorkspaceSidebarProps extends ComponentProps<typeof Sidebar> {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function WorkspaceSidebar({
  isMobile,
  open,
  onOpenChange,
  collapsed,
  onToggleCollapse,
  ...sidebarProps
}: WorkspaceSidebarProps) {
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
            <SheetDescription>Navigate workspaces, collections, and settings.</SheetDescription>
          </SheetHeader>
          <Sidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>
    );
  }

  return <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />;
}
