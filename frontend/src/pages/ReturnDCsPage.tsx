import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { ReturnDCTable } from "@/components/return-dc/ReturnDCTable";
import { ReturnDCDialog } from "@/components/return-dc/ReturnDCDialog";
import { ReturnDCView } from "@/components/return-dc/ReturnDCView";
import { type ReturnDeliveryChallan } from "@/types/return-delivery-challan";
import {
    getReturnDCs, createReturnDC, updateReturnDC, deleteReturnDC,
    getDeliveryChallans,
} from "@/lib/api";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";

export default function ReturnDCsPage() {
    const [returnDCs, setReturnDCs] = useState<ReturnDeliveryChallan[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRDC, setEditingRDC] = useState<ReturnDeliveryChallan | null>(null);
    const [viewingRDC, setViewingRDC] = useState<ReturnDeliveryChallan | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deliveryChallans, setDeliveryChallans] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const { hasPermission } = useAuth();
    const { toast } = useToast();

    const canCreate = hasPermission("sale_invoices_create");
    const canEdit = hasPermission("sale_invoices_edit");
    const canDelete = hasPermission("sale_invoices_delete");

    const fetchRDCs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getReturnDCs();
            setReturnDCs(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch return DCs:", error);
            toast({ title: "Error", description: "Failed to load return delivery challans", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchSupportingData = useCallback(async () => {
        try {
            const { apiFetch } = await import("@/lib/api");
            const [dcData, custData] = await Promise.all([
                getDeliveryChallans(),
                apiFetch("/customers"),
            ]);
            setDeliveryChallans(Array.isArray(dcData) ? dcData : []);
            setCustomers(Array.isArray(custData) ? custData : []);
        } catch (error) {
            console.error("Failed to fetch supporting data:", error);
        }
    }, []);

    useEffect(() => {
        fetchRDCs();
        fetchSupportingData();
    }, [fetchRDCs, fetchSupportingData]);

    const handleCreate = () => { setEditingRDC(null); setDialogOpen(true); };
    const handleEdit = (rdc: ReturnDeliveryChallan) => { setEditingRDC(rdc); setDialogOpen(true); };

    const handleSave = async (data: any) => {
        if (editingRDC) {
            await updateReturnDC(editingRDC.id, data);
            toast({ title: "Success", description: "Return DC updated" });
        } else {
            await createReturnDC(data);
            toast({ title: "Success", description: "Return DC created" });
        }
        setEditingRDC(null);
        setDialogOpen(false);
        fetchRDCs();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteReturnDC(deleteId);
            toast({ title: "Success", description: "Return DC deleted" });
            fetchRDCs();
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
        } finally {
            setDeleteId(null);
        }
    };

    if (viewingRDC) {
        return (
            <PermissionGuard requiredPermission="sale_invoices_view" fallbackMessage="You do not have permission to view return delivery challans.">
                <ReturnDCView returnDC={viewingRDC} onBack={() => setViewingRDC(null)} />
            </PermissionGuard>
        );
    }

    return (
        <PermissionGuard requiredPermission="sale_invoices_view" fallbackMessage="You do not have permission to view return delivery challans.">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Return Delivery Challans</h1>
                        <p className="text-muted-foreground">Handle customer returns and stock reconciliation</p>
                    </div>
                    {canCreate && (
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" /> New Return DC
                        </Button>
                    )}
                </div>

                <ReturnDCTable
                    returnDCs={returnDCs}
                    loading={loading}
                    onView={setViewingRDC}
                    onEdit={canEdit ? handleEdit : undefined}
                    onDelete={canDelete ? (id: string) => setDeleteId(id) : undefined}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />

                <ReturnDCDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onSave={handleSave}
                    editingRDC={editingRDC}
                    deliveryChallans={deliveryChallans}
                    customers={customers}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Return DC?</AlertDialogTitle>
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
