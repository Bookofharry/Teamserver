import { useMemo, useState, useEffect, useRef, type ChangeEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Pin,
  Clock,
  Bot,
  Check,
  Loader2,
  NotebookPen,
  Share2,
  Copy,
  Lock,
  Paperclip,
  Download,
  History,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';
import { usePublishNote, useCreateNoteAttachment, useDeleteNoteAttachment, useNoteAttachments, useNoteVersions, useNoteVersionDetail, useRestoreNoteVersion } from '@/hooks/use-data';
import { useNotePresence } from '@/hooks/use-note-presence';
import { cn } from '@/lib/utils';
import type { Note, PlanTier, SaveStatus, User } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useNoteActions } from '@/hooks/use-note-actions';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';

interface NoteEditorProps {
  note: Note | null;
  noteActions: ReturnType<typeof useNoteActions>;
  onOpenAIPanel: () => void;
  showAIActions?: boolean;
  canPublish?: boolean;
  plan?: PlanTier;
  currentUser?: User | null;
  isLoadingNote?: boolean;
}

export function NoteEditor({
  note,
  noteActions,
  onOpenAIPanel,
  showAIActions = true,
  canPublish = false,
  plan = 'free',
  currentUser = null,
  isLoadingNote = false,
}: NoteEditorProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [savedTitle, setSavedTitle] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [savedTags, setSavedTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isTagFocused, setIsTagFocused] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastNoteIdRef = useRef<string | null>(null);
  const { toast } = useToast();
  const publishNote = usePublishNote();
  const createNoteAttachment = useCreateNoteAttachment();
  const deleteNoteAttachment = useDeleteNoteAttachment();
  const { data: attachments = [], isLoading: attachmentsLoading } = useNoteAttachments(note?.id ?? null, Boolean(note?.id));
  const { data: versionsData, isLoading: versionsLoading } = useNoteVersions(note?.id ?? null, versionsOpen);
  const versions = useMemo(() => versionsData?.items ?? [], [versionsData]);
  const versionsMeta = versionsData?.meta;
  const restoreNoteVersion = useRestoreNoteVersion();
  const { participants, typingUsers, notifyTyping, updateCursor } = useNotePresence({
    noteId: note?.id ?? null,
    user: currentUser,
  });

  useEffect(() => {
    if (!versionsOpen) {
      setSelectedVersionId(null);
      return;
    }
    if (versions.length === 0) {
      setSelectedVersionId(null);
      return;
    }
    setSelectedVersionId((prev) =>
      prev && versions.some((version) => version.id === prev) ? prev : versions[0].id,
    );
  }, [versions, versionsOpen]);

  const {
    data: selectedVersionDetail,
    isLoading: versionDetailLoading,
  } = useNoteVersionDetail(note?.id ?? null, selectedVersionId, Boolean(selectedVersionId));

  const versionPreviewExcerpt = useMemo(() => {
    if (!selectedVersionDetail?.body) return '';
    const text = DOMPurify.sanitize(selectedVersionDetail.body, { ALLOWED_TAGS: [] });
    return text.replace(/\s+/g, ' ').trim();
  }, [selectedVersionDetail]);

  const versionPreviewText =
    versionPreviewExcerpt.length > 360
      ? `${versionPreviewExcerpt.slice(0, 360).trim()}…`
      : versionPreviewExcerpt;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap text-foreground',
      },
    },
    onUpdate: ({ editor }) => {
      setBody(editor.getHTML());
      notifyTyping();
    },
    onSelectionUpdate: ({ editor }) => {
      const position = editor.state.selection.from ?? 0;
      const textBefore = editor.state.doc.textBetween(0, position, '\n', '\n');
      const lines = textBefore.split('\n');
      updateCursor(lines.length, (lines[lines.length - 1] || '').length + 1);
    },
  });

  const noteTagsKey = (note?.tags ?? []).join("|");
  useEffect(() => {
    if (!note) return;
    const noteIdChanged = lastNoteIdRef.current !== note.id;
    const hasLocalChanges =
      title !== savedTitle || body !== savedBody || tags.join("|") !== savedTags.join("|");
    const shouldHydrate = noteIdChanged || (!hasLocalChanges && note.body !== savedBody);
    if (!shouldHydrate) return;
    setTitle(note.title);
    setBody(note.body);
    setTags(note.tags || []);
    setSavedTitle(note.title);
    setSavedBody(note.body);
    setSavedTags(note.tags || []);
    setIsSaving(false);
    setLastSyncedAt(note.updatedAt ? new Date(note.updatedAt) : null);
    if (editor) {
      editor.commands.setContent(note.body || "", false);
    }
    lastNoteIdRef.current = note.id;
  }, [
    note?.id,
    note?.body,
    note?.title,
    note?.updatedAt,
    noteTagsKey,
    editor,
    title,
    body,
    tags,
    savedTitle,
    savedBody,
    savedTags,
    note,
  ]);

  useEffect(() => {
    setShareOpen(false);
    setCopyStatus('idle');
  }, [note]);

  useEffect(() => {
    setTagInput('');
  }, [note]);

  const hasChanges = useMemo(
    () =>
      Boolean(
        note &&
        (title !== savedTitle ||
          body !== savedBody ||
          tags.join('|') !== savedTags.join('|')),
      ),
    [note, title, body, tags, savedTitle, savedBody, savedTags],
  );

  const isPublic = Boolean(note?.isPublic);
  const publicExpiresAt = note?.publicExpiresAt ?? null;
  const isShareExpired = Boolean(publicExpiresAt && publicExpiresAt.getTime() <= Date.now());
  const shareUrl = useMemo(() => {
    if (!note?.publicSlug) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/public/notes/${note.publicSlug}`;
    }
    return `/public/notes/${note.publicSlug}`;
  }, [note?.publicSlug]);

  const saveStatus: SaveStatus = isSaving ? 'saving' : hasChanges ? 'unsaved' : 'saved';
  const handleSave = async () => {
    if (!note || !hasChanges || isSaving) return;
    setIsSaving(true);
    try {
      await noteActions.handleSaveNote({ ...note, title, body, tags, updatedAt: new Date() });
      setSavedTitle(title);
      setSavedBody(body);
      setSavedTags(tags);
      setLastSyncedAt(new Date());
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpgradePrompt = (feature: string) => {
    setUpgradeFeature(feature);
    setUpgradeOpen(true);
  };

  const upgradeMessage = upgradeFeature === 'Public notes'
    ? 'Public notes are available on TeamPad Premium+.'
    : upgradeFeature
      ? `${upgradeFeature} is available on TeamPad Premium and Premium+.`
      : 'This feature is available on TeamPad Premium and Premium+.';

  const canUseRichTools = plan !== 'free';

  const handleRichToolClick = (feature: string, action: () => void) => {
    if (!editor) return;
    if (!canUseRichTools) {
      handleUpgradePrompt(feature);
      return;
    }
    action();
  };

  const handleShareClick = () => {
    if (!note) return;
    if (!canPublish) {
      toast({
        title: 'Publish restricted',
        description: 'Only workspace owners and admins can share notes.',
      });
      return;
    }
    if (plan !== 'premium_plus') {
      handleUpgradePrompt('Public notes');
      return;
    }
    setShareOpen(true);
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually.',
      });
    }
  };

  const handlePublishToggle = async (nextState: boolean) => {
    if (!note) return;
    try {
      await publishNote.mutateAsync({
        noteId: note.id,
        workspaceId: note.workspaceId,
        isPublic: nextState,
      });
      toast({
        title: nextState ? 'Note published' : 'Note unpublished',
        description: nextState
          ? 'Anyone with the link can view this note.'
          : 'The public link has been disabled.',
      });
    } catch (error) {
      if (error instanceof Error && /upgrade/i.test(error.message)) {
        handleUpgradePrompt('Public notes');
        return;
      }
      toast({
        title: 'Share failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleTagAdd = () => {
    const nextTag = tagInput.trim().replace(/^#/, '');
    if (!nextTag) return;
    if (tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) {
      setTagInput('');
      return;
    }
    const cappedTag = nextTag.slice(0, 24);
    setTags((prev) => [...prev, cappedTag]);
    setTagInput('');
  };

  const handleTagRemove = (tag: string) => {
    setTags((prev) => prev.filter((item) => item !== tag));
  };

  const formatBytes = (size?: number | null) => {
    if (!size) return null;
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
    const value = size / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const handleAttachmentSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !note) return;
    if (!isSupabaseConfigured) {
      toast({
        title: 'Storage not configured',
        description: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY first.',
      });
      return;
    }
    setUploadingAttachment(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${note.id}/${uniqueId}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('note-attachments')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        throw uploadError;
      }
      const { data: publicUrl } = supabase.storage.from('note-attachments').getPublicUrl(path);
      if (!publicUrl?.publicUrl) {
        throw new Error('Failed to create attachment URL.');
      }
      await createNoteAttachment.mutateAsync({
        noteId: note.id,
        attachment: {
          name: file.name,
          url: publicUrl.publicUrl,
          size: file.size,
          contentType: file.type || undefined,
        },
      });
      toast({
        title: 'Attachment added',
        description: file.name,
      });
    } catch (error) {
      toast({
        title: 'Attachment failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!note) return;
    setRemovingAttachmentId(attachmentId);
    try {
      await deleteNoteAttachment.mutateAsync({ noteId: note.id, attachmentId });
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setRemovingAttachmentId(null);
    }
  };

  const handleExport = (format: 'markdown' | 'html' | 'pdf') => {
    if (!note) return;
    const html = editor?.getHTML() || body || '';
    const text = editor?.getText() || body || '';
    const baseName = (note.title || 'note')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '') || 'note';

    if (format === 'pdf') {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (!printWindow) {
        toast({
          title: 'Export blocked',
          description: 'Allow pop-ups to export this note as PDF.',
        });
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>${note.title || 'Note'}</title>
            <style>
              body { font-family: "Inter", "Roboto", "Open Sans", sans-serif; padding: 32px; color: #0f172a; }
              h1 { font-size: 28px; margin: 0 0 16px; }
              h2 { font-size: 22px; margin: 18px 0 10px; }
              p { line-height: 1.6; margin: 10px 0; }
              ul, ol { padding-left: 24px; }
            </style>
          </head>
          <body>
            <h1>${note.title || 'Untitled'}</h1>
            ${html}
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
      return;
    }

    const content = format === 'html' ? html : text;
    const mime = format === 'html' ? 'text/html' : 'text/markdown';
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.${format === 'html' ? 'html' : 'md'}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!note) return;
    setRestoringVersionId(versionId);
    try {
      const restored = await restoreNoteVersion.mutateAsync({ noteId: note.id, versionId });
      setTitle(restored.title);
      setBody(restored.body);
      setTags(restored.tags || []);
      setSavedTitle(restored.title);
      setSavedBody(restored.body);
      setSavedTags(restored.tags || []);
      setLastSyncedAt(restored.updatedAt ? new Date(restored.updatedAt) : null);
      if (editor) {
        editor.commands.setContent(restored.body || '', false);
      }
      toast({
        title: 'Version restored',
        description: 'Your note has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setRestoringVersionId(null);
    }
  };

  const templates = [
    {
      id: 'meeting',
      label: 'Meeting notes',
      title: 'Meeting notes',
      body: `<h2>Agenda</h2><ul><li></li></ul><h2>Decisions</h2><ul><li></li></ul><h2>Action items</h2><ul><li></li></ul>`,
      tags: ['meeting'],
    },
    {
      id: 'planning',
      label: 'Weekly planning',
      title: 'Weekly planning',
      body: `<h2>Priorities</h2><ul><li></li></ul><h2>Risks</h2><ul><li></li></ul><h2>Updates</h2><ul><li></li></ul>`,
      tags: ['planning'],
    },
    {
      id: 'launch',
      label: 'Launch checklist',
      title: 'Launch checklist',
      body: `<h2>Prep</h2><ul><li></li></ul><h2>Go-live</h2><ul><li></li></ul><h2>Follow-up</h2><ul><li></li></ul>`,
      tags: ['launch'],
    },
  ];

  const handleTemplateApply = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setTitle(template.title);
    setBody(template.body);
    if (editor) {
      editor.commands.setContent(template.body, false);
    }
    setTags((prev) => Array.from(new Set([...prev, ...template.tags])));
    toast({
      title: 'Template applied',
      description: 'Review and save when you are ready.',
    });
  };

  const isPremiumPlus = plan === 'premium_plus';
  const aiButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative"
      onClick={onOpenAIPanel}
      aria-label={isPremiumPlus ? 'Open AI panel' : 'Upgrade to unlock TeamPad AI'}
    >
      <Bot className="w-4 h-4" />
      {!isPremiumPlus && (
        <span className="absolute -top-1 -right-1 rounded-full bg-background p-0.5">
          <Lock className="w-3 h-3 text-primary" />
        </span>
      )}
    </Button>
  );

  const otherParticipants = participants.filter((person) => person.userId !== currentUser?.id);
  const typingLabel = typingUsers
    .map((entry) => entry.name)
    .slice(0, 2)
    .join(', ');

  if (isLoadingNote) {
    return (
      <div className="flex-1 min-h-0 h-full flex flex-col bg-background">
        <div className="px-3 sm:px-6 py-3 border-b border-border/20">
          <div className="w-full">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-8 w-8 rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pb-24 sm:pb-16 p-6 sm:p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-12 w-full rounded-2xl" />
            <Skeleton className="h-4 w-48" />
            <div className="rounded-2xl border border-border/25 bg-card/40 px-3 py-3">
              <div className="rounded-xl border border-border/15 bg-card/40 px-4 py-4 min-h-[360px]">
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <NotebookPen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2 dashboard-display">Select a note</h3>
          <p className="text-muted-foreground">Choose a note from the list or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col bg-background">
      {/* Toolbar */}
      <div className="px-3 sm:px-6 py-3 border-b border-border/20">
        <div
          className="w-full overflow-x-auto overflow-y-hidden touch-pan-x"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex items-center gap-6 min-w-max whitespace-nowrap">
            <div className="flex items-center gap-1 flex-nowrap shrink-0">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRichToolClick('Bold text', () => editor.chain().focus().toggleBold().run())}
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRichToolClick('Italic text', () => editor.chain().focus().toggleItalic().run())}
              >
                <Italic className="w-4 h-4" />
              </Button>
              <div className="w-px h-5 bg-transparent mx-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRichToolClick('Heading 1', () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
              >
                <Heading1 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRichToolClick('Heading 2', () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
              >
                <Heading2 className="w-4 h-4" />
              </Button>
              <div className="w-px h-5 bg-transparent mx-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRichToolClick('Bullet lists', () => editor.chain().focus().toggleBulletList().run())}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRichToolClick('Numbered lists', () => editor.chain().focus().toggleOrderedList().run())}
              >
                <ListOrdered className="w-4 h-4" />
              </Button>
              <div className="w-px h-5 bg-transparent mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Insert template">
                    <NotebookPen className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => handleTemplateApply(template.id)}
                    >
                      {template.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3 flex-nowrap shrink-0">
              {/* Save Status */}
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-4 h-4 text-success" />
                    <span className="text-muted-foreground">
                      Synced{lastSyncedAt ? ` · ${format(lastSyncedAt, 'h:mm a')}` : ''}
                    </span>
                  </>
                )}
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-muted-foreground">Syncing...</span>
                  </>
                )}
                {saveStatus === 'unsaved' && (
                  <span className="text-muted-foreground">Not synced</span>
                )}
              </div>

              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
                Save
              </Button>

              <div className="w-px h-5 bg-transparent" />

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => noteActions.handleTogglePin(note.id)}
                className={cn(note.isPinned && "text-primary")}
              >
                <Pin className="w-4 h-4" />
              </Button>
              {showAIActions && (
                isPremiumPlus ? (
                  aiButton
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>{aiButton}</TooltipTrigger>
                    <TooltipContent side="bottom" align="end">
                      Premium+ only
                    </TooltipContent>
                  </Tooltip>
                )
              )}
              {canPublish && (
                <Button variant="ghost" size="icon-sm" onClick={handleShareClick}>
                  <Share2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setVersionsOpen(true)}
                aria-label="View version history"
              >
                <History className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Add attachment"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="Export note">
                    <Download className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleExport('markdown')}>
                    Export markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('html')}>
                    Export HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="h-8 w-8 opacity-0 pointer-events-none" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {(otherParticipants.length > 0 || typingUsers.length > 0) && (
        <div className="px-3 sm:px-6 py-2 flex flex-wrap items-center gap-2 justify-between text-xs border-b border-border/15">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {otherParticipants.slice(0, 4).map((person) => (
                <span
                  key={person.userId}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                  style={{ backgroundColor: person.color, color: '#0b1220' }}
                  title={person.name}
                >
                  {person.name.charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
            {otherParticipants.length > 0 && (
              <span className="text-muted-foreground">
                {otherParticipants.length} active
              </span>
            )}
          </div>
          {typingLabel && (
            <span className="text-muted-foreground">
              {typingLabel} typing...
            </span>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain touch-pan-y pb-24 sm:pb-16">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
          {isLoadingNote ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-2/3" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-4 w-48" />
              <div className="rounded-2xl border border-border/25 bg-card/40 px-3 py-3">
                <div className="rounded-xl border border-border/15 bg-card/40 px-4 py-4 min-h-[360px]">
                  <Skeleton className="h-64 w-full" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  notifyTyping();
                }}
                placeholder={isTitleFocused ? '' : 'Untitled'}
                onFocus={() => setIsTitleFocused(true)}
                onBlur={() => setIsTitleFocused(false)}
                className="w-full text-2xl sm:text-3xl font-bold text-foreground bg-transparent border-b border-border/20 outline-none placeholder:text-muted-foreground/50 mb-4 pb-2 dashboard-display"
              />

              <div className="flex flex-wrap items-center gap-2 mb-4 rounded-2xl border border-border/15 bg-card/30 px-3 py-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagRemove(tag)}
                    className="inline-flex items-center gap-1 rounded-full border border-border/20 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${tag}`}
                  >
                    #{tag}
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleTagAdd();
                      }
                    }}
                    placeholder={isTagFocused ? '' : 'Add tag'}
                    onFocus={() => setIsTagFocused(true)}
                    onBlur={() => setIsTagFocused(false)}
                    className="h-8 w-24 sm:w-28 border border-border/20 bg-background/70"
                  />
                  <Button size="sm" variant="outline" onClick={handleTagAdd}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-muted-foreground mb-8 pb-6 border-b border-border/15">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Updated {format(note.updatedAt, 'MMM d, yyyy · h:mm a')}</span>
                </div>
                <span>by {note.updatedBy.name}</span>
                {otherParticipants
                  .filter((person) => person.cursor)
                  .slice(0, 2)
                  .map((person) => (
                    <span key={person.userId} className="text-muted-foreground">
                      {person.name} · L{person.cursor?.line}
                    </span>
                  ))}
              </div>

              <div className="rounded-2xl border border-border/25 bg-card/40 px-3 py-3">
                <div className="rounded-xl border border-border/15 bg-card/40 px-4 py-4 min-h-[360px]">
                  <EditorContent editor={editor} className="min-h-[320px]" />
                </div>
              </div>
            </>
          )}

          <div className="mt-6 rounded-2xl bg-card/40 p-4 space-y-3 border border-border/15">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Attachments</span>
                <Badge variant="secondary">{attachments.length}</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAttachment || createNoteAttachment.isPending}
              >
                {uploadingAttachment || createNoteAttachment.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            {attachmentsLoading && (
              <div className="space-y-2">
                {[...Array(2)].map((_, index) => (
                  <Skeleton key={`attachment-skeleton-${index}`} className="h-10 w-full" />
                ))}
              </div>
            )}

            {!attachmentsLoading && attachments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add files, screenshots, or exports to keep everything together.
              </p>
            )}

            {!attachmentsLoading && attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/80 px-3 py-2 border border-border/10"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(attachment.size) || 'File'} · Added {formatDistanceToNow(attachment.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <a href={attachment.url} target="_blank" rel="noreferrer">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        disabled={removingAttachmentId === attachment.id}
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleAttachmentSelect}
          />
        </div>
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Upgrade to unlock</DialogTitle>
            <DialogDescription>{upgradeMessage}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary/40 p-4">
              <p className="text-sm font-medium text-foreground">Premium+ plan</p>
              <p className="text-sm text-muted-foreground">
                Public notes, advanced controls, and priority support.
              </p>
            </div>
            <div className="rounded-lg p-4">
              <p className="text-sm font-medium text-foreground">Premium plan</p>
              <p className="text-sm text-muted-foreground">
                Headings, lists, and advanced editor tools for your whole team.
              </p>
            </div>
            <div className="rounded-lg p-4">
              <p className="text-sm font-medium text-foreground">Free plan</p>
              <p className="text-sm text-muted-foreground">
                Clean plain text notes and essentials for quick capture.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setUpgradeOpen(false);
                navigate('/pricing');
              }}
            >
              Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>
              Every save captures a snapshot so you can roll back anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="space-y-3">
              {versionsLoading && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, index) => (
                    <Skeleton key={`version-skeleton-${index}`} className="h-12 w-full" />
                  ))}
                </div>
              )}
              {!versionsLoading && versions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No versions yet. Save updates to build a restore point.
                </p>
              )}
              {!versionsLoading && versions.length > 0 && (
                <div className="space-y-2">
                  {versionsMeta && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>
                        Showing {versions.length} of {versionsMeta.total} versions
                      </span>
                      {versionsMeta.total > versionsMeta.limit && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => navigate('/pricing')}
                        >
                          Upgrade to see more
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {versions.map((version, index) => {
                      const isSelected = selectedVersionId === version.id;
                      const relTime = formatDistanceToNow(version.createdAt, { addSuffix: true });
                      const versionNumber = versionsMeta
                        ? Math.max(versionsMeta.total - index, 1)
                        : versions.length - index;
                      return (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => setSelectedVersionId(version.id)}
                          className={cn(
                            "group w-full flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors",
                            isSelected ? "bg-secondary/40" : "hover:bg-secondary/60",
                          )}
                          aria-pressed={isSelected}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {version.title || 'Untitled'}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Saved {relTime} · by {version.createdBy.name}
                              </p>
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                              #{versionNumber}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-foreground">
                              {format(version.createdAt, 'MMM d, yyyy · h:mm a')}
                            </span>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRestoreVersion(version.id);
                              }}
                              disabled={restoringVersionId === version.id}
                            >
                              {restoringVersionId === version.id ? 'Restoring...' : 'Restore'}
                            </Button>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex h-full flex-col gap-3 rounded-2xl bg-background/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Preview</p>
                  <p className="text-lg font-semibold text-foreground truncate">
                    {selectedVersionDetail?.title || 'Select a version'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {selectedVersionDetail
                    ? format(selectedVersionDetail.createdAt, 'MMM d, yyyy')
                    : '—'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedVersionDetail
                  ? `By ${selectedVersionDetail.createdBy.name}`
                  : 'Pick a version to see a snapshot of the changes.'}
              </p>
              <div className="flex-1 overflow-y-auto rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
                {versionDetailLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : selectedVersionDetail ? (
                  <p className="whitespace-pre-line">{versionPreviewText || 'This version has no content yet.'}</p>
                ) : (
                  <p>Select a version to preview here.</p>
                )}
              </div>
              {selectedVersionDetail && selectedVersionDetail.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedVersionDetail.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => selectedVersionDetail && handleRestoreVersion(selectedVersionDetail.id)}
                disabled={
                  !selectedVersionDetail ||
                  restoringVersionId === selectedVersionDetail.id ||
                  versionDetailLoading
                }
              >
                {restoringVersionId === selectedVersionDetail?.id ? 'Restoring...' : 'Restore this version'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Share this note</DialogTitle>
            <DialogDescription>
              Publish an unlisted link. Anyone with the link can view the note. Links expire after 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Public link</p>
                  <p className="text-xs text-muted-foreground">
                    Unlisted · not indexed or searchable
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePublishToggle(!isPublic)}
                  disabled={publishNote.isPending}
                >
                  {publishNote.isPending
                    ? 'Updating...'
                    : isPublic
                      ? 'Unpublish'
                      : 'Publish'}
                </Button>
              </div>

              {isPublic ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input value={shareUrl} readOnly />
                    <Button variant="outline" size="icon" onClick={handleCopyShareLink}>
                      {copyStatus === 'copied' ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {note?.publicPublishedAt && (
                    <span className="text-xs text-muted-foreground">
                      Published {format(note.publicPublishedAt, 'MMM d, yyyy · h:mm a')}
                    </span>
                  )}
                  {publicExpiresAt && (
                    <span className={cn(
                      "text-xs",
                      isShareExpired ? "text-destructive" : "text-muted-foreground",
                    )}>
                      {isShareExpired ? 'Link expired' : 'Link expires'} {format(publicExpiresAt, 'MMM d, yyyy · h:mm a')}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Publish to generate a shareable link that expires automatically.
                </p>
              )}
            </div>

            <div className="rounded-lg bg-secondary/30 p-4 text-sm text-muted-foreground">
              Keep sensitive content private. Disable sharing at any time to revoke access.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
