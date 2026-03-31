import { useState } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye, Trash2 } from "lucide-react";
import { type PickList } from "@/types/pick-list";
import { formatDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

interface PickListTableProps {
    pickLists: PickList[];
    loading: boolean;
    onView: (pl: PickList) => void;
    onEdit?: (pl: PickList) => void;
    onDelete?: (id: string) => void;
    canEdit: boolean;
    canDelete: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "Pending", variant: "outline" },
    in_progress: { label: "In Progress", variant: "secondary" },
    completed: { label: "Completed", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
};

export function PickListTable({ pickLists, loading, onView, onEdit, onDelete, canEdit, canDelete }: PickListTableProps) {
    const [sortCol, setSortCol] = useState("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const handleSort = (col: string) => {
        if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir("asc"); }
    };

    const sorted = [...pickLists].sort((a: any, b: any) => {
        const c = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""));
        return sortDir === "asc" ? c : -c;
    });

    const icon = (col: string) => sortCol !== col ? "↕" : sortDir === "asc" ? "↑" : "↓";

    if (loading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader><TableRow>
                        <TableHead>PL #</TableHead><TableHead>DC #</TableHead><TableHead>Assigned</TableHead>
                        <TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead>
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
                        <TableHead className="cursor-pointer" onClick={() => handleSort("pickListNumber")}>PL # {icon("pickListNumber")}</TableHead>
                        <TableHead>DC #</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>Status {icon("status")}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("pickDate")}>Date {icon("pickDate")}</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No pick lists found</TableCell></TableRow>
                    ) : sorted.map((pl) => {
                        const st = statusConfig[pl.status] || statusConfig.pending;
                        const totalQty = pl.items?.reduce((s, i) => s + i.quantity, 0) || 0;
                        const pickedQty = pl.items?.reduce((s, i) => s + i.pickedQuantity, 0) || 0;
                        const pct = totalQty > 0 ? Math.round((pickedQty / totalQty) * 100) : 0;
                        return (
                            <TableRow key={pl.id}>
                                <TableCell className="font-medium">{pl.pickListNumber}</TableCell>
                                <TableCell>{pl.deliveryChallan?.dcNumber || "—"}</TableCell>
                                <TableCell>{pl.assignedUser?.fullName || "Unassigned"}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                        <Progress value={pct} className="h-2 flex-1" />
                                        <span className="text-xs text-muted-foreground w-10">{pct}%</span>
                                    </div>
                                </TableCell>
                                <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                                <TableCell>{pl.pickDate ? formatDate(pl.pickDate) : "—"}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={() => onView(pl)}><Eye className="h-4 w-4" /></Button>
                                                </TooltipTrigger>
                                                <TooltipContent>View</TooltipContent>
                                            </Tooltip>
                                            {canEdit && onEdit && pl.status !== "completed" && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onEdit(pl)}><Edit className="h-4 w-4" /></Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Edit</TooltipContent>
                                                </Tooltip>
                                            )}
                                            {canDelete && onDelete && (pl.status === "pending" || pl.status === "cancelled") && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={() => onDelete(pl.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
