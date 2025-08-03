
import { useState } from "react";
import { CreditNoteTable } from "@/components/credit-notes/CreditNoteTable";
import { CreditNoteDialog } from "@/components/credit-notes/CreditNoteDialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type CreditNote } from "@/types/credit-note";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { createCreditNote, updateCreditNote, deleteCreditNote } from "@/lib/api";
import { PermissionGuard } from "@/components/ui/permission-guard";

export default function CreditNotesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);
  const [viewingCreditNote, setViewingCreditNote] = useState<CreditNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<string | null>(null);
  
  const { hasPermission } = useAuth();
  const canCreateCreditNotes = hasPermission('credit_notes_create');
  const canEditCreditNotes = hasPermission('credit_notes_edit');
  const canDeleteCreditNotes = hasPermission('credit_notes_delete');



  const handleAddNew = () => {
    setEditingCreditNote(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (creditNote: CreditNote) => {
    setEditingCreditNote(creditNote);
    setIsDialogOpen(true);
  };

  const handleView = (creditNote: CreditNote) => {
    setViewingCreditNote(creditNote);
    setIsViewDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setCreditNoteToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!creditNoteToDelete) return;
    
    try {
      await deleteCreditNote(creditNoteToDelete);
      setDeleteDialogOpen(false);
      toast.success("Credit note deleted successfully");
      // Refresh the page to update the table
      window.location.reload();
    } catch (error) {
      console.error('Error deleting credit note:', error);
      toast.error('Failed to delete credit note');
    }
  };

  const handleSave = async (creditNote: Partial<CreditNote>) => {
    try {
      if (editingCreditNote) {
        await updateCreditNote(editingCreditNote.id, creditNote);
        toast.success("Credit note updated successfully");
      } else {
        await createCreditNote(creditNote);
        toast.success("Credit note created successfully");
      }
      setIsDialogOpen(false);
      // Refresh the page to update the table
      window.location.reload();
    } catch (error) {
      console.error('Error saving credit note:', error);
      toast.error(`Failed to ${editingCreditNote ? 'update' : 'create'} credit note`);
    }
  };

  return (
    <PermissionGuard 
      requiredPermission="credit_notes_view"
      fallbackMessage="You do not have permission to view credit notes. Please contact an administrator."
    >
      <div className="space-y-6">

        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Credit Notes</h1>
        {canCreateCreditNotes ? (
        <Button onClick={handleAddNew} className="flex items-center gap-2">
          <PlusCircle size={18} />
          New Credit Note
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="flex items-center gap-2">
                    <PlusCircle size={18} />
                    New Credit Note
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create credit notes
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <CreditNoteTable 
        onView={handleView}
        onEdit={canEditCreditNotes ? handleEdit : undefined}
        onDelete={canDeleteCreditNotes ? handleDeleteClick : undefined}
        canEdit={canEditCreditNotes}
        canDelete={canDeleteCreditNotes}
      />

      <CreditNoteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        creditNote={editingCreditNote}
        onSave={handleSave}
        customers={[]} // Data will be fetched from backend
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              credit note and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PermissionGuard>
  );
}
