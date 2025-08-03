
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type WholesaleBill, type WholesaleBillingItem } from "@/types/wholesale-billing";
import { type CreditNote, type CreditNoteItem } from "@/types/credit-note";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  bill: WholesaleBill;
  onCreateCreditNote: (creditNote: Partial<CreditNote>) => void;
}

export function ReturnDialog({
  open,
  onOpenChange,
  bill,
  onCreateCreditNote,
}: ReturnDialogProps) {
  const { currency } = useCurrencyStore();
  const [returnItems, setReturnItems] = useState<{
    itemId: string;
    quantity: number;
    reason: string;
    customReason: string;
    returnType: "return" | "exchange";
  }[]>(
    bill.items.map(item => ({
      itemId: item.id,
      quantity: 0,
      reason: "",
      customReason: "",
      returnType: "return" as const,
    }))
  );
  
  const [creditNoteNumber, setCreditNoteNumber] = useState<string>(
    `CN-${Date.now().toString().substring(8)}`
  );
  
  const [notes, setNotes] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("return");

  const handleQuantityChange = (itemId: string, value: number) => {
    setReturnItems(prev => 
      prev.map(item => 
        item.itemId === itemId 
          ? { ...item, quantity: value } 
          : item
      )
    );
  };

  const handleReasonChange = (itemId: string, value: string) => {
    setReturnItems(prev => 
      prev.map(item => 
        item.itemId === itemId 
          ? { ...item, reason: value, customReason: value === "Other" ? item.customReason : "" } 
          : item
      )
    );
  };

  const handleCustomReasonChange = (itemId: string, value: string) => {
    setReturnItems(prev => 
      prev.map(item => 
        item.itemId === itemId 
          ? { ...item, customReason: value } 
          : item
      )
    );
  };

  const handleReturnTypeChange = (itemId: string, value: "return" | "exchange") => {
    setReturnItems(prev => 
      prev.map(item => 
        item.itemId === itemId 
          ? { ...item, returnType: value } 
          : item
      )
    );
  };

  const handleSubmit = () => {
    // Validate
    const itemsToProcess = returnItems.filter(item => item.quantity > 0);
    
    if (itemsToProcess.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item to return or exchange",
        variant: "destructive",
      });
      return;
    }
    
    for (const item of itemsToProcess) {
      if (!item.reason) {
        toast({
          title: "Error",
          description: "Please provide a reason for all returns/exchanges",
          variant: "destructive",
        });
        return;
      }
      
      // Check if a custom reason is needed
      if (item.reason === "Other" && !item.customReason) {
        toast({
          title: "Error",
          description: "Please provide a custom reason when 'Other' is selected",
          variant: "destructive",
        });
        return;
      }
      
      // Check if return quantity exceeds original quantity
      const originalItem = bill.items.find(billItem => billItem.id === item.itemId);
      if (originalItem && item.quantity > (originalItem.quantity || 0)) {
        toast({
          title: "Error",
          description: `Return quantity cannot exceed original quantity for ${originalItem.productName}`,
          variant: "destructive",
        });
        return;
      }
    }
    
    // Create credit note items
    const creditNoteItems: Partial<CreditNoteItem>[] = itemsToProcess.map(returnItem => {
      const originalItem = bill.items.find(item => item.id === returnItem.itemId);
      if (!originalItem) return null;
      
      const finalReason = returnItem.reason === "Other" && returnItem.customReason 
        ? returnItem.customReason 
        : returnItem.reason;
      
      return {
        billItemId: originalItem.id,
        productId: originalItem.productId,
        productName: originalItem.productName,
        skuCode: originalItem.skuCode,
        quantity: returnItem.quantity,
        unitPrice: originalItem.unitPrice,
        amount: originalItem.unitPrice * returnItem.quantity,
        reason: `${returnItem.returnType.toUpperCase()}: ${finalReason}`,
        discount: originalItem.discount,
        tax: originalItem.tax,
        total: (originalItem.unitPrice * returnItem.quantity) * 
               (1 - (originalItem.discount / 100)) * 
               (1 + (originalItem.tax / 100)),
      };
    }).filter(item => item !== null) as Partial<CreditNoteItem>[];
    
    // Calculate totals
    const subtotal = creditNoteItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmount = creditNoteItems.reduce((sum, item) => {
      const itemSubtotal = item.amount || 0;
      const itemDiscount = itemSubtotal * ((item.discount || 0) / 100);
      return sum + ((itemSubtotal - itemDiscount) * ((item.tax || 0) / 100));
    }, 0);
    const discountAmount = creditNoteItems.reduce((sum, item) => {
      return sum + ((item.amount || 0) * ((item.discount || 0) / 100));
    }, 0);
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    // Create credit note
    const creditNote: Partial<CreditNote> = {
      creditNoteNumber,
      billId: bill.id,
      customerId: bill.customerId,
      customerName: bill.customer.name,
      issueDate: new Date(),
      status: "issued",
      totalAmount,
      notes,
      subtotal,
      taxAmount,
      discountAmount,
      items: creditNoteItems as CreditNoteItem[],
    };
    
    onCreateCreditNote(creditNote);
    onOpenChange(false);
    
    toast({
      title: "Success",
      description: `Credit note ${creditNoteNumber} created successfully`,
    });
  };

  const getTotalReturnAmount = () => {
    return returnItems
      .filter(ri => ri.quantity > 0)
      .reduce((sum, ri) => {
        const originalItem = bill.items.find(item => item.id === ri.itemId);
        if (!originalItem) return sum;
        const itemSubtotal = originalItem.unitPrice * ri.quantity;
        const itemDiscount = itemSubtotal * (originalItem.discount / 100);
        const itemTax = (itemSubtotal - itemDiscount) * (originalItem.tax / 100);
        return sum + (itemSubtotal - itemDiscount + itemTax);
      }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Return/Exchange</DialogTitle>
          <DialogDescription>
            Select items from bill #{bill.billNumber} to return or exchange
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="return">Return/Exchange</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="return" className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditNoteNumber">Credit Note Number</Label>
                <Input
                  id="creditNoteNumber"
                  value={creditNoteNumber}
                  onChange={(e) => setCreditNoteNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="border rounded-md">
              <div className="grid grid-cols-12 gap-2 bg-gray-100 p-2 border-b font-medium">
                <div className="col-span-3">Product</div>
                <div className="col-span-1">Orig Qty</div>
                <div className="col-span-1">Return</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-3">Reason</div>
                <div className="col-span-2">Unit Price</div>
              </div>
              
              {bill.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 p-2 border-b">
                  <div className="col-span-3">{item.productName}</div>
                  <div className="col-span-1">{item.quantity}</div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={returnItems.find(ri => ri.itemId === item.id)?.quantity || 0}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <Select
                      value={returnItems.find(ri => ri.itemId === item.id)?.returnType || "return"}
                      onValueChange={(value) => handleReturnTypeChange(
                        item.id, 
                        value as "return" | "exchange"
                      )}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="return">Return</SelectItem>
                        <SelectItem value="exchange">Exchange</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <Select
                      value={returnItems.find(ri => ri.itemId === item.id)?.reason || ""}
                      onValueChange={(value) => handleReasonChange(item.id, value)}
                      disabled={!returnItems.find(ri => ri.itemId === item.id)?.quantity}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {returnReasons.map(reason => (
                          <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {returnItems.find(ri => ri.itemId === item.id)?.reason === "Other" && (
                      <Input
                        placeholder="Custom reason"
                        value={returnItems.find(ri => ri.itemId === item.id)?.customReason || ""}
                        onChange={(e) => handleCustomReasonChange(item.id, e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="col-span-2 flex items-center">
                    {formatCurrency(item.unitPrice, currency)}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="summary" className="space-y-6 py-4">
            <div className="border rounded-md p-4">
              <h3 className="font-medium text-lg mb-4">Return Summary</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 font-medium border-b pb-2">
                  <div>Product</div>
                  <div>Quantity</div>
                  <div>Amount</div>
                </div>
                
                {returnItems.filter(ri => ri.quantity > 0).map(ri => {
                  const originalItem = bill.items.find(item => item.id === ri.itemId);
                  if (!originalItem || ri.quantity <= 0) return null;
                  
                  const itemAmount = originalItem.unitPrice * ri.quantity;
                  return (
                    <div key={ri.itemId} className="grid grid-cols-3 gap-2 border-b pb-2">
                      <div>{originalItem.productName}</div>
                      <div>{ri.quantity} {ri.returnType === "exchange" ? "(Exchange)" : "(Return)"}</div>
                      <div>{formatCurrency(itemAmount, currency)}</div>
                    </div>
                  );
                })}
                
                <div className="flex justify-between font-medium pt-2">
                  <span>Total Return Amount:</span>
                  <span>{formatCurrency(getTotalReturnAmount(), currency)}</span>
                </div>
              </div>
            </div>
            
            <div className="border rounded-md p-4">
              <h3 className="font-medium text-lg mb-2">Credit Note Details</h3>
              <p>Credit Note Number: {creditNoteNumber}</p>
              <p>Issue Date: {new Date().toLocaleDateString()}</p>
              <p>Customer: {bill.customer.name}</p>
              <p>Original Bill #: {bill.billNumber}</p>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Process & Create Credit Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
