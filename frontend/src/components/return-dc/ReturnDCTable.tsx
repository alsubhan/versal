import { useState } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2 } from "lucide-react";
import { type ReturnDeliveryChallan } from "@/types/return-delivery-challan";
import { formatDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ReturnDCTableProps {
    returnDCs: ReturnDeliveryChallan[];
    loading: boolean;
    onView: (rdc: ReturnDeliveryChallan) => void;
    onEdit?: (rdc: ReturnDeliveryChallan) => void;
    onDelete?: (id: string) => void;
    canEdit: boolean;
    canDelete: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "outline" },
    received: { label: "Received", variant: "secondary" },
    inspected: { label: "Inspected", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function ReturnDCTable({ returnDCs, loading, onView, onEdit, onDelete, canEdit, canDelete }: ReturnDCTableProps) {
    const [sortCol, setSortCol] = useState("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const handleSort = (col: string) => {
        if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    };

    const sorted = [...returnDCs].sort((a: any, b: any) => {
        const c = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""));
        return sortDir === "asc" ? c : -c;
    });

    const icon = (col: string) => sortCol !== col ? "↕" : sortDir === "asc" ? "↑" : "↓";

    if (loading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>RDC #</TableHead><TableHead>DC #</TableHead><TableHead>Customer</TableHead>
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
                        <TableHead className="cursor-pointer" onClick={() => handleSort("returnDcNumber")}>RDC # {icon("returnDcNumber")}</TableHead>
                        <TableHead>DC #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>Status {icon("status")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("returnDate")}>Return Date {icon("returnDate")}</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No return delivery challans found</TableCell></TableRow>
                    ) : sorted.map((rdc) => {
                        const st = statusConfig[rdc.status] || statusConfig.draft;
                        const totalReturn = rdc.items?.reduce((s, i) => s + i.returnQuantity, 0) || 0;
                        const totalReceived = rdc.items?.reduce((s, i) => s + i.receivedQuantity, 0) || 0;
                        return (
                            <TableRow key={rdc.id}>
                                <TableCell className="font-medium">{rdc.returnDcNumber}</TableCell>
                                <TableCell>{rdc.deliveryChallan?.dcNumber || "—"}</TableCell>
                                <TableCell>{rdc.customer?.name || "—"}</TableCell>
                                <TableCell>
                                    <span className="text-sm">{totalReceived}/{totalReturn} received</span>
                                </TableCell>
                                <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                                <TableCell>{rdc.returnDate ? formatDate(rdc.returnDate) : "—"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => onView(rdc)}><Eye className="h-4 w-4" /></Button>
                                                </TooltipTrigger>
                                                <TooltipContent>View</TooltipContent>
                                            </Tooltip>
                                            {canEdit && onEdit && rdc.status !== "completed" && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onEdit(rdc)}><Edit className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Edit</TooltipContent>
                                                </Tooltip>
                                            )}
                                            {canDelete && onDelete && (rdc.status === "draft" || rdc.status === "cancelled") && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onDelete(rdc.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Delete</TooltipContent>
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
