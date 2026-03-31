import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2 } from "lucide-react";
import { type PutAway } from "@/types/put-away";
import { formatDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface PutAwayTableProps {
    putAways: PutAway[];
    loading: boolean;
    onView: (putAway: PutAway) => void;
    onEdit?: (putAway: PutAway) => void;
    onDelete?: (putAway: PutAway) => void;
    canEdit: boolean;
    canDelete: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pending", variant: "outline" },
    in_progress: { label: "In Progress", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function PutAwayTable({ putAways, loading, onView, onEdit, onDelete, canEdit, canDelete }: PutAwayTableProps) {
    const [sortField, setSortField] = useState<string>("createdAt");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const sortedPutAways = [...putAways].sort((a, b) => {
        const aVal = (a as any)[sortField] ?? "";
        const bVal = (b as any)[sortField] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDirection === "asc" ? cmp : -cmp;
    });

    const getSortIcon = (field: string) => {
        if (sortField !== field) return "↕";
        return sortDirection === "asc" ? "↑" : "↓";
    };

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("putAwayNumber")}>
                            PA Number {getSortIcon("putAwayNumber")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("qualityCheckId")}>
                            QC Reference {getSortIcon("qualityCheckId")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("grnId")}>
                            GRN Reference {getSortIcon("grnId")}
                        </TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                            Status {getSortIcon("status")}
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("putAwayDate")}>
                            Date {getSortIcon("putAwayDate")}
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedPutAways.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No put away records found
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedPutAways.map((pa) => {
                            const status = statusConfig[pa.status] || statusConfig.pending;
                            const totalItems = pa.items?.length || 0;
                            const totalQty = pa.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
                            const placedQty = pa.items?.reduce((sum, i) => sum + (i.placedQuantity || 0), 0) || 0;

                            return (
                                <TableRow key={pa.id}>
                                    <TableCell className="font-medium">{pa.putAwayNumber}</TableCell>
                                    <TableCell>{pa.qualityCheck?.qcNumber || "—"}</TableCell>
                                    <TableCell>{pa.grn?.grnNumber || "—"}</TableCell>
                                    <TableCell>{pa.assignedUser?.fullName || pa.assignedUser?.username || "—"}</TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {totalItems} items ({placedQty}/{totalQty} placed)
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={status.variant}>{status.label}</Badge>
                                    </TableCell>
                                    <TableCell>{pa.putAwayDate ? formatDate(pa.putAwayDate) : "—"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onView(pa)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>View Details</TooltipContent>
                                                </Tooltip>

                                                {canEdit && onEdit && pa.status !== "completed" && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={() => onEdit(pa)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit</TooltipContent>
                                                    </Tooltip>
                                                )}

                                                {canDelete && onDelete && pa.status !== "completed" && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={() => onDelete(pa)} className="text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </TooltipProvider>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
