import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PutAwayTable } from "@/components/put-away/PutAwayTable";
import { PutAwayDialog } from "@/components/put-away/PutAwayDialog";
import { PutAwayView } from "@/components/put-away/PutAwayView";
import { type PutAway } from "@/types/put-away";
import { getPutAways, deletePutAway, updatePutAway, createPutAway, getPutAway } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { useToast } from "@/hooks/use-toast";
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

const PutAwaysPage = () => {
    const [putAways, setPutAways] = useState<PutAway[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPutAway, setEditingPutAway] = useState<PutAway | null>(null);
    const [viewingPutAway, setViewingPutAway] = useState<PutAway | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const { hasPermission } = useAuth();
    const { toast } = useToast();

    const canCreate = hasPermission("grn_create");
    const canEdit = hasPermission("grn_edit");
    const canDelete = hasPermission("grn_delete");

    const fetchPutAways = async () => {
        setLoading(true);
        try {
            const data = await getPutAways();
            setPutAways(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching put aways:", error);
            setPutAways([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPutAways();
    }, []);

    const handleView = (pa: PutAway) => setViewingPutAway(pa);

    const handleEdit = async (pa: PutAway) => {
        try {
            const fullPA = await getPutAway(pa.id);
            setEditingPutAway(fullPA);
            setDialogOpen(true);
        } catch (error) {
            console.error("Error fetching put away details:", error);
            toast({
                title: "Error",
                description: "Failed to load put away details",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => setDeleteId(id);

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deletePutAway(deleteId);
            toast({ title: "Success", description: "Put away deleted successfully" });
            fetchPutAways();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to delete put away",
                variant: "destructive",
            });
        } finally {
            setDeleteId(null);
        }
    };

    const handleDialogSuccess = async (data: any) => {
        try {
            if (editingPutAway) {
                await updatePutAway(editingPutAway.id, data);
                toast({ title: "Success", description: "Put away updated successfully" });
            } else {
                await createPutAway(data);
                toast({ title: "Success", description: "Put away created successfully" });
            }
            setDialogOpen(false);
            setEditingPutAway(null);
            fetchPutAways();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to save put away",
                variant: "destructive",
            });
        }
    };

    if (viewingPutAway) {
        return (
            <PermissionGuard
                requiredPermission="grn_view"
                fallbackMessage="You do not have permission to view put aways."
            >
                <PutAwayView putAway={viewingPutAway} onBack={() => setViewingPutAway(null)} />
            </PermissionGuard>
        );
    }

    return (
        <PermissionGuard
            requiredPermission="grn_view"
            fallbackMessage="You do not have permission to view put aways. Please contact an administrator."
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Put Aways</h1>
                    {canCreate && (
                        <Button
                            onClick={() => {
                                setEditingPutAway(null);
                                setDialogOpen(true);
                            }}
                            className="flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> New Put Away
                        </Button>
                    )}
                </div>

                <PutAwayTable
                    putAways={putAways}
                    loading={loading}
                    onView={handleView}
                    onEdit={canEdit ? handleEdit : undefined}
                    onDelete={canDelete ? (pa: PutAway) => handleDelete(pa.id) : undefined}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />

                <PutAwayDialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) setEditingPutAway(null);
                    }}
                    putAway={editingPutAway}
                    onSave={handleDialogSuccess}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Put Away?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the put away and all its items.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </PermissionGuard>
    );
};

export default PutAwaysPage;
