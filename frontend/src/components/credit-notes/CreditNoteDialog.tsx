import { useState, useEffect } from "react";
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
import { type CreditNote, type CreditNoteItem } from "@/types/credit-note";
import { PlusCircle, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";

interface CreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote?: CreditNote;
  onSave: (creditNote: Partial<CreditNote>) => void;
  customers: { id: string; name: string }[];
}

export function CreditNoteDialog({ 
  open, 
  onOpenChange, 
  creditNote, 
  onSave,
  customers 
}: CreditNoteDialogProps) {
  const { currency } = useCurrencyStore();
  const [formData, setFormData] = useState<Partial<CreditNote>>({
    creditNoteNumber: "",
    customerId: "",
    customerName: "",
    issueDate: new Date(),
    status: "draft",
    issuedBy: "",
    notes: "",
    items: [],
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
  });

  const [items, setItems] = useState<Partial<CreditNoteItem>[]>([
    { productId: "", productName: "", skuCode: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0, reason: "" }
  ]);

  useEffect(() => {
    if (creditNote) {
      setFormData({
        ...creditNote,
      });
      setItems(creditNote.items);
    } else {
      // Reset form for new credit note
      setFormData({
        creditNoteNumber: `CN-${Date.now().toString().substring(6)}`,
        customerId: "",
        customerName: "",
        issueDate: new Date(),
        status: "draft",
        issuedBy: "",
        notes: "",
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
      });
      setItems([{ productId: "", productName: "", skuCode: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0, reason: "" }]);
    }
  }, [creditNote, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (value: string, name: string) => {
    if (name === 'customerId') {
      const selectedCustomer = customers.find(c => c.id === value);
      setFormData({
        ...formData,
        [name]: value,
        customerName: selectedCustomer?.name || '',
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    // Recalculate total for this item
    if (field === 'unitPrice' || field === 'quantity' || field === 'discount' || field === 'tax') {
      const item = newItems[index];
      const subtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const discountAmount = subtotal * (item.discount || 0) / 100;
      const taxAmount = (subtotal - discountAmount) * (item.tax || 0) / 100;
      newItems[index].total = subtotal - discountAmount + taxAmount;
    }
    
    setItems(newItems);
    recalculateTotals(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { productId: "", productName: "", skuCode: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0, reason: "" }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
      recalculateTotals(newItems);
    }
  };

  const recalculateTotals = (newItems: Partial<CreditNoteItem>[]) => {
    const subtotal = newItems.reduce((sum, item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      return sum + itemSubtotal;
    }, 0);
    
    const discountAmount = newItems.reduce((sum, item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscount = itemSubtotal * (item.discount || 0) / 100;
      return sum + itemDiscount;
    }, 0);
    
    const taxAmount = newItems.reduce((sum, item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscountAmount = itemSubtotal * (item.discount || 0) / 100;
      const itemTaxAmount = (itemSubtotal - itemDiscountAmount) * (item.tax || 0) / 100;
      return sum + itemTaxAmount;
    }, 0);
    
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.creditNoteNumber) {
      toast({
        title: "Error",
        description: "Credit note number is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.customerId || !formData.customerName) {
      toast({
        title: "Error",
        description: "Customer is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.issuedBy) {
      toast({
        title: "Error",
        description: "Issued by field is required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate items
    const validItems = items.filter(
      item => item.productName && item.quantity && item.unitPrice && item.reason
    );
    
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "At least one valid item with reason is required",
        variant: "destructive",
      });
      return;
    }
    
    onSave({
      ...formData,
      items: validItems as CreditNoteItem[],
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{creditNote ? "Edit Credit Note" : "Create Credit Note"}</DialogTitle>
            <DialogDescription>
              {creditNote ? "Update the details of this credit note." : "Enter the details to create a new credit note."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="creditNoteNumber">Credit Note Number</Label>
              <Input
                id="creditNoteNumber"
                name="creditNoteNumber"
                value={formData.creditNoteNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                value={formData.issueDate instanceof Date 
                  ? formData.issueDate.toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
                }
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="customerId">Customer</Label>
              <Select 
                name="customerId"
                value={formData.customerId}
                onValueChange={(value) => handleSelectChange(value, 'customerId')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                name="status"
                value={formData.status}
                onValueChange={(value) => handleSelectChange(value, 'status')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="issuedBy">Issued By</Label>
              <Input
                id="issuedBy"
                name="issuedBy"
                value={formData.issuedBy}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes || ""}
                onChange={handleInputChange}
                rows={2}
              />
            </div>
          </div>
          
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="border rounded-md p-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-7 gap-2 mb-2 pb-2 border-b last:border-0">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs" htmlFor={`item-${index}-name`}>Product Name</Label>
                    <Input
                      id={`item-${index}-name`}
                      value={item.productName || ""}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`item-${index}-sku`}>SKU Code</Label>
                    <Input
                      id={`item-${index}-sku`}
                      value={item.skuCode || ""}
                      onChange={(e) => updateItem(index, 'skuCode', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`item-${index}-qty`}>Quantity</Label>
                    <Input
                      id={`item-${index}-qty`}
                      type="number"
                      min="1"
                      value={item.quantity || ""}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`item-${index}-price`}>Unit Price</Label>
                    <Input
                      id={`item-${index}-price`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice || ""}
                      onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`item-${index}-reason`}>Reason</Label>
                    <Input
                      id={`item-${index}-reason`}
                      value={item.reason || ""}
                      onChange={(e) => updateItem(index, 'reason', e.target.value)}
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-4 border-t pt-4 mt-4">
              <div className="text-right space-y-1">
                <div className="text-sm">Subtotal: {formatCurrency(formData.subtotal || 0, currency)}</div>
                <div className="text-sm">Discount: {formatCurrency(formData.discountAmount || 0, currency)}</div>
                <div className="text-sm">Tax: {formatCurrency(formData.taxAmount || 0, currency)}</div>
                <div className="text-lg font-bold">Total: {formatCurrency(formData.totalAmount || 0, currency)}</div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
