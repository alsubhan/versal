
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type SaleInvoice, type SaleInvoiceItem } from "@/types/sale-invoice";
import { type CreditNote, type CreditNoteItem } from "@/types/credit-note";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { toast } from "@/hooks/use-toast";

// Standard return/exchange reasons
const returnReasons = [
  "Defective product",
  "Wrong item received",
  "Damaged during shipping",
  "Not as described",
  "Changed mind",
  "Ordered wrong item",
  "Quality issue",
  "Incorrect size/fit",
  "Duplicate order",
  "Other"
];

interface ReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SaleInvoice;
  onCreateCreditNote: (creditNote: Partial<CreditNote>) => void;
}

export function SaleReturnDialog({
  open,
  onOpenChange,
  invoice,
  onCreateCreditNote,
}: ReturnDialogProps) {
  const { currency } = useCurrencyStore();
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState<string>("");

  useEffect(() => {
    console.log('SaleReturnDialog - Invoice received:', invoice);
    console.log('SaleReturnDialog - Invoice items:', invoice?.items);
    console.log('SaleReturnDialog - Invoice items length:', invoice?.items?.length);
    
    if (invoice && invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
      // Initialize return items with 0 quantities
      const initialReturnItems = invoice.items.map(item => ({
        ...item,
        returnQuantity: 0,
        returnReason: "",
        returnType: "return" as const,
      }));
      console.log('SaleReturnDialog - Initialized return items:', initialReturnItems);
      setReturnItems(initialReturnItems);
      
      // Always generate credit note number by default
      const today = new Date();
      const creditNoteNumber = `CN-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
      setCreditNoteNumber(creditNoteNumber);
    } else {
      console.log('SaleReturnDialog - No invoice or items found, setting empty array');
      setReturnItems([]);
    }
  }, [invoice]);

  const handleReturnQuantityChange = (index: number, value: number) => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnQuantity = Math.max(0, Math.min(value, newReturnItems[index].quantity || 0));
    setReturnItems(newReturnItems);
  };

  const handleReturnReasonChange = (index: number, reason: string) => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnReason = reason;
    setReturnItems(newReturnItems);
  };

  const handleReturnTypeChange = (index: number, returnType: "return" | "exchange") => {
    const newReturnItems = [...returnItems];
    newReturnItems[index].returnType = returnType;
    setReturnItems(newReturnItems);
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((total, item) => {
      const itemTotal = (item.returnQuantity || 0) * (item.unitPrice || 0);
      return total + itemTotal;
    }, 0);
  };

  const handleProcessReturn = async () => {
    try {
      setLoading(true);
      
      // Filter items that have return quantities
      const itemsToReturn = returnItems.filter(item => (item.returnQuantity || 0) > 0);
      
      if (itemsToReturn.length === 0) {
        toast({
          title: "Error",
          description: "Please specify quantities to return for at least one item.",
          variant: "destructive",
        });
        return;
      }

      // Validate return reasons
      for (const item of itemsToReturn) {
        if (!item.returnReason) {
          toast({
            title: "Error",
            description: `Please provide a return reason for ${item.productName}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Create credit note items
      const creditNoteItems: Partial<CreditNoteItem>[] = itemsToReturn.map(returnItem => {
        return {
          productId: returnItem.productId,
          productName: returnItem.productName,
          skuCode: returnItem.skuCode,
          hsnCode: returnItem.hsnCode,
          quantity: returnItem.returnQuantity,
          unitPrice: returnItem.unitPrice,
          discount: returnItem.discount,
          tax: returnItem.tax,
          total: returnItem.returnQuantity * returnItem.unitPrice,
          saleTaxType: returnItem.saleTaxType,
          unitAbbreviation: returnItem.unitAbbreviation,
        };
      });

      const creditNote: Partial<CreditNote> = {
        creditNoteNumber,
        salesOrderId: invoice.salesOrderId,
        invoiceId: invoice.id,  // NEW: Link to the specific invoice
        customerId: invoice.customerId,
        creditDate: new Date(),
        reason: "return",
        reasonDescription: returnReason,
        status: "draft",
        subtotal: calculateReturnTotal(),
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: calculateReturnTotal(),
        creditNoteType: "invoice_linked",  // NEW: Mark as invoice-linked
        notes: `Return/Exchange for Invoice #${invoice.invoiceNumber}`,
        items: creditNoteItems as CreditNoteItem[],
      };

      onCreateCreditNote(creditNote);
      onOpenChange(false);
      
      // Reset form
      setReturnItems([]);
      setReturnReason("");
      setCreditNoteNumber("");
      
      toast({
        title: "Credit Note Created",
        description: `Credit note ${creditNoteNumber} has been created successfully.`,
      });
    } catch (error) {
      console.error('Error processing return:', error);
      toast({
        title: "Error",
        description: "Failed to process return",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Sale Return - {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Invoice Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Invoice Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Invoice Number:</span> {invoice.invoiceNumber}
              </div>
              <div>
                <span className="font-medium">Invoice Date:</span> {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : 'N/A'}
              </div>
              <div>
                <span className="font-medium">Customer:</span> {invoice.customer?.name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Total Amount:</span> {formatCurrency(invoice.totalAmount || 0, currency)}
              </div>
            </div>
          </div>

          {/* Credit Note Number */}
          <div>
            <Label htmlFor="creditNoteNumber" className="text-sm font-medium text-gray-700">
              Credit Note Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="creditNoteNumber"
              value={creditNoteNumber}
              onChange={(e) => setCreditNoteNumber(e.target.value)}
              className="mt-1"
              placeholder="Credit note number will be auto-generated"
              required
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              Credit note number is automatically generated when the dialog opens.
            </p>
          </div>

          {/* Return Items */}
          <div>
            <h3 className="font-semibold mb-4">Select Items to Return</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Product</TableHead>
                    <TableHead>Original Qty</TableHead>
                    <TableHead>Return Qty</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit Price</TableHead>
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
                      <TableCell>{item.quantity || 0}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity || 0}
                          value={item.returnQuantity || 0}
                          onChange={(e) => handleReturnQuantityChange(index, parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.returnType || "return"}
                          onValueChange={(value) => handleReturnTypeChange(index, value as "return" | "exchange")}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="return">Return</SelectItem>
                            <SelectItem value="exchange">Exchange</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{formatCurrency(item.unitPrice || 0, currency)}</TableCell>
                      <TableCell>
                        {formatCurrency((item.returnQuantity || 0) * (item.unitPrice || 0), currency)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.returnReason || ""}
                          onValueChange={(value) => handleReturnReasonChange(index, value)}
                          disabled={!item.returnQuantity}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {returnReasons.map(reason => (
                              <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
            {loading ? "Processing..." : "Process Return & Create Credit Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
