import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QCTable } from "@/components/qc/QCTable";
import { QCDialog } from "@/components/qc/QCDialog";
import { QCView } from "@/components/qc/QCView";
import { type QualityCheck } from "@/types/quality-check";
import { getQualityChecks, deleteQualityCheck, getUsers, createPutAway } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const QualityChecksPage = () => {
    const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingQC, setEditingQC] = useState<QualityCheck | null>(null);
    const [viewingQC, setViewingQC] = useState<QualityCheck | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const { hasPermission } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const canCreate = hasPermission('grn_create');
    const canEdit = hasPermission('grn_edit');
    const canDelete = hasPermission('grn_delete');

    const fetchQualityChecks = async () => {
        setLoading(true);
        try {
            const data = await getQualityChecks();
            setQualityChecks(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching quality checks:", error);
            setQualityChecks([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    useEffect(() => {
        fetchQualityChecks();
        fetchUsers();
    }, []);

    const handleView = (qc: QualityCheck) => {
        setViewingQC(qc);
    };

    const handleEdit = (qc: QualityCheck) => {
        setEditingQC(qc);
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteQualityCheck(deleteId);
            toast({ title: "Success", description: "Quality check deleted successfully" });
            fetchQualityChecks();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to delete quality check",
                variant: "destructive",
            });
        } finally {
            setDeleteId(null);
        }
    };

    const handleDialogSuccess = () => {
        setDialogOpen(false);
        setEditingQC(null);
        fetchQualityChecks();
    };

    const handleSendToPutAway = async (qc: QualityCheck) => {
        try {
            await createPutAway({
                qualityCheckId: qc.id,
                grnId: qc.grnId,
                status: "pending",
            });
            toast({ title: "Success", description: "Put Away created from QC. Navigating..." });
            navigate("/put-aways");
        } catch (error: any) {
            toast({
                title: "Error",
                description: error?.message || "Failed to create put away",
                variant: "destructive",
            });
        }
    };

    if (viewingQC) {
        return (
            <PermissionGuard
                requiredPermission="grn_view"
                fallbackMessage="You do not have permission to view quality checks."
            >
                <QCView
                    qualityCheck={viewingQC}
                    onBack={() => setViewingQC(null)}
                />
            </PermissionGuard>
        );
    }

    return (
        <PermissionGuard
            requiredPermission="grn_view"
            fallbackMessage="You do not have permission to view quality checks. Please contact an administrator."
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Quality Checks</h1>
                    {canCreate && (
                        <Button
                            onClick={() => {
                                setEditingQC(null);
                                setDialogOpen(true);
                            }}
                            className="flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> New Quality Check
                        </Button>
                    )}
                </div>

                <QCTable
                    qualityChecks={qualityChecks}
                    loading={loading}
                    onView={handleView}
                    onEdit={canEdit ? handleEdit : undefined}
                    onDelete={canDelete ? handleDelete : undefined}
                    onSendToPutAway={canCreate ? handleSendToPutAway : undefined}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />

                <QCDialog
                    open={dialogOpen}
                    onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) setEditingQC(null);
                    }}
                    qualityCheck={editingQC}
                    onSuccess={handleDialogSuccess}
                    users={users}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Quality Check?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the quality check and all its items.
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

export default QualityChecksPage;
