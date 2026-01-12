import { useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, MoreHorizontal, Pin, Plus, Trash2, Copy, Pencil, MoveRight, PinOff, RotateCcw } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Group, Note } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useNoteActions } from '@/hooks/use-note-actions';

interface NotesListProps {
  notes: Note[];
  groups: Group[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  onRetry: () => void;
  searchQuery: string;
  currentNoteId: string | null;
  onNoteSelect: (noteId: string) => void;
  noteActions: ReturnType<typeof useNoteActions>;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function NotesList({
  notes,
  groups,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchQuery,
  currentNoteId,
  onNoteSelect,
  noteActions,
  canLoadMore = false,
  onLoadMore,
  isLoadingMore = false,
  className,
  style,
}: NotesListProps) {
  const pinnedNotes = notes.filter(n => n.isPinned);
  const unpinnedNotes = notes.filter(n => !n.isPinned);
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [moveGroupId, setMoveGroupId] = useState('');

  const availableGroups = useMemo(() => groups, [groups]);
  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  const getPreviewText = (value: string) => {
    const stripped = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped.replace(/[#*`[\]]/g, '').substring(0, 100);
  };

  const openRename = (note: Note) => {
    setActiveNote(note);
    setRenameTitle(note.title || '');
    setRenameOpen(true);
  };

  const openMove = (note: Note) => {
    setActiveNote(note);
    setMoveGroupId(note.groupId);
    setMoveOpen(true);
  };

  const openDelete = (note: Note) => {
    setActiveNote(note);
    setDeleteOpen(true);
  };

  const renderNote = (note: Note, index: number) => {
    const group = groupMap.get(note.groupId);

    return (
      <div
        key={note.id}
        onClick={() => onNoteSelect(note.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onNoteSelect(note.id);
          }
        }}
        role="button"
        tabIndex={0}
        className={cn(
          "w-full text-left p-4 rounded-lg transition-all group",
          currentNoteId === note.id
            ? "bg-accent"
            : "bg-card hover:bg-card/80"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {!note.isPinned && (
              <span className="h-6 min-w-[1.5rem] rounded-full bg-gradient-to-br from-cyan-100 via-sky-50 to-blue-100 text-[11px] font-semibold text-slate-700 flex items-center justify-center">
                {index + 1}
              </span>
            )}
            <h3 className="font-medium text-foreground line-clamp-1 flex-1">
              {note.title || 'Untitled'}
            </h3>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {note.isPinned && <Pin className="w-3.5 h-3.5 text-primary" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Open note actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44"
                onClick={(event) => event.stopPropagation()}
              >
                <DropdownMenuItem onClick={() => openRename(note)}>
                  <Pencil className="w-4 h-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => noteActions.handleDuplicateNote(note)}>
                  <Copy className="w-4 h-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openMove(note)}>
                  <MoveRight className="w-4 h-4" />
                  Move to collection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => noteActions.handleTogglePin(note.id)}>
                  {note.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  {note.isPinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {note.deletedAt ? (
                  <DropdownMenuItem onClick={() => noteActions.handleRestoreNote(note)}>
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => openDelete(note)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {note.bodyPreview ? note.bodyPreview : getPreviewText(note.body)}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
          </span>
          {searchQuery && group && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: group.color || 'currentColor' }}
                  />
                  {group.name}
                </span>
              </span>
            </>
          )}
          {note.tags.length > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <div className="flex gap-1">
                {note.tags.slice(0, 2).map(tag => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 bg-secondary rounded text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "bg-surface-sunken h-full flex flex-col shrink-0 w-full sm:w-[320px] md:w-[360px] lg:w-[420px] xl:w-[480px]",
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/15">
        <div>
          <span className="text-sm font-semibold text-foreground">
            {isLoading ? 'Loading notes...' : isError ? 'Notes unavailable' : `${notes.length} notes`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !isError && (
            <Button
              size="sm"
              onClick={noteActions.handleCreateNote}
              className="hidden sm:inline-flex"
              disabled={noteActions.createNote.isPending}
            >
              Create note
            </Button>
          )}
          {isError && !isLoading && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 space-y-5">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, index) => (
              <div key={`note-skeleton-${index}`} className="rounded-lg bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-5" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Unable to load notes</h3>
            <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && pinnedNotes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Pin className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pinned
              </span>
            </div>
            <div className="space-y-2">
              {pinnedNotes.map((note, index) => renderNote(note, index))}
            </div>
          </div>
        )}

        {!isLoading && !isError && unpinnedNotes.length > 0 && (
          <div>
            {pinnedNotes.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Recent
              </span>
            )}
            <div className="space-y-2">
              {unpinnedNotes.map((note, index) => renderNote(note, index))}
            </div>
          </div>
        )}

        {!isLoading && !isError && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
              {searchQuery ? (
                <AlertTriangle className="w-6 h-6 text-muted-foreground" />
              ) : (
                <Plus className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            {searchQuery ? (
              <>
                <h3 className="font-medium text-foreground mb-1">No results found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try a different search or clear the filter.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium text-foreground mb-1">No notes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first note to get started
                </p>
                <Button
                  size="sm"
                  onClick={noteActions.handleCreateNote}
                  className="hidden sm:inline-flex"
                  disabled={noteActions.createNote.isPending}
                >
                  Create note
                </Button>
              </>
            )}
          </div>
        )}

        {!isLoading && !isError && notes.length > 0 && canLoadMore && (
          <div className="pt-2 flex justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading more...' : 'Load more'}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Rename note</DialogTitle>
            <DialogDescription>Choose a clear, searchable title.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              placeholder="Untitled"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (activeNote) {
                  noteActions.handleRenameNote(activeNote, renameTitle.trim() || 'Untitled');
                }
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Move note</DialogTitle>
            <DialogDescription>Select a new collection for this note.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Collection</Label>
            <Select value={moveGroupId} onValueChange={setMoveGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (activeNote && moveGroupId) {
                  noteActions.handleMoveNote(activeNote, moveGroupId);
                }
                setMoveOpen(false);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeNote) {
                  noteActions.handleDeleteNote(activeNote);
                }
                setDeleteOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
