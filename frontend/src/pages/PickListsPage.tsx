import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { PickListTable } from "@/components/pick-list/PickListTable";
import { PickListDialog } from "@/components/pick-list/PickListDialog";
import { PickListView } from "@/components/pick-list/PickListView";
import { type PickList } from "@/types/pick-list";
import {
    getPickLists, createPickList, updatePickList, deletePickList,
    getDeliveryChallans, getUsers,
} from "@/lib/api";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";

export default function PickListsPage() {
    const [pickLists, setPickLists] = useState<PickList[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPL, setEditingPL] = useState<PickList | null>(null);
    const [viewingPL, setViewingPL] = useState<PickList | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deliveryChallans, setDeliveryChallans] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const { hasPermission } = useAuth();
    const { toast } = useToast();

    const canCreate = hasPermission("sale_invoices_create");
    const canEdit = hasPermission("sale_invoices_edit");
    const canDelete = hasPermission("sale_invoices_delete");

    const fetchPLs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getPickLists();
            setPickLists(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch pick lists:", error);
            toast({ title: "Error", description: "Failed to load pick lists", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchSupportingData = useCallback(async () => {
        try {
            const [dcData, userData] = await Promise.all([
                getDeliveryChallans(),
                getUsers(),
            ]);
            setDeliveryChallans(Array.isArray(dcData) ? dcData : []);
            setUsers(Array.isArray(userData) ? userData : []);
        } catch (error) {
            console.error("Failed to fetch supporting data:", error);
        }
    }, []);

    useEffect(() => {
        fetchPLs();
        fetchSupportingData();
    }, [fetchPLs, fetchSupportingData]);

    const handleCreate = () => { setEditingPL(null); setDialogOpen(true); };

    const handleEdit = (pl: PickList) => { setEditingPL(pl); setDialogOpen(true); };

    const handleSave = async (data: any) => {
        if (editingPL) {
            await updatePickList(editingPL.id, data);
            toast({ title: "Success", description: "Pick list updated" });
        } else {
            await createPickList(data);
            toast({ title: "Success", description: "Pick list created" });
        }
        setEditingPL(null);
        setDialogOpen(false);
        fetchPLs();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deletePickList(deleteId);
            toast({ title: "Success", description: "Pick list deleted" });
            fetchPLs();
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
        } finally {
            setDeleteId(null);
        }
    };

    if (viewingPL) {
        return (
            <PermissionGuard requiredPermission="sale_invoices_view" fallbackMessage="You do not have permission to view pick lists.">
                <PickListView pickList={viewingPL} onBack={() => setViewingPL(null)} />
            </PermissionGuard>
        );
    }

    return (
        <PermissionGuard requiredPermission="sale_invoices_view" fallbackMessage="You do not have permission to view pick lists.">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Pick Lists</h1>
                        <p className="text-muted-foreground">Pick items from storage for outbound delivery</p>
                    </div>
                    {canCreate && (
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" /> New Pick List
                        </Button>
                    )}
                </div>

                <PickListTable
                    pickLists={pickLists}
                    loading={loading}
                    onView={setViewingPL}
                    onEdit={canEdit ? handleEdit : undefined}
                    onDelete={canDelete ? (id: string) => setDeleteId(id) : undefined}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />

                <PickListDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onSave={handleSave}
                    editingPL={editingPL}
                    deliveryChallans={deliveryChallans}
                    users={users}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Pick List?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
