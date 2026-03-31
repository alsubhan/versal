import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { DCTable } from "@/components/delivery-challan/DCTable";
import { DCDialog } from "@/components/delivery-challan/DCDialog";
import { DCView } from "@/components/delivery-challan/DCView";
import { type DeliveryChallan } from "@/types/delivery-challan";
import {
    getDeliveryChallans,
    createDeliveryChallan,
    updateDeliveryChallan,
    deleteDeliveryChallan,
    createPickList,
    convertDCToInvoice,
} from "@/lib/api";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus } from "lucide-react";

export default function DeliveryChallansPage() {
    const [deliveryChallans, setDeliveryChallans] = useState<DeliveryChallan[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingDC, setEditingDC] = useState<DeliveryChallan | null>(null);
    const [viewingDC, setViewingDC] = useState<DeliveryChallan | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [saleInvoices, setSaleInvoices] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const { hasPermission } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const canCreate = hasPermission("sale_invoices_create");
    const canEdit = hasPermission("sale_invoices_edit");
    const canDelete = hasPermission("sale_invoices_delete");

    const fetchDCs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getDeliveryChallans();
            setDeliveryChallans(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch DCs:", error);
            toast({ title: "Error", description: "Failed to load delivery challans", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    const fetchSupportingData = useCallback(async () => {
        try {
            const { apiFetch } = await import("@/lib/api");
            const [siData, custData] = await Promise.all([
                apiFetch("/sale-invoices"),
                apiFetch("/customers"),
            ]);
            setSaleInvoices(Array.isArray(siData) ? siData : []);
            setCustomers(Array.isArray(custData) ? custData : []);
        } catch (error) {
            console.error("Failed to fetch supporting data:", error);
        }
    }, []);

    useEffect(() => {
        fetchDCs();
        fetchSupportingData();
    }, [fetchDCs, fetchSupportingData]);

    const handleCreate = () => {
        setEditingDC(null);
        setDialogOpen(true);
    };

    const handleEdit = (dc: DeliveryChallan) => {
        setEditingDC(dc);
        setDialogOpen(true);
    };

    const handleSave = async (data: any) => {
        if (editingDC) {
            await updateDeliveryChallan(editingDC.id, data);
            toast({ title: "Success", description: "Delivery challan updated" });
        } else {
            await createDeliveryChallan(data);
            toast({ title: "Success", description: "Delivery challan created" });
        }
        setEditingDC(null);
        setDialogOpen(false);
        fetchDCs();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDeliveryChallan(deleteId);
            toast({ title: "Success", description: "Delivery challan deleted" });
            fetchDCs();
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Failed to delete", variant: "destructive" });
        } finally {
            setDeleteId(null);
        }
    };

    const handleGeneratePickList = async (dc: DeliveryChallan) => {
        try {
            await createPickList({
                pickListNumber: `PL-${Date.now().toString().slice(-8)}`,
                deliveryChallanId: dc.id,
            });
            toast({ title: "Success", description: "Pick list generated from DC" });
            navigate("/pick-lists");
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Failed to generate pick list", variant: "destructive" });
        }
    };

    const handleConvertToInvoice = async (dc: DeliveryChallan) => {
        try {
            const result = await convertDCToInvoice(dc.id);
            toast({ title: "Success", description: `Invoice ${result.invoiceNumber} created from DC` });
            fetchDCs();
            navigate("/sale-invoices");
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Failed to convert to invoice", variant: "destructive" });
        }
    };

    if (viewingDC) {
        return (
            <PermissionGuard requiredPermission="sale_invoices_view" fallbackMessage="You do not have permission to view delivery challans.">
                <DCView deliveryChallan={viewingDC} onBack={() => setViewingDC(null)} />
            </PermissionGuard>
        );
    }

    return (
        <PermissionGuard requiredPermission="sale_invoices_view" fallbackMessage="You do not have permission to view delivery challans.">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Delivery Challans</h1>
                        <p className="text-muted-foreground">Manage dispatch documents for goods delivery</p>
                    </div>
                    {canCreate && (
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" /> New Delivery Challan
                        </Button>
                    )}
                </div>

                <DCTable
                    deliveryChallans={deliveryChallans}
                    loading={loading}
                    onView={setViewingDC}
                    onEdit={canEdit ? handleEdit : undefined}
                    onDelete={canDelete ? (id: string) => setDeleteId(id) : undefined}
                    onGeneratePickList={canCreate ? handleGeneratePickList : undefined}
                    onConvertToInvoice={canCreate ? handleConvertToInvoice : undefined}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />

                <DCDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onSave={handleSave}
                    editingDC={editingDC}
                    saleInvoices={saleInvoices}
                    customers={customers}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Delivery Challan?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone. Only draft challans can be deleted.</AlertDialogDescription>
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
