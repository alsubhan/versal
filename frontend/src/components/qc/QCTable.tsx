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
import { Edit, Eye, Trash2, PackageOpen } from "lucide-react";
import { type QualityCheck } from "@/types/quality-check";
import { formatDate } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';

interface QCTableProps {
    qualityChecks: QualityCheck[];
    loading: boolean;
    onView: (qc: QualityCheck) => void;
    onEdit?: (qc: QualityCheck) => void;
    onDelete?: (id: string) => void;
    onSendToPutAway?: (qc: QualityCheck) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function QCTable({ qualityChecks, loading, onView, onEdit, onDelete, onSendToPutAway, canEdit, canDelete }: QCTableProps) {
    const safeQCs = Array.isArray(qualityChecks) ? qualityChecks : [];

    const [sortColumn, setSortColumn] = useState<string>("qcDate");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    if (loading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>QC #</TableHead>
                            <TableHead>GRN #</TableHead>
                            <TableHead>Inspector</TableHead>
                            <TableHead>QC Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(5)].map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    const sortedQCs = [...safeQCs].sort((a: any, b: any) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "passed": return "bg-green-100 text-green-800";
            case "partial": return "bg-blue-100 text-blue-800";
            case "failed": return "bg-red-100 text-red-800";
            case "in_progress": return "bg-orange-100 text-orange-800";
            default: return "bg-yellow-100 text-yellow-800";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "in_progress": return "In Progress";
            default: return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("qcNumber")}>
                            QC #
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("grnId")}>
                            GRN #
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("inspectorName")}>
                            Inspector
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("qcDate")}>
                            QC Date
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                            Status
                        </TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedQCs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center">
                                No quality checks found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedQCs.map((qc) => (
                            <TableRow key={qc.id}>
                                <TableCell className="font-medium">{qc.qcNumber || 'N/A'}</TableCell>
                                <TableCell>{qc.grn?.grnNumber || 'N/A'}</TableCell>
                                <TableCell>{qc.inspectorName || 'N/A'}</TableCell>
                                <TableCell>{qc.qcDate ? formatDate(qc.qcDate) : 'N/A'}</TableCell>
                                <TableCell>
                                    <span className={`capitalize px-2 py-1 rounded-full text-xs ${getStatusColor(qc.status)}`}>
                                        {getStatusLabel(qc.status)}
                                    </span>
                                </TableCell>
                                <TableCell>{qc.items?.length || 0}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onView(qc)}
                                            title="View QC"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        {canEdit ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onEdit && onEdit(qc)}
                                                disabled={qc.status === 'passed' || qc.status === 'failed'}
                                                title={qc.status === 'passed' || qc.status === 'failed'
                                                    ? `Cannot edit ${qc.status} QC`
                                                    : "Edit QC"}
                                                className={qc.status === 'passed' || qc.status === 'failed'
                                                    ? 'opacity-50 cursor-not-allowed' : ''}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span>
                                                            <Button variant="ghost" size="icon" disabled title="Edit QC">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        You do not have permission to edit quality checks
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {canDelete ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onDelete && onDelete(qc.id)}
                                                disabled={qc.status !== 'pending' && qc.status !== 'in_progress'}
                                                title={qc.status !== 'pending' && qc.status !== 'in_progress'
                                                    ? `Cannot delete ${qc.status} QC`
                                                    : "Delete QC"}
                                                className={qc.status !== 'pending' && qc.status !== 'in_progress'
                                                    ? 'opacity-50 cursor-not-allowed' : ''}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span>
                                                            <Button variant="ghost" size="icon" disabled title="Delete QC">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        You do not have permission to delete quality checks
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        {onSendToPutAway && (qc.status === 'passed' || qc.status === 'partial') && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onSendToPutAway(qc)}
                                                            title="Send to Put Away"
                                                            className="text-blue-600"
                                                        >
                                                            <PackageOpen className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Send to Put Away</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
