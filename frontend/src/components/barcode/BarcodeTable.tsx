import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Barcode {
  id: string;
  code: string;
  label: string;
  quantity: number;
}

interface BarcodeTableProps {
  onEdit?: (barcode: Barcode | null) => void;
}

export function BarcodeTable({ onEdit }: BarcodeTableProps) {
  // Move all hooks to the top
  const [loading, setLoading] = useState(true);
  const [barcodes, setBarcodes] = useState<Barcode[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { hasPermission } = useAuth();
  const canEditBarcodes = hasPermission('barcode_edit');
  const canDeleteBarcodes = hasPermission('barcode_delete');

  // Simulate loading and fetch data
  useEffect(() => {
    const fetchBarcodes = async () => {
      // Simulate API call
      setTimeout(() => {
        setBarcodes([
          { id: "1", code: "PRD-001", label: "Product One", quantity: 1 },
          { id: "2", code: "PRD-002", label: "Product Two", quantity: 1 },
          { id: "3", code: "PRD-003", label: "Product Three", quantity: 1 },
        ]);
        setLoading(false);
      }, 1000);
    };

    fetchBarcodes();
  }, []);

  // Now do the conditional render
  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const filteredBarcodes = barcodes.filter(barcode =>
    barcode.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    barcode.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search barcodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBarcodes.length > 0 ? (
              filteredBarcodes.map((barcode) => (
                <TableRow key={barcode.id}>
                  <TableCell className="font-mono">{barcode.code}</TableCell>
                  <TableCell>{barcode.label}</TableCell>
                  <TableCell>{barcode.quantity}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {canEditBarcodes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit?.(barcode)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button variant="ghost" size="sm" disabled>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              You do not have permission to edit barcodes
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {canDeleteBarcodes ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBarcodes(barcodes.filter(b => b.id !== barcode.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button variant="ghost" size="sm" disabled>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              You do not have permission to delete barcodes
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                  No barcodes found. Add a new barcode to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 