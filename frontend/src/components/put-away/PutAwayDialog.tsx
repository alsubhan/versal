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
import { type PutAway, type PutAwayItem } from "@/types/put-away";
import { type QualityCheck } from "@/types/quality-check";
import { getQualityChecks, getInventoryLocations, getUsers } from "@/lib/api";

interface PutAwayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    putAway?: PutAway | null;
    onSave: (data: any) => Promise<void> | void;
}

export function PutAwayDialog({ open, onOpenChange, putAway, onSave }: PutAwayDialogProps) {
    const isEdit = !!putAway;

    const [putAwayNumber, setPutAwayNumber] = useState("");
    const [qualityCheckId, setQualityCheckId] = useState("");
    const [grnId, setGrnId] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [status, setStatus] = useState<string>("pending");
    const [putAwayDate, setPutAwayDate] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<any[]>([]);

    const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            loadReferenceData();
            if (isEdit && putAway) {
                setPutAwayNumber(putAway.putAwayNumber || "");
                setQualityCheckId(putAway.qualityCheckId || "");
                setGrnId(putAway.grnId || "");
                setAssignedTo(putAway.assignedTo || "");
                setStatus(putAway.status || "pending");
                setPutAwayDate(putAway.putAwayDate || new Date().toISOString().split("T")[0]);
                setNotes(putAway.notes || "");
                setItems(
                    (putAway.items || []).map((item) => ({
                        id: item.id,
                        qualityCheckItemId: item.qualityCheckItemId,
                        productId: item.productId,
                        productName: item.productName,
                        skuCode: item.skuCode,
                        quantity: item.quantity,
                        placedQuantity: item.placedQuantity,
                        locationId: item.locationId || "",
                        locationName: item.locationName || "",
                        batchNumber: item.batchNumber || "",
                        notes: item.notes || "",
                    }))
                );
            } else {
                // Reset for new
                const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
                setPutAwayNumber(`PA-${ts}`);
                setQualityCheckId("");
                setGrnId("");
                setAssignedTo("");
                setStatus("pending");
                setPutAwayDate(new Date().toISOString().split("T")[0]);
                setNotes("");
                setItems([]);
            }
        }
    }, [open, putAway]);

    const loadReferenceData = async () => {
        try {
            const [qcData, locData, userData] = await Promise.all([
                getQualityChecks(),
                getInventoryLocations(),
                getUsers(),
            ]);
            // Only show passed or partial QCs for selection
            setQualityChecks((qcData || []).filter((qc: QualityCheck) => ["passed", "partial"].includes(qc.status)));
            setLocations(locData || []);
            setUsers(userData || []);
        } catch (err) {
            console.error("Failed to load reference data:", err);
        }
    };

    const handleQCSelect = (qcId: string) => {
        setQualityCheckId(qcId);
        const selectedQC = qualityChecks.find((qc) => qc.id === qcId);
        if (selectedQC) {
            setGrnId(selectedQC.grnId || "");
            // Auto-populate items from QC passed quantities
            const qcItems = (selectedQC.items || [])
                .filter((item) => (item.passedQuantity || 0) > 0)
                .map((item) => ({
                    qualityCheckItemId: item.id,
                    productId: item.productId,
                    productName: item.productName,
                    skuCode: item.skuCode,
                    quantity: item.passedQuantity || 0,
                    placedQuantity: 0,
                    locationId: "",
                    locationName: "",
                    batchNumber: "",
                    notes: "",
                }));
            setItems(qcItems);
        }
    };

    const updateItem = (index: number, field: string, value: any) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };

        // If setting location, also set location name
        if (field === "locationId") {
            const loc = locations.find((l: any) => l.id === value);
            updated[index].locationName = loc?.name || "";
        }

        setItems(updated);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const data: any = {
                putAwayNumber,
                qualityCheckId: qualityCheckId || undefined,
                grnId: grnId || undefined,
                assignedTo: assignedTo || undefined,
                status,
                putAwayDate,
                notes: notes || undefined,
                items: items.map((item) => ({
                    ...(item.id ? { id: item.id } : {}),
                    qualityCheckItemId: item.qualityCheckItemId,
                    productId: item.productId,
                    productName: item.productName,
                    skuCode: item.skuCode,
                    quantity: item.quantity,
                    placedQuantity: Number(item.placedQuantity) || 0,
                    locationId: item.locationId || undefined,
                    locationName: item.locationName || undefined,
                    batchNumber: item.batchNumber || undefined,
                    notes: item.notes || undefined,
                })),
            };
            await onSave(data);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Put Away" : "New Put Away"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <div>
                        <Label>PA Number</Label>
                        <Input value={putAwayNumber} onChange={(e) => setPutAwayNumber(e.target.value)} />
                    </div>

                    {!isEdit && (
                        <div>
                            <Label>Quality Check</Label>
                            <Select value={qualityCheckId} onValueChange={handleQCSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select QC..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {qualityChecks.map((qc) => (
                                        <SelectItem key={qc.id} value={qc.id}>
                                            {qc.qcNumber} ({qc.status})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div>
                        <Label>Assigned To</Label>
                        <Select value={assignedTo} onValueChange={setAssignedTo}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select worker..." />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((user: any) => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.fullName || user.username || user.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Date</Label>
                        <Input type="date" value={putAwayDate} onChange={(e) => setPutAwayDate(e.target.value)} />
                    </div>

                    <div className="col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>
                </div>

                {/* Items */}
                {items.length > 0 && (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Qty to Place</TableHead>
                                    <TableHead className="text-right w-[120px]">Placed Qty</TableHead>
                                    <TableHead className="w-[200px]">Location</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium">{item.productName}</TableCell>
                                        <TableCell>{item.skuCode || "—"}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={item.quantity}
                                                value={item.placedQuantity}
                                                onChange={(e) => updateItem(idx, "placedQuantity", Number(e.target.value))}
                                                className="w-[100px]"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select value={item.locationId} onValueChange={(v) => updateItem(idx, "locationId", v)}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select location..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {locations.map((loc: any) => (
                                                        <SelectItem key={loc.id} value={loc.id}>
                                                            {loc.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.notes || ""}
                                                onChange={(e) => updateItem(idx, "notes", e.target.value)}
                                                placeholder="Notes..."
                                                className="w-[120px]"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {items.length === 0 && !isEdit && (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        Select a Quality Check to auto-populate items
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || items.length === 0}>
                        {loading ? "Saving..." : isEdit ? "Update" : "Create"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
