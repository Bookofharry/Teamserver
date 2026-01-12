
import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTrashNotes, useRestoreNote, useDeleteNotePermanently, useMe, useWorkspaceMembers } from '@/hooks/use-data';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowLeft, RefreshCw, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const TrashPage = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const navigate = useNavigate();
    const { data: trashNotes = [], isLoading: notesLoading } = useTrashNotes(workspaceId || null);

    // Permission checks
    const { data: me } = useMe();
    const { data: members = [] } = useWorkspaceMembers(workspaceId || null);

    const canDeleteForever = useMemo(() => {
        if (!me || !workspaceId) return false;
        const member = members.find(m => m.userId === me.id);
        return member?.role === 'owner' || member?.role === 'admin';
    }, [me, members, workspaceId]);

    const restoreNote = useRestoreNote();
    const deleteNotePermanently = useDeleteNotePermanently();

    const handleRestore = (noteId: string) => {
        restoreNote.mutate(noteId);
    };

    const handleDeleteForever = (noteId: string) => {
        deleteNotePermanently.mutate({ noteId });
    };

    if (notesLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background text-foreground p-8 overflow-auto dashboard-sans">
            <div className="mb-8 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Trash</h1>
            </div>

            {trashNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                    <Trash2 className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-xl font-medium">Trash is empty</p>
                    <p className="text-sm">Deleted notes will appear here.</p>
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40%]">Title</TableHead>
                                <TableHead>Deleted Date</TableHead>
                                <TableHead>Deleted By</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {trashNotes.map((note) => (
                                <TableRow key={note.id}>
                                    <TableCell className="font-medium">
                                        {note.title || 'Untitled Note'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {note.deletedAt ? format(new Date(note.deletedAt), 'PP p') : 'Unknown'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {note.updatedBy?.name || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-2"
                                                    >
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                        Restore
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Restore Note?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to restore the note "{note.title || 'Untitled'}"?
                                                            It will be moved back to its original collection.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRestore(note.id)}>
                                                            Restore
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>

                                            {canDeleteForever && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="sm" className="gap-2">
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Delete Forever
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete the note
                                                                "{note.title || 'Untitled'}" and remove it from our servers.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteForever(note.id)}>
                                                                Delete Forever
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};


export default TrashPage;
