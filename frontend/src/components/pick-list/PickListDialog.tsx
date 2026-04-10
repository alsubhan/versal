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
import { type PickList } from "@/types/pick-list";

interface PickListDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => Promise<void>;
    editingPL?: PickList | null;
    deliveryChallans?: any[];
    users?: any[];
}

export function PickListDialog({ open, onOpenChange, onSave, editingPL, deliveryChallans = [], users = [] }: PickListDialogProps) {
    const [pickListNumber, setPickListNumber] = useState("");
    const [deliveryChallanId, setDeliveryChallanId] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [status, setStatus] = useState("pending");
    const [pickDate, setPickDate] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editingPL) {
            setPickListNumber(editingPL.pickListNumber || "");
            setDeliveryChallanId(editingPL.deliveryChallanId || "");
            setAssignedTo(editingPL.assignedTo || "");
            setStatus(editingPL.status || "pending");
            setPickDate(editingPL.pickDate?.split("T")[0] || "");
            setNotes(editingPL.notes || "");
            setItems(editingPL.items || []);
        } else {
            setPickListNumber(`PL-${Date.now().toString().slice(-8)}`);
            setDeliveryChallanId("");
            setAssignedTo("");
            setStatus("pending");
            setPickDate(new Date().toISOString().split("T")[0]);
            setNotes("");
            setItems([]);
        }
    }, [editingPL, open]);

    const handleDCSelect = (dcId: string) => {
        setDeliveryChallanId(dcId);
        const dc = deliveryChallans.find((d: any) => d.id === dcId);
        if (dc?.items) {
            setItems(dc.items.map((it: any) => ({
                productId: it.productId,
                productName: it.productName,
                skuCode: it.skuCode,
                quantity: it.quantity || 0,
                pickedQuantity: it.quantity || 0,  // Default to required qty; picker adjusts if partial
            })));
        }
    };

    const handleItemPickedChange = (idx: number, val: number) => {
        setItems((prev) => prev.map((it, i) => i === idx ? { ...it, pickedQuantity: val } : it));
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await onSave({
                pickListNumber,
                deliveryChallanId: deliveryChallanId || null,
                assignedTo: assignedTo || null,
                status,
                pickDate,
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingPL ? "Edit Pick List" : "Create Pick List"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>Pick List Number</Label>
                        <Input value={pickListNumber} onChange={(e) => setPickListNumber(e.target.value)} />
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {!editingPL && (
                        <div>
                            <Label>Delivery Challan</Label>
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
                        <Label>Assigned To</Label>
                        <Select value={assignedTo} onValueChange={setAssignedTo}>
                            <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                            <SelectContent>
                                {users.map((u: any) => (
                                    <SelectItem key={u.id} value={u.id}>{u.fullName || u.full_name || u.username}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label>Pick Date</Label>
                        <Input type="date" value={pickDate} onChange={(e) => setPickDate(e.target.value)} />
                    </div>
                    <div className="col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>
                </div>

                {items.length > 0 && (
                    <div className="mt-4">
                        <Label className="text-base font-semibold">Items to Pick</Label>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Qty Required</TableHead>
                                    <TableHead className="text-right">Picked</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{item.productName || "—"}</TableCell>
                                        <TableCell>{item.skuCode || "—"}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={item.quantity}
                                                value={item.pickedQuantity}
                                                onChange={(e) => handleItemPickedChange(idx, parseInt(e.target.value) || 0)}
                                                className="w-20 text-right inline-block"
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
                    <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : editingPL ? "Update" : "Create"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
