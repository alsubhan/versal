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
import { ArrowLeft } from "lucide-react";
import { type QualityCheck } from "@/types/quality-check";
import { formatDate } from "@/lib/utils";

interface QCViewProps {
    qualityCheck: QualityCheck;
    onBack: () => void;
}

export function QCView({ qualityCheck, onBack }: QCViewProps) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case "passed": return "bg-green-100 text-green-800 border-green-200";
            case "partial": return "bg-blue-100 text-blue-800 border-blue-200";
            case "failed": return "bg-red-100 text-red-800 border-red-200";
            case "in_progress": return "bg-orange-100 text-orange-800 border-orange-200";
            default: return "bg-yellow-100 text-yellow-800 border-yellow-200";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "in_progress": return "In Progress";
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    const totalReceived = qualityCheck.items?.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0) || 0;
    const totalInspected = qualityCheck.items?.reduce((sum, item) => sum + (item.inspectedQuantity || 0), 0) || 0;
    const totalPassed = qualityCheck.items?.reduce((sum, item) => sum + (item.passedQuantity || 0), 0) || 0;
    const totalFailed = qualityCheck.items?.reduce((sum, item) => sum + (item.failedQuantity || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-bold">Quality Check: {qualityCheck.qcNumber}</h2>
                <Badge variant="outline" className={getStatusColor(qualityCheck.status)}>
                    {getStatusLabel(qualityCheck.status)}
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">QC Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">QC Number</span>
                            <span className="font-medium">{qualityCheck.qcNumber}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">GRN Number</span>
                            <span className="font-medium">{qualityCheck.grn?.grnNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Inspector</span>
                            <span className="font-medium">{qualityCheck.inspectorName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">QC Date</span>
                            <span className="font-medium">{qualityCheck.qcDate ? formatDate(qualityCheck.qcDate) : 'N/A'}</span>
                        </div>
                        {qualityCheck.notes && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Notes</span>
                                <span className="font-medium text-right max-w-[60%]">{qualityCheck.notes}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Received</span>
                            <span className="font-medium">{totalReceived}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Inspected</span>
                            <span className="font-medium">{totalInspected}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Passed</span>
                            <span className="font-medium text-green-600">{totalPassed}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Failed</span>
                            <span className="font-medium text-red-600">{totalFailed}</span>
                        </div>
                        {totalInspected > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Pass Rate</span>
                                <span className="font-medium">
                                    {((totalPassed / totalInspected) * 100).toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Items ({qualityCheck.items?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Received</TableHead>
                                    <TableHead className="text-right">Inspected</TableHead>
                                    <TableHead className="text-right">Passed</TableHead>
                                    <TableHead className="text-right">Failed</TableHead>
                                    <TableHead>Failure Reason</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {qualityCheck.items && qualityCheck.items.length > 0 ? (
                                    qualityCheck.items.map((item, index) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell className="font-medium">{item.productName || 'N/A'}</TableCell>
                                            <TableCell>{item.skuCode || 'N/A'}</TableCell>
                                            <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                                            <TableCell className="text-right">{item.inspectedQuantity}</TableCell>
                                            <TableCell className="text-right text-green-600">{item.passedQuantity}</TableCell>
                                            <TableCell className="text-right text-red-600">{item.failedQuantity}</TableCell>
                                            <TableCell className="max-w-[150px] truncate">{item.failureReason || '—'}</TableCell>
                                            <TableCell className="max-w-[150px] truncate">{item.notes || '—'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                                            No items found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
