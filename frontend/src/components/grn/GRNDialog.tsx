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
import { type GoodsReceiveNote, type GoodsReceiveNoteItem } from "@/types/grn";
import { PlusCircle, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";

interface GRNDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grn?: GoodsReceiveNote;
  onSave: (grn: Partial<GoodsReceiveNote>) => void;
}

export function GRNDialog({ open, onOpenChange, grn, onSave }: GRNDialogProps) {
  const { currency } = useCurrencyStore();
  const [formData, setFormData] = useState<Partial<GoodsReceiveNote>>({
    grnNumber: "",
    purchaseOrderId: "",
    receivedDate: new Date(),
    status: "pending",
    receivedBy: "",
    notes: "",
    items: [],
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
  });

  const [items, setItems] = useState<Partial<GoodsReceiveNoteItem>[]>([
    { productId: "", productName: "", skuCode: "", quantityOrdered: 0, quantityReceived: 0, unitCost: 0, total: 0 }
  ]);

  useEffect(() => {
    if (grn) {
      setFormData({
        ...grn,
      });
      setItems(grn.items);
    } else {
      // Reset form for new GRN
      setFormData({
        grnNumber: `GRN-${Date.now().toString().substring(6)}`,
        purchaseOrderId: "",
        receivedDate: new Date(),
        status: "pending",
        receivedBy: "",
        notes: "",
        items: [],
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0,
      });
      setItems([{ productId: "", productName: "", skuCode: "", quantityOrdered: 0, quantityReceived: 0, unitCost: 0, total: 0 }]);
    }
  }, [grn, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    // Recalculate total for this item
    if (field === 'unitCost' || field === 'quantityReceived') {
      const item = newItems[index];
      newItems[index].total = (item.unitCost || 0) * (item.quantityReceived || 0);
    }
    
    setItems(newItems);
    recalculateTotals(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      { productId: "", productName: "", skuCode: "", quantityOrdered: 0, quantityReceived: 0, unitCost: 0, total: 0 }
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

  const recalculateTotals = (newItems: Partial<GoodsReceiveNoteItem>[]) => {
    const subtotal = newItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const taxAmount = subtotal * 0.1; // Assuming 10% tax rate
    const totalAmount = subtotal + taxAmount;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      taxAmount,
      totalAmount,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.grnNumber) {
      toast({
        title: "Error",
        description: "GRN number is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.receivedBy) {
      toast({
        title: "Error",
        description: "Received by field is required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate items
    const validItems = items.filter(
      item => item.productName && item.quantityReceived && item.unitCost
    );
    
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "At least one valid item is required",
        variant: "destructive",
      });
      return;
    }
    
    onSave({
      ...formData,
      items: validItems as GoodsReceiveNoteItem[],
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{grn ? "Edit Goods Receive Note" : "Create Goods Receive Note"}</DialogTitle>
            <DialogDescription>
              {grn ? "Update the details of this goods receive note." : "Enter the details to create a new goods receive note."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="grnNumber">GRN Number</Label>
              <Input
                id="grnNumber"
                name="grnNumber"
                value={formData.grnNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="receivedDate">Received Date</Label>
              <Input
                id="receivedDate"
                name="receivedDate"
                type="date"
                value={formData.receivedDate instanceof Date 
                  ? formData.receivedDate.toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
                }
                onChange={handleInputChange}
                required
              />
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="receivedBy">Received By</Label>
              <Input
                id="receivedBy"
                name="receivedBy"
                value={formData.receivedBy}
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
                <div key={index} className="grid grid-cols-6 gap-2 mb-2 pb-2 border-b last:border-0">
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
                    <Label className="text-xs" htmlFor={`item-${index}-qty`}>Qty Received</Label>
                    <Input
                      id={`item-${index}-qty`}
                      type="number"
                      min="0"
                      value={item.quantityReceived || ""}
                      onChange={(e) => updateItem(index, 'quantityReceived', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`item-${index}-cost`}>Unit Cost</Label>
                    <Input
                      id={`item-${index}-cost`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitCost || ""}
                      onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
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
                <div className="text-sm">Tax (10%): {formatCurrency(formData.taxAmount || 0, currency)}</div>
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
