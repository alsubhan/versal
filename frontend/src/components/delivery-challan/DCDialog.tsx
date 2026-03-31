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
import { type DeliveryChallan } from "@/types/delivery-challan";

interface DCDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => Promise<void>;
    editingDC?: DeliveryChallan | null;
    saleInvoices?: any[];
    customers?: any[];
}

export function DCDialog({ open, onOpenChange, onSave, editingDC, saleInvoices = [], customers = [] }: DCDialogProps) {
    const [dcNumber, setDcNumber] = useState("");
    const [saleInvoiceId, setSaleInvoiceId] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [status, setStatus] = useState("draft");
    const [dcDate, setDcDate] = useState(new Date().toISOString().split("T")[0]);
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [driverName, setDriverName] = useState("");
    const [driverPhone, setDriverPhone] = useState("");
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [isStandalone, setIsStandalone] = useState(false);
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editingDC) {
            setDcNumber(editingDC.dcNumber || "");
            setSaleInvoiceId(editingDC.saleInvoiceId || "");
            setCustomerId(editingDC.customerId || "");
            setStatus(editingDC.status || "draft");
            setDcDate(editingDC.dcDate?.split("T")[0] || "");
            setVehicleNumber(editingDC.vehicleNumber || "");
            setDriverName(editingDC.driverName || "");
            setDriverPhone(editingDC.driverPhone || "");
            setDeliveryAddress(editingDC.deliveryAddress || "");
            setIsStandalone(editingDC.isStandalone || false);
            setNotes(editingDC.notes || "");
            setItems(editingDC.items || []);
        } else {
            setDcNumber(`DC-${Date.now().toString().slice(-8)}`);
            setSaleInvoiceId("");
            setCustomerId("");
            setStatus("draft");
            setDcDate(new Date().toISOString().split("T")[0]);
            setVehicleNumber("");
            setDriverName("");
            setDriverPhone("");
            setDeliveryAddress("");
            setIsStandalone(false);
            setNotes("");
            setItems([]);
        }
    }, [editingDC, open]);

    const handleInvoiceSelect = (invoiceId: string) => {
        setSaleInvoiceId(invoiceId);
        const inv = saleInvoices.find((si: any) => si.id === invoiceId);
        if (inv) {
            setCustomerId(inv.customerId || "");
            setIsStandalone(false);
            if (inv.items && inv.items.length > 0) {
                setItems(inv.items.map((it: any) => ({
                    productId: it.productId,
                    productName: it.productName,
                    skuCode: it.skuCode,
                    quantity: it.quantity || 0,
                    dispatchedQuantity: 0,
                    unitPrice: it.unitPrice || 0,
                })));
            }
        }
    };

    const handleItemDispatchedChange = (idx: number, val: number) => {
        setItems((prev) => prev.map((it, i) => i === idx ? { ...it, dispatchedQuantity: val } : it));
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const data: any = {
                dcNumber,
                saleInvoiceId: saleInvoiceId || null,
                customerId: customerId || null,
                status,
                dcDate,
                vehicleNumber,
                driverName,
                driverPhone,
                deliveryAddress,
                isStandalone,
                notes,
                items,
            };
            await onSave(data);
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
                    <DialogTitle>{editingDC ? "Edit Delivery Challan" : "Create Delivery Challan"}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>DC Number</Label>
                        <Input value={dcNumber} onChange={(e) => setDcNumber(e.target.value)} />
                    </div>
                    <div>
                        <Label>Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="dispatched">Dispatched</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {!editingDC && (
                        <div>
                            <Label>From Sale Invoice</Label>
                            <Select value={saleInvoiceId} onValueChange={handleInvoiceSelect}>
                                <SelectTrigger><SelectValue placeholder="Select invoice (optional)" /></SelectTrigger>
                                <SelectContent>
                                    {saleInvoices.map((si: any) => (
                                        <SelectItem key={si.id} value={si.id}>{si.invoiceNumber} — {si.customer?.name || "No customer"}</SelectItem>
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
                        <Label>DC Date</Label>
                        <Input type="date" value={dcDate} onChange={(e) => setDcDate(e.target.value)} />
                    </div>

                    <div>
                        <Label>Vehicle Number</Label>
                        <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. AB-1234-CD" />
                    </div>
                    <div>
                        <Label>Driver Name</Label>
                        <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                    </div>
                    <div>
                        <Label>Driver Phone</Label>
                        <Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
                    </div>
                    <div className="col-span-2">
                        <Label>Delivery Address</Label>
                        <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} rows={2} />
                    </div>
                    <div className="col-span-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                    </div>
                </div>

                {/* Items Table */}
                {items.length > 0 && (
                    <div className="mt-4">
                        <Label className="text-base font-semibold">Items</Label>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Dispatched</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
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
                                                value={item.dispatchedQuantity}
                                                onChange={(e) => handleItemDispatchedChange(idx, parseInt(e.target.value) || 0)}
                                                className="w-20 text-right inline-block"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">{item.unitPrice?.toFixed(2) || "0.00"}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : editingDC ? "Update" : "Create"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
