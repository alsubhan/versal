import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { type ReturnDeliveryChallan } from "@/types/return-delivery-challan";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Package, RotateCcw, User, AlertTriangle } from "lucide-react";

interface ReturnDCViewProps {
    returnDC: ReturnDeliveryChallan;
    onBack: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "outline" },
    received: { label: "Received", variant: "secondary" },
    inspected: { label: "Inspected", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

const conditionColors: Record<string, string> = {
    good: "text-green-600",
    damaged: "text-orange-500",
    defective: "text-red-500",
    expired: "text-red-700",
};

export function ReturnDCView({ returnDC: rdc, onBack }: ReturnDCViewProps) {
    const st = statusConfig[rdc.status] || statusConfig.draft;
    const totalReturn = rdc.items?.reduce((s, i) => s + i.returnQuantity, 0) || 0;
    const totalReceived = rdc.items?.reduce((s, i) => s + i.receivedQuantity, 0) || 0;
    const damagedCount = rdc.items?.filter((i) => i.condition !== "good").length || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
                <div>
                    <h2 className="text-2xl font-bold">{rdc.returnDcNumber}</h2>
                    <p className="text-muted-foreground">Return Delivery Challan Details</p>
                </div>
                <Badge variant={st.variant} className="ml-auto text-sm px-3 py-1">{st.label}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" /> Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{rdc.items?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">{totalReturn} units to return</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Received</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{totalReceived}</div>
                        <p className="text-xs text-muted-foreground">{totalReturn > 0 ? Math.round((totalReceived / totalReturn) * 100) : 0}% received</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold truncate">{rdc.customer?.name || "—"}</div>
                        <p className="text-xs text-muted-foreground">{rdc.customer?.phone || ""}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{damagedCount}</div>
                        <p className="text-xs text-muted-foreground">non-good condition items</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-lg">Information</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Original DC:</span>
                            <p className="font-medium">{rdc.deliveryChallan?.dcNumber || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Return Date:</span>
                            <p className="font-medium">{rdc.returnDate ? formatDate(rdc.returnDate) : "—"}</p>
                        </div>
                        {rdc.receivedDate && (
                            <div>
                                <span className="text-muted-foreground">Received:</span>
                                <p className="font-medium">{formatDate(rdc.receivedDate)}</p>
                            </div>
                        )}
                        {rdc.completedDate && (
                            <div>
                                <span className="text-muted-foreground">Completed:</span>
                                <p className="font-medium">{formatDate(rdc.completedDate)}</p>
                            </div>
                        )}
                        {rdc.reason && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Reason:</span>
                                <p className="font-medium">{rdc.reason}</p>
                            </div>
                        )}
                        {rdc.notes && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Notes:</span>
                                <p className="font-medium">{rdc.notes}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-lg">Returned Items</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">Delivered</TableHead>
                                <TableHead className="text-right">Returning</TableHead>
                                <TableHead className="text-right">Received</TableHead>
                                <TableHead>Condition</TableHead>
                                <TableHead>Reason</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(rdc.items || []).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.productName || "—"}</TableCell>
                                    <TableCell>{item.skuCode || "—"}</TableCell>
                                    <TableCell className="text-right">{item.deliveredQuantity}</TableCell>
                                    <TableCell className="text-right">{item.returnQuantity}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={item.receivedQuantity >= item.returnQuantity ? "text-green-600 font-medium" : "text-orange-500"}>
                                            {item.receivedQuantity}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`font-medium capitalize ${conditionColors[item.condition] || ""}`}>{item.condition}</span>
                                    </TableCell>
                                    <TableCell>{item.reason || "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
