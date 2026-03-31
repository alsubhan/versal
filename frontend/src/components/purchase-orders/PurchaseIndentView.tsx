
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { type PurchaseIndent } from "@/types/purchase-indent";
import { useCurrencyStore } from "@/stores/currencyStore";

interface PurchaseIndentViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indent: PurchaseIndent | null;
}

export const PurchaseIndentView = ({ open, onOpenChange, indent }: PurchaseIndentViewProps) => {
  const { currency } = useCurrencyStore();
  
  if (!indent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View Purchase Indent - {indent.indentNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Indent #</Label>
            <p className="font-mono font-medium">{indent.indentNumber}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Requester</Label>
            <p className="font-medium">{indent.requester?.fullName || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Department</Label>
            <p className="font-medium">{indent.department || 'General'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Required Date</Label>
            <p className="font-medium">{indent.requiredDate ? format(new Date(indent.requiredDate), "PPP") : "N/A"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Status</Label>
            <div>
                <span className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    indent.status === "approved" ? "bg-green-100 text-green-800" :
                    indent.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                    indent.status === "rejected" ? "bg-red-100 text-red-800" :
                    indent.status === "converted" ? "bg-blue-100 text-blue-800" :
                    "bg-gray-100 text-gray-800"
                }`}>
                    {indent.status}
                </span>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase">Created At</Label>
            <p className="text-sm">{indent.createdAt ? format(new Date(indent.createdAt), "PPp") : "N/A"}</p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-md font-semibold mb-3 border-b pb-1">Items Requested</h3>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Est. Unit Price</TableHead>
                <TableHead className="text-right">Total Est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indent.items && indent.items.length > 0 ? (
                indent.items.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.productName || 'Unknown'}</TableCell>
                    <TableCell className="font-mono text-xs">{item.skuCode || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{item.hsnCode || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.estimatedUnitPrice, currency)}</TableCell>

                    <TableCell className="text-right font-medium">
                        {formatCurrency(item.quantity * item.estimatedUnitPrice, currency)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No items requested</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex justify-between items-start gap-8">
            <div className="flex-1">
                <Label className="text-xs text-muted-foreground uppercase">Notes</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/30 p-3 rounded-md min-h-[60px]">
                    {indent.notes || "No notes provided."}
                </p>
            </div>
            <div className="bg-primary/5 p-4 rounded-lg min-w-[200px]">
                <Label className="text-xs text-muted-foreground uppercase italic">Total Estimated Value</Label>
                <p className="text-2xl font-bold text-primary mt-1">
                    {formatCurrency(indent.totalEstimatedValue || 0, currency)}
                </p>
            </div>
        </div>

        <div className="flex justify-end mt-8 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
