import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { type PutAway } from "@/types/put-away";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Package, MapPin, CheckCircle2, Clock } from "lucide-react";

interface PutAwayViewProps {
    putAway: PutAway;
    onBack: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pending", variant: "outline" },
    in_progress: { label: "In Progress", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function PutAwayView({ putAway, onBack }: PutAwayViewProps) {
    const status = statusConfig[putAway.status] || statusConfig.pending;
    const totalQty = putAway.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
    const placedQty = putAway.items?.reduce((sum, i) => sum + (i.placedQuantity || 0), 0) || 0;
    const progress = totalQty > 0 ? Math.round((placedQty / totalQty) * 100) : 0;
    const uniqueLocations = new Set(putAway.items?.filter(i => i.locationName).map(i => i.locationName)).size;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold">{putAway.putAwayNumber}</h2>
                    <p className="text-muted-foreground">Put Away Details</p>
                </div>
                <Badge variant={status.variant} className="ml-auto text-sm px-3 py-1">
                    {status.label}
                </Badge>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                            <Package className="h-4 w-4" /> Total Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{putAway.items?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">{totalQty} units total</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" /> Placed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{placedQty}</div>
                        <p className="text-xs text-muted-foreground">{progress}% complete</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Remaining
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">{totalQty - placedQty}</div>
                        <p className="text-xs text-muted-foreground">units to place</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4" /> Locations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{uniqueLocations}</div>
                        <p className="text-xs text-muted-foreground">storage locations</p>
                    </CardContent>
                </Card>
            </div>

            {/* Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">QC Reference:</span>
                            <p className="font-medium">{putAway.qualityCheck?.qcNumber || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">GRN Reference:</span>
                            <p className="font-medium">{putAway.grn?.grnNumber || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Assigned To:</span>
                            <p className="font-medium">{putAway.assignedUser?.fullName || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Date:</span>
                            <p className="font-medium">{putAway.putAwayDate ? formatDate(putAway.putAwayDate) : "—"}</p>
                        </div>
                        {putAway.completedDate && (
                            <div>
                                <span className="text-muted-foreground">Completed:</span>
                                <p className="font-medium">{formatDate(putAway.completedDate)}</p>
                            </div>
                        )}
                        {putAway.notes && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground">Notes:</span>
                                <p className="font-medium">{putAway.notes}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Progress Bar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Placement Progress</span>
                        <span className="text-sm text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">Qty to Place</TableHead>
                                <TableHead className="text-right">Placed</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(putAway.items || []).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.productName || "—"}</TableCell>
                                    <TableCell>{item.skuCode || "—"}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">
                                        <span className={item.placedQuantity >= item.quantity ? "text-green-600 font-medium" : "text-orange-500"}>
                                            {item.placedQuantity}
                                        </span>
                                    </TableCell>
                                    <TableCell>{item.locationName || "—"}</TableCell>
                                    <TableCell>{item.batchNumber || "—"}</TableCell>
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
