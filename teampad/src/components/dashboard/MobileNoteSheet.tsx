import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NoteEditor } from '@/components/notes/NoteEditor';
import type { Note, PlanTier, User } from '@/types';
import { useNoteActions } from '@/hooks/use-note-actions';

interface MobileNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  noteActions: ReturnType<typeof useNoteActions>;
  plan: PlanTier;
  canPublish: boolean;
  currentUser?: User | null;
  isLoadingNote?: boolean;
}

export function MobileNoteSheet({
  open,
  onOpenChange,
  note,
  noteActions,
  plan,
  canPublish,
  currentUser,
  isLoadingNote,
}: MobileNoteSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-none p-0 h-full overflow-hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>Note details</SheetTitle>
          <SheetDescription>View and edit the selected note.</SheetDescription>
        </SheetHeader>
        <NoteEditor
          note={note}
          noteActions={noteActions}
          onOpenAIPanel={() => { }}
          showAIActions={false}
          plan={plan}
          canPublish={canPublish}
          currentUser={currentUser}
          isLoadingNote={isLoadingNote}
        />
      </SheetContent>
    </Sheet>
  );
}
