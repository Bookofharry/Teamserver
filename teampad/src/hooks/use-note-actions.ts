
import { useQueryClient } from '@tanstack/react-query';
import type { Note, User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  useCreateNote,
  useDeleteNote,
  useTogglePin,
  useUpdateNote,
  useRestoreNote,
} from '@/hooks/use-data';

type NoteActionsProps = {
  currentWorkspaceId: string | null;
  currentGroupId: string | null;
  currentNoteId: string | null;
  setCurrentNoteId: (noteId: string | null) => void;
  openUpgradeModal: (context: 'limits' | 'ai') => void;
  me: User | null;
  activeLimits: { notes: number } | null;
  currentGroupNoteCount: number;
};

export function useNoteActions({
  currentWorkspaceId,
  currentGroupId,
  currentNoteId,
  setCurrentNoteId,
  openUpgradeModal,
  me,
  activeLimits,
  currentGroupNoteCount,
}: NoteActionsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const updateNote = useUpdateNote();
  const togglePin = useTogglePin();
  const restoreNote = useRestoreNote();

  const handleCreateNote = async () => {
    if (!currentWorkspaceId) {
      toast({
        title: 'Workspace required',
        description: 'Create or select a workspace before adding notes.',
      });
      return;
    }
    if (!currentGroupId) {
      toast({
        title: 'Collection required',
        description: 'Create or select a collection before adding notes.',
      });
      return;
    }
    if (me && activeLimits && currentGroupNoteCount >= activeLimits.notes) {
      openUpgradeModal('limits');
      return;
    }

    try {
      const newNote = await createNote.mutateAsync({
        workspaceId: currentWorkspaceId,
        groupId: currentGroupId,
      });
      setCurrentNoteId(newNote.id);
    } catch (error) {
      if (error instanceof Error && /upgrade to premium/i.test(error.message)) {
        openUpgradeModal('limits');
        return;
      }
      toast({
        title: 'Note not created',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleSaveNote = (updatedNote: Note) => updateNote.mutateAsync(updatedNote);

  const handleTogglePin = (noteId: string) => {
    togglePin.mutate(noteId);
  };

  const handleRenameNote = (note: Note, title: string) => {
    updateNote.mutate({ ...note, title });
  };

  const handleDuplicateNote = async (note: Note) => {
    const newNote = await createNote.mutateAsync({
      workspaceId: note.workspaceId,
      groupId: note.groupId,
      title: note.title ? `${note.title} (Copy)` : 'Untitled',
      body: note.body,
      tags: note.tags,
    });
    setCurrentNoteId(newNote.id);
  };

  const handleMoveNote = (note: Note, groupId: string) => {
    const previousGroupId = note.groupId;
    updateNote.mutate(
      { ...note, groupId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['notes', note.workspaceId, previousGroupId] });
          queryClient.invalidateQueries({ queryKey: ['notes', note.workspaceId, groupId] });
          queryClient.invalidateQueries({ queryKey: ['groups', note.workspaceId] });
        },
      },
    );
  };

  const handleDeleteNote = (note: Note) => {
    deleteNote.mutate({ noteId: note.id, workspaceId: note.workspaceId, groupId: note.groupId });
    if (currentNoteId === note.id) {
      setCurrentNoteId(null);
    }
  };

  return {
    createNote,
    deleteNote,
    updateNote,
    togglePin,
    handleCreateNote,
    handleSaveNote,
    handleTogglePin,
    handleRenameNote,
    handleDuplicateNote,
    handleMoveNote,
    handleDeleteNote,
    handleRestoreNote: (note: Note) => restoreNote.mutate(note.id),
  };
}
