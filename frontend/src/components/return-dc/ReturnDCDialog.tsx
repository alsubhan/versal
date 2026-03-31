import { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { type ReturnDeliveryChallan } from "@/types/return-delivery-challan";

interface ReturnDCDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => Promise<void>;
    editingRDC?: ReturnDeliveryChallan | null;
    deliveryChallans?: any[];
    customers?: any[];
}

export function ReturnDCDialog({ open, onOpenChange, onSave, editingRDC, deliveryChallans = [], customers = [] }: ReturnDCDialogProps) {
    const [returnDcNumber, setReturnDcNumber] = useState("");
    const [deliveryChallanId, setDeliveryChallanId] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [status, setStatus] = useState("draft");
    const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editingRDC) {
            setReturnDcNumber(editingRDC.returnDcNumber || "");
            setDeliveryChallanId(editingRDC.deliveryChallanId || "");
            setCustomerId(editingRDC.customerId || "");
            setStatus(editingRDC.status || "draft");
            setReturnDate(editingRDC.returnDate?.split("T")[0] || "");
            setReason(editingRDC.reason || "");
            setNotes(editingRDC.notes || "");
            setItems(editingRDC.items || []);
        } else {
            setReturnDcNumber(`RDC-${Date.now().toString().slice(-8)}`);
            setDeliveryChallanId("");
            setCustomerId("");
            setStatus("draft");
            setReturnDate(new Date().toISOString().split("T")[0]);
            setReason("");
            setNotes("");
            setItems([]);
        }
    }, [editingRDC, open]);

    const handleDCSelect = (dcId: string) => {
        setDeliveryChallanId(dcId);
        const dc = deliveryChallans.find((d: any) => d.id === dcId);
        if (dc) {
            setCustomerId(dc.customerId || "");
            if (dc.items) {
                setItems(dc.items.map((it: any) => ({
                    productId: it.productId,
                    productName: it.productName,
                    skuCode: it.skuCode,
                    deliveredQuantity: it.dispatchedQuantity || it.quantity || 0,
                    returnQuantity: 0,
                    receivedQuantity: 0,
                    condition: "good",
                })));
            }
        }
    };

    const handleItemChange = (idx: number, field: string, val: any) => {
        setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onSave({
                returnDcNumber,
                deliveryChallanId: deliveryChallanId || null,
                customerId: customerId || null,
                status,
                returnDate,
                reason,
                notes,
                items,
            });
            onOpenChange(false);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingRDC ? "Edit Return DC" : "Create Return DC"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>Return DC Number</Label>
                        <Input value={returnDcNumber} onChange={(e) => setReturnDcNumber(e.target.value)} />
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="inspected">Inspected</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {!editingRDC && (
                        <div>
                            <Label>From Delivery Challan</Label>
                            <Select value={deliveryChallanId} onValueChange={handleDCSelect}>
                                <SelectTrigger><SelectValue placeholder="Select DC" /></SelectTrigger>
                                <SelectContent>
                                    {deliveryChallans.map((dc: any) => (
                                        <SelectItem key={dc.id} value={dc.id}>{dc.dcNumber} — {dc.customer?.name || "No customer"}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div>
                        <Label>Customer</Label>
                        <Select value={customerId} onValueChange={setCustomerId}>
                            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                            <SelectContent>
                                {customers.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Return Date</Label>
                        <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                    </div>
                    <div>
                        <Label>Reason</Label>
                        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Defective, Wrong item" />
                    </div>
                    <div className="col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>
                </div>

                {items.length > 0 && (
                    <div className="mt-4">
                        <Label className="text-base font-semibold">Return Items</Label>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-right">Delivered</TableHead>
                                    <TableHead className="text-right">Return Qty</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                    <TableHead>Condition</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{item.productName || "—"}</TableCell>
                                        <TableCell className="text-right">{item.deliveredQuantity}</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={item.deliveredQuantity}
                                                value={item.returnQuantity}
                                                onChange={(e) => handleItemChange(idx, "returnQuantity", parseInt(e.target.value) || 0)}
                                                className="w-20 text-right inline-block"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={item.returnQuantity}
                                                value={item.receivedQuantity}
                                                onChange={(e) => handleItemChange(idx, "receivedQuantity", parseInt(e.target.value) || 0)}
                                                className="w-20 text-right inline-block"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Select value={item.condition || "good"} onValueChange={(val) => handleItemChange(idx, "condition", val)}>
                                                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="good">Good</SelectItem>
                                                    <SelectItem value="damaged">Damaged</SelectItem>
                                                    <SelectItem value="defective">Defective</SelectItem>
                                                    <SelectItem value="expired">Expired</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={item.reason || ""}
                                                onChange={(e) => handleItemChange(idx, "reason", e.target.value)}
                                                className="w-32"
                                                placeholder="Reason"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : editingRDC ? "Update" : "Create"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
