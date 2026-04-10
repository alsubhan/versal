import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { type QualityCheck, type QualityCheckItem } from "@/types/quality-check";
import { getGoodReceiveNotes, createQualityCheck, updateQualityCheck } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface QCDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    qualityCheck?: QualityCheck | null;
    grnId?: string | null;
    onSuccess: () => void;
    users?: any[];
}

export function QCDialog({ open, onOpenChange, qualityCheck, grnId, onSuccess, users = [] }: QCDialogProps) {
    const isEditing = !!qualityCheck;
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [grns, setGrns] = useState<any[]>([]);
    const [loadingGrns, setLoadingGrns] = useState(false);

    const [formData, setFormData] = useState({
        qcNumber: "",
        grnId: "",
        inspectorId: "",
        qcDate: new Date().toISOString().split('T')[0],
        status: "pending" as string,
        notes: "",
    });

    const [items, setItems] = useState<Partial<QualityCheckItem>[]>([]);

    // Generate QC number
    const generateQcNumber = () => {
        const date = new Date();
        const dateStr = date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `QC-${dateStr}-${random}`;
    };

    // Load GRNs for dropdown
    useEffect(() => {
        if (open && !isEditing) {
            setLoadingGrns(true);
            getGoodReceiveNotes()
                .then((data: any) => {
                    const filteredGrns = Array.isArray(data)
                        ? data.filter((g: any) => ['draft', 'partial', 'received', 'completed'].includes(g.status))
                        : [];
                    setGrns(filteredGrns);
                })
                .catch((err: any) => {
                    console.error("Error loading GRNs:", err);
                    setGrns([]);
                })
                .finally(() => setLoadingGrns(false));
        }
    }, [open, isEditing]);

    // Populate form when editing or creating from GRN
    useEffect(() => {
        if (open) {
            if (isEditing && qualityCheck) {
                setFormData({
                    qcNumber: qualityCheck.qcNumber || "",
                    grnId: qualityCheck.grnId || "",
                    inspectorId: qualityCheck.inspectorId || "",
                    qcDate: qualityCheck.qcDate ? new Date(qualityCheck.qcDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    status: qualityCheck.status || "pending",
                    notes: qualityCheck.notes || "",
                });
                setItems(qualityCheck.items || []);
            } else {
                const newQcNumber = generateQcNumber();
                setFormData({
                    qcNumber: newQcNumber,
                    grnId: grnId || "",
                    inspectorId: "",
                    qcDate: new Date().toISOString().split('T')[0],
                    status: "pending",
                    notes: "",
                });
                setItems([]);
            }
        }
    }, [open, qualityCheck, isEditing, grnId]);

    const handleGrnChange = (selectedGrnId: string) => {
        setFormData(prev => ({ ...prev, grnId: selectedGrnId }));
        // Find the selected GRN and populate items
        const selectedGrn = grns.find(g => g.id === selectedGrnId);
        if (selectedGrn && selectedGrn.items) {
            const qcItems = selectedGrn.items.map((grnItem: any) => ({
                grnItemId: grnItem.id,
                productId: grnItem.productId,
                productName: grnItem.productName || '',
                skuCode: grnItem.skuCode || '',
                receivedQuantity: (grnItem.receivedQuantity || 0) - (grnItem.rejectedQuantity || 0),
                inspectedQuantity: 0,
                passedQuantity: 0,
                failedQuantity: 0,
                failureReason: "",
                notes: "",
            }));
            setItems(qcItems);
        }
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const updated = [...items];
        (updated[index] as any)[field] = value;

        // Auto-calculate: if inspected changes, update passed (passed = inspected - failed)
        if (field === "inspectedQuantity") {
            const inspected = Number(value) || 0;
            const failed = Number(updated[index].failedQuantity) || 0;
            updated[index].passedQuantity = Math.max(0, inspected - failed);
        }
        if (field === "failedQuantity") {
            const inspected = Number(updated[index].inspectedQuantity) || 0;
            const failed = Number(value) || 0;
            updated[index].passedQuantity = Math.max(0, inspected - failed);
        }

        setItems(updated);
    };

    const handleSubmit = async () => {
        if (!formData.grnId) {
            toast({ title: "Error", description: "Please select a GRN", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                qcNumber: formData.qcNumber,
                grnId: formData.grnId,
                inspectorId: formData.inspectorId || undefined,
                qcDate: formData.qcDate,
                status: formData.status,
                notes: formData.notes,
                items: items.map(item => ({
                    grnItemId: item.grnItemId,
                    productId: item.productId,
                    productName: item.productName,
                    skuCode: item.skuCode,
                    receivedQuantity: Number(item.receivedQuantity) || 0,
                    inspectedQuantity: Number(item.inspectedQuantity) || 0,
                    passedQuantity: Number(item.passedQuantity) || 0,
                    failedQuantity: Number(item.failedQuantity) || 0,
                    failureReason: item.failureReason || "",
                    notes: item.notes || "",
                })),
            };

            if (isEditing && qualityCheck) {
                await updateQualityCheck(qualityCheck.id, payload);
                toast({ title: "Success", description: "Quality check updated successfully" });
            } else {
                await createQualityCheck(payload);
                toast({ title: "Success", description: "Quality check created successfully" });
            }
            onSuccess();
        } catch (error: any) {
            console.error("Error saving quality check:", error);
            toast({
                title: "Error",
                description: error?.message || "Failed to save quality check",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[900px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Quality Check" : "Create Quality Check"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="qcNumber">QC Number</Label>
                        <Input
                            id="qcNumber"
                            value={formData.qcNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, qcNumber: e.target.value }))}
                            disabled={isEditing}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="grnId">GRN</Label>
                        {isEditing ? (
                            <Input value={qualityCheck?.grn?.grnNumber || formData.grnId} disabled />
                        ) : (
                            <Select
                                value={formData.grnId}
                                onValueChange={handleGrnChange}
                                disabled={!!grnId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingGrns ? "Loading..." : "Select GRN"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {grns.map((grn: any) => (
                                        <SelectItem key={grn.id} value={grn.id}>
                                            {grn.grnNumber} ({grn.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="inspectorId">Inspector</Label>
                        <Select value={formData.inspectorId} onValueChange={(v) => setFormData(prev => ({ ...prev, inspectorId: v }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Inspector" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.fullName || user.full_name || user.username}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="qcDate">QC Date</Label>
                        <Input
                            id="qcDate"
                            type="date"
                            value={formData.qcDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, qcDate: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="passed">Passed</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Add any notes about this quality check..."
                            rows={2}
                        />
                    </div>
                </div>

                {/* Items Table */}
                {items.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">Items</Label>
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[150px]">Product</TableHead>
                                        <TableHead className="min-w-[80px]">SKU</TableHead>
                                        <TableHead className="min-w-[80px] text-right">Received</TableHead>
                                        <TableHead className="min-w-[90px] text-right">Inspected</TableHead>
                                        <TableHead className="min-w-[80px] text-right">Passed</TableHead>
                                        <TableHead className="min-w-[80px] text-right">Failed</TableHead>
                                        <TableHead className="min-w-[120px]">Failure Reason</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.productName || 'N/A'}</TableCell>
                                            <TableCell>{item.skuCode || 'N/A'}</TableCell>
                                            <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={item.receivedQuantity}
                                                    value={item.inspectedQuantity || ""}
                                                    onChange={(e) => handleItemChange(index, "inspectedQuantity", Number(e.target.value))}
                                                    className="w-20 text-right"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                {item.passedQuantity || 0}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={item.inspectedQuantity}
                                                    value={item.failedQuantity || ""}
                                                    onChange={(e) => handleItemChange(index, "failedQuantity", Number(e.target.value))}
                                                    className="w-20 text-right"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={item.failureReason || ""}
                                                    onChange={(e) => handleItemChange(index, "failureReason", e.target.value)}
                                                    placeholder="Reason..."
                                                    className="w-full"
                                                    disabled={!item.failedQuantity}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Saving..." : isEditing ? "Update" : "Create"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
