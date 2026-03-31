import { useState } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2, ClipboardList, Receipt } from "lucide-react";
import { type DeliveryChallan } from "@/types/delivery-challan";
import { formatDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface DCTableProps {
    deliveryChallans: DeliveryChallan[];
    loading: boolean;
    onView: (dc: DeliveryChallan) => void;
    onEdit?: (dc: DeliveryChallan) => void;
    onDelete?: (id: string) => void;
    onGeneratePickList?: (dc: DeliveryChallan) => void;
    onConvertToInvoice?: (dc: DeliveryChallan) => void;
    canEdit: boolean;
    canDelete: boolean;
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

export function DCTable({ deliveryChallans, loading, onView, onEdit, onDelete, onGeneratePickList, onConvertToInvoice, canEdit, canDelete }: DCTableProps) {
    const [sortCol, setSortCol] = useState("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const handleSort = (col: string) => {
        if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    };

    const sorted = [...deliveryChallans].sort((a: any, b: any) => {
        const av = a[sortCol] ?? "", bv = b[sortCol] ?? "";
        const c = String(av).localeCompare(String(bv));
        return sortDir === "asc" ? c : -c;
    });

    const icon = (col: string) => sortCol !== col ? "↕" : sortDir === "asc" ? "↑" : "↓";

    if (loading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>DC #</TableHead><TableHead>Customer</TableHead><TableHead>Reference</TableHead>
                        <TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>{[...Array(5)].map((_, i) => (
                        <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>)}</TableRow>
                    ))}</TableBody>
                </Table>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("dcNumber")}>DC # {icon("dcNumber")}</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>Status {icon("status")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("dcDate")}>Date {icon("dcDate")}</TableHead>
                        <TableHead>Transport</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No delivery challans found</TableCell></TableRow>
                    ) : sorted.map((dc) => {
                        const st = statusConfig[dc.status] || statusConfig.draft;
                        const ref = dc.saleInvoice?.invoiceNumber || dc.salesOrder?.orderNumber || (dc.isStandalone ? "Standalone" : "—");
                        return (
                            <TableRow key={dc.id}>
                                <TableCell className="font-medium">{dc.dcNumber}</TableCell>
                                <TableCell>{dc.customer?.name || "—"}</TableCell>
                                <TableCell>{ref}</TableCell>
                                <TableCell>{dc.items?.length || 0} items</TableCell>
                                <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                                <TableCell>{dc.dcDate ? formatDate(dc.dcDate) : "—"}</TableCell>
                                <TableCell className="text-sm">{dc.vehicleNumber || "—"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => onView(dc)}><Eye className="h-4 w-4" /></Button>
                                                </TooltipTrigger>
                                                <TooltipContent>View</TooltipContent>
                                            </Tooltip>
                                            {canEdit && onEdit && dc.status === "draft" && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onEdit(dc)}><Edit className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Edit</TooltipContent>
                                                </Tooltip>
                                            )}
                                            {canDelete && onDelete && dc.status === "draft" && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onDelete(dc.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete</TooltipContent>
                                                </Tooltip>
                                            )}
                                            {onGeneratePickList && dc.status === "draft" && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onGeneratePickList(dc)}><ClipboardList className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Generate Pick List</TooltipContent>
                                                </Tooltip>
                                            )}
                                            {onConvertToInvoice && (dc.status === "dispatched" || dc.status === "delivered") && !dc.saleInvoice && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onConvertToInvoice(dc)}><Receipt className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Convert to Invoice</TooltipContent>
                                                </Tooltip>
                                            )}
                                        </TooltipProvider>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
