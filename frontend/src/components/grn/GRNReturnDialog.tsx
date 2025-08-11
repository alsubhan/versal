import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { type GoodsReceiveNote, type GoodsReceiveNoteItem } from "@/types/grn";
import { useCurrencyStore } from "@/stores/currencyStore";

interface GRNReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grn: GoodsReceiveNote | undefined;
  onProcessReturn: (returnData: any) => void;
}

export const GRNReturnDialog = ({ open, onOpenChange, grn, onProcessReturn }: GRNReturnDialogProps) => {
  const { currency } = useCurrencyStore();
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (grn && grn.items) {
      // Initialize return items with 0 quantities
      const initialReturnItems = grn.items.map(item => ({
        ...item,
        returnQuantity: 0,
        returnReason: ""
      }));
      setReturnItems(initialReturnItems);
    }
  }, [grn]);

  const handleReturnQuantityChange = (index: number, value: number) => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnQuantity = Math.max(0, Math.min(value, newReturnItems[index].receivedQuantity || 0));
    setReturnItems(newReturnItems);
  };

  const handleReturnReasonChange = (index: number, reason: string) => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnReason = reason;
    setReturnItems(newReturnItems);
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((total, item) => {
      const itemTotal = (item.returnQuantity || 0) * (item.unitCost || 0);
      return total + itemTotal;
    }, 0);
  };

  const handleProcessReturn = async () => {
    try {
      setLoading(true);
      
      // Filter items that have return quantities
      const itemsToReturn = returnItems.filter(item => (item.returnQuantity || 0) > 0);
      
      if (itemsToReturn.length === 0) {
        alert("Please specify quantities to return for at least one item.");
        return;
      }

      const returnData = {
        grnId: grn?.id,
        grnNumber: grn?.grnNumber,
        returnItems: itemsToReturn,
        returnReason: returnReason,
        returnTotal: calculateReturnTotal(),
        returnDate: new Date()
      };

      onProcessReturn(returnData);
      onOpenChange(false);
      
      // Reset form
      setReturnItems([]);
      setReturnReason("");
    } catch (error) {
      console.error('Error processing return:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!grn) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process GRN Return - {grn.grnNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* GRN Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">GRN Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">GRN Number:</span> {grn.grnNumber}
              </div>
              <div>
                <span className="font-medium">Received Date:</span> {grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString() : 'N/A'}
              </div>
              <div>
                <span className="font-medium">Status:</span> {grn.status}
              </div>
              <div>
                <span className="font-medium">Total Amount:</span> {formatCurrency(grn.totalAmount || 0, currency)}
              </div>
            </div>
          </div>

          {/* Return Items */}
          <div>
            <h3 className="font-semibold mb-4">Select Items to Return</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Product</TableHead>
                    <TableHead>Received Qty</TableHead>
                    <TableHead>Return Qty</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Return Total</TableHead>
                    <TableHead>Return Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnItems.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-gray-500">{item.skuCode}</div>
                        </div>
                      </TableCell>
                      <TableCell>{item.receivedQuantity || 0}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={item.receivedQuantity || 0}
                          value={item.returnQuantity || 0}
                          onChange={(e) => handleReturnQuantityChange(index, parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(item.unitCost || 0, currency)}</TableCell>
                      <TableCell>
                        {formatCurrency((item.returnQuantity || 0) * (item.unitCost || 0), currency)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.returnReason || ""}
                          onChange={(e) => handleReturnReasonChange(index, e.target.value)}
                          placeholder="Reason for return"
                          className="w-32"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* General Return Reason */}
          <div>
            <Label htmlFor="returnReason" className="text-sm font-medium text-gray-700">
              General Return Reason
            </Label>
            <Textarea
              id="returnReason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Enter general reason for return..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Return Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Return Summary</h3>
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">Total Return Amount:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(calculateReturnTotal(), currency)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleProcessReturn} disabled={loading}>
            {loading ? "Processing..." : "Process Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 