import { useState, useEffect } from "react";
import { CreditNoteTable } from "@/components/credit-notes/CreditNoteTable";
import { CreditNoteDialog } from "@/components/credit-notes/CreditNoteDialog";
import { CreditNoteView } from "@/components/credit-notes/CreditNoteView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Search } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { getCreditNotes, createCreditNote, updateCreditNote, deleteCreditNote, getCreditNote, getCustomers } from "@/lib/api";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { PrintPreviewDialog } from "@/components/print/PrintPreviewDialog";

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);
  const [viewingCreditNote, setViewingCreditNote] = useState<CreditNote | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printingCreditNote, setPrintingCreditNote] = useState<CreditNote | null>(null);
  
  const { hasPermission } = useAuth();
  const canCreateCreditNotes = hasPermission('credit_notes_create');
  const canEditCreditNotes = hasPermission('credit_notes_edit');
  const canDeleteCreditNotes = hasPermission('credit_notes_delete');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [creditNotesData, customersData] = await Promise.all([
        getCreditNotes().catch(() => []),
        getCustomers().catch(() => [])
      ]);
      setCreditNotes(creditNotesData || []);
      setCustomers(customersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
      setCreditNotes([]);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingCreditNote(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (creditNote: CreditNote) => {
    // Check if credit note can be edited based on status
    if (creditNote.status === 'processed' || creditNote.status === 'cancelled') {
      toast({
        title: "Cannot Edit Credit Note",
        description: `Cannot edit credit note with status "${creditNote.status}". Only draft, pending, and approved credit notes can be edited.`,
        variant: "destructive",
      });
      return;
    }
    
    setEditingCreditNote(creditNote);
    setIsDialogOpen(true);
  };

  const handleView = (creditNote: CreditNote) => {
    setViewingCreditNote(creditNote);
    setIsViewDialogOpen(true);
  };

  const handlePrint = async (creditNote: CreditNote) => {
    try {
      const full = await getCreditNote(creditNote.id);
      const data = full && !full.error ? full : creditNote;
      setPrintingCreditNote(data);
      setPrintDialogOpen(true);
    } catch (e) {
      console.error('Error preparing credit note for print:', e);
      setPrintingCreditNote(creditNote);
      setPrintDialogOpen(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    const creditNote = creditNotes.find(cn => cn.id === id);
    
    // Check if credit note can be deleted based on status
    if (creditNote?.status === 'processed' || creditNote?.status === 'cancelled') {
      toast({
        title: "Cannot Delete Credit Note",
        description: `Cannot delete credit note with status "${creditNote.status}". Only draft, pending, and approved credit notes can be deleted.`,
        variant: "destructive",
      });
      return;
    }
    
    setCreditNoteToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!creditNoteToDelete) return;
    
    try {
      await deleteCreditNote(creditNoteToDelete);
      setCreditNotes(creditNotes.filter((cn) => cn.id !== creditNoteToDelete));
      setDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "Credit note deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting credit note:', error);
      toast({
        title: "Error",
        description: "Failed to delete credit note",
        variant: "destructive",
      });
    }
  };

  const handleSave = async (creditNote: Partial<CreditNote>) => {
    try {
      if (editingCreditNote) {
        await updateCreditNote(editingCreditNote.id, creditNote);
        toast({
          title: "Success",
          description: "Credit note updated successfully",
        });
      } else {
        await createCreditNote(creditNote);
        toast({
          title: "Success",
          description: "Credit note created successfully",
        });
      }
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error saving credit note:', error);
      toast({
        title: "Error",
        description: "Failed to save credit note",
        variant: "destructive",
      });
    }
  };

  // Filter credit notes based on search term
  const filteredCreditNotes = creditNotes.filter(creditNote => 
    creditNote.creditNoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    creditNote.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    creditNote.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search credit notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <CreditNoteTable 
        creditNotes={filteredCreditNotes}
        loading={loading}
        onView={handleView}
        onEdit={canEditCreditNotes ? handleEdit : undefined}
        onDelete={canDeleteCreditNotes ? handleDeleteClick : undefined}
        onPrint={handlePrint}
        canEdit={canEditCreditNotes}
        canDelete={canDeleteCreditNotes}
      />

      <CreditNoteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        creditNote={editingCreditNote}
        onSave={handleSave}
        customers={customers}
      />

      <CreditNoteView
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        creditNote={viewingCreditNote}
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

      <PrintPreviewDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        documentType="creditNote"
        data={printingCreditNote}
      />
    </div>
    </PermissionGuard>
  );
}
