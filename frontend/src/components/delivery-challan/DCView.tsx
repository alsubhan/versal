import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { type DeliveryChallan } from "@/types/delivery-challan";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Package, Truck, MapPin, User } from "lucide-react";

interface DCViewProps {
    deliveryChallan: DeliveryChallan;
    onBack: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "outline" },
    dispatched: { label: "Dispatched", variant: "secondary" },
    delivered: { label: "Delivered", variant: "default" },
    invoiced: { label: "Invoiced", variant: "default" },
    returned: { label: "Returned", variant: "destructive" },
    partial_return: { label: "Partial Return", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function DCView({ deliveryChallan: dc, onBack }: DCViewProps) {
    const st = statusConfig[dc.status] || statusConfig.draft;
    const totalQty = dc.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
    const dispatched = dc.items?.reduce((s, i) => s + (i.dispatchedQuantity || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
                <div>
                    <h2 className="text-2xl font-bold">{dc.dcNumber}</h2>
                    <p className="text-muted-foreground">Delivery Challan Details</p>
                </div>
                <Badge variant={st.variant} className="ml-auto text-sm px-3 py-1">{st.label}</Badge>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" /> Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{dc.items?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">{totalQty} units total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Truck className="h-4 w-4" /> Dispatched</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{dispatched}</div>
                        <p className="text-xs text-muted-foreground">{totalQty > 0 ? Math.round((dispatched / totalQty) * 100) : 0}% dispatched</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold truncate">{dc.customer?.name || "—"}</div>
                        <p className="text-xs text-muted-foreground">{dc.customer?.phone || ""}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4" /> Delivery</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-medium truncate">{dc.deliveryAddress || "—"}</div>
                        <p className="text-xs text-muted-foreground">{dc.vehicleNumber ? `Vehicle: ${dc.vehicleNumber}` : ""}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Info */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Information</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Invoice:</span>
                            <p className="font-medium">{dc.saleInvoice?.invoiceNumber || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Sale Order:</span>
                            <p className="font-medium">{dc.salesOrder?.orderNumber || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">DC Date:</span>
                            <p className="font-medium">{dc.dcDate ? formatDate(dc.dcDate) : "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Type:</span>
                            <p className="font-medium">{dc.isStandalone ? "Standalone" : "Invoice-backed"}</p>
                        </div>
                        {dc.driverName && (
                            <div>
                                <span className="text-muted-foreground">Driver:</span>
                                <p className="font-medium">{dc.driverName}{dc.driverPhone ? ` (${dc.driverPhone})` : ""}</p>
                            </div>
                        )}
                        {dc.dispatchDate && (
                            <div>
                                <span className="text-muted-foreground">Dispatched:</span>
                                <p className="font-medium">{formatDate(dc.dispatchDate)}</p>
                            </div>
                        )}
                        {dc.deliveryDate && (
                            <div>
                                <span className="text-muted-foreground">Delivered:</span>
                                <p className="font-medium">{formatDate(dc.deliveryDate)}</p>
                            </div>
                        )}
                        {dc.notes && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Notes:</span>
                                <p className="font-medium">{dc.notes}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Items */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Items</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Dispatched</TableHead>
                                <TableHead className="text-right">Unit Price</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(dc.items || []).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.productName || "—"}</TableCell>
                                    <TableCell>{item.skuCode || "—"}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={item.dispatchedQuantity >= item.quantity ? "text-green-600 font-medium" : "text-orange-500"}>{item.dispatchedQuantity}</span>
                                    </TableCell>
                                    <TableCell className="text-right">{item.unitPrice?.toFixed(2) || "0.00"}</TableCell>
                                    <TableCell>{item.notes || "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
