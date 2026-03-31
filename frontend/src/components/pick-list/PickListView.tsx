import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { type PickList } from "@/types/pick-list";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Package, CheckCircle, User, ClipboardList } from "lucide-react";

interface PickListViewProps {
    pickList: PickList;
    onBack: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pending", variant: "outline" },
    in_progress: { label: "In Progress", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function PickListView({ pickList: pl, onBack }: PickListViewProps) {
    const st = statusConfig[pl.status] || statusConfig.pending;
    const totalQty = pl.items?.reduce((s, i) => s + i.quantity, 0) || 0;
    const pickedQty = pl.items?.reduce((s, i) => s + i.pickedQuantity, 0) || 0;
    const pct = totalQty > 0 ? Math.round((pickedQty / totalQty) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
                <div>
                    <h2 className="text-2xl font-bold">{pl.pickListNumber}</h2>
                    <p className="text-muted-foreground">Pick List Details</p>
                </div>
                <Badge variant={st.variant} className="ml-auto text-sm px-3 py-1">{st.label}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" /> Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pl.items?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">{totalQty} units to pick</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Picked</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{pickedQty}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ClipboardList className="h-4 w-4" /> DC</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold">{pl.deliveryChallan?.dcNumber || "—"}</div>
                        <p className="text-xs text-muted-foreground">{pl.deliveryChallan?.status || ""}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" /> Assigned</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold truncate">{pl.assignedUser?.fullName || "Unassigned"}</div>
                        <p className="text-xs text-muted-foreground">{pl.pickDate ? formatDate(pl.pickDate) : ""}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Info */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Information</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Pick Date:</span>
                            <p className="font-medium">{pl.pickDate ? formatDate(pl.pickDate) : "—"}</p>
                        </div>
                        {pl.completedDate && (
                            <div>
                                <span className="text-muted-foreground">Completed:</span>
                                <p className="font-medium">{formatDate(pl.completedDate)}</p>
                            </div>
                        )}
                        {pl.notes && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Notes:</span>
                                <p className="font-medium">{pl.notes}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Items */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Items to Pick</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Picked</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(pl.items || []).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.productName || "—"}</TableCell>
                                    <TableCell>{item.skuCode || "—"}</TableCell>
                                    <TableCell>{item.locationName || "—"}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={item.pickedQuantity >= item.quantity ? "text-green-600 font-medium" : "text-orange-500"}>
                                            {item.pickedQuantity}
                                        </span>
                                    </TableCell>
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
