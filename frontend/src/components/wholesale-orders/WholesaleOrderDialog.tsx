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
import { type WholesaleOrder, type WholesaleOrderItem } from "@/types/wholesale-order";
import { PlusCircle, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { type Customer } from "@/types/customer";

interface WholesaleOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: WholesaleOrder;
  onSave: (order: Partial<WholesaleOrder>) => void;
  customers: Customer[];
  products: { id: string; name: string; skuCode: string; price: number; taxRate: number }[];
}

export function WholesaleOrderDialog({ 
  open, 
  onOpenChange, 
  order, 
  onSave,
  customers,
  products 
}: WholesaleOrderDialogProps) {
  const { currency } = useCurrencyStore();
  const [formData, setFormData] = useState<Partial<WholesaleOrder>>({
    orderNumber: "",
    customerId: "",
    orderDate: new Date(),
    deliveryDate: undefined,
    status: "draft",
    notes: "",
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 0,
  });

  const [items, setItems] = useState<Partial<WholesaleOrderItem>[]>([
    { productId: "", productName: "", skuCode: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
  ]);

  useEffect(() => {
    if (order) {
      setFormData({
        ...order,
      });
      setItems(order.items);
    } else {
      // Reset form for new order
      setFormData({
        orderNumber: `WS-${Date.now().toString().substring(6)}`,
        customerId: "",
        orderDate: new Date(),
        deliveryDate: undefined,
        status: "draft",
        notes: "",
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        shippingAmount: 0,
        totalAmount: 0,
      });
      setItems([{ productId: "", productName: "", skuCode: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }]);
    }
  }, [order, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === "shippingAmount") {
      const shippingAmount = parseFloat(value) || 0;
      setFormData(prev => {
        const newData = {
          ...prev,
          shippingAmount
        };
        recalculateTotals(items, shippingAmount);
        return newData;
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSelectChange = (value: string, name: string) => {
    if (name === 'customerId') {
      const selectedCustomer = customers.find(c => c.id === value);
      setFormData({
        ...formData,
        [name]: value,
        customer: selectedCustomer
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        skuCode: product.skuCode,
        unitPrice: product.price,
        tax: product.taxRate,
      };
      
      // Recalculate totals
      const quantity = newItems[index].quantity || 1;
      const unitPrice = product.price;
      const discount = newItems[index].discount || 0;
      const tax = product.taxRate;
      
      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discount / 100);
      const taxableAmount = subtotal - discountAmount;
      const taxAmount = taxableAmount * (tax / 100);
      
      newItems[index].total = taxableAmount + taxAmount;
      
      setItems(newItems);
      recalculateTotals(newItems, formData.shippingAmount || 0);
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
    recalculateTotals(newItems, formData.shippingAmount || 0);
  };

  const addItem = () => {
    setItems([
      ...items,
      { productId: "", productName: "", skuCode: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, total: 0 }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
      recalculateTotals(newItems, formData.shippingAmount || 0);
    }
  };

  const recalculateTotals = (newItems: Partial<WholesaleOrderItem>[], shippingAmount: number = 0) => {
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
    
    const totalAmount = subtotal - discountAmount + taxAmount + shippingAmount;
    
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
    
    if (!formData.orderNumber) {
      toast({
        title: "Error",
        description: "Order number is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.customerId) {
      toast({
        title: "Error",
        description: "Customer is required",
        variant: "destructive",
      });
      return;
    }
    
    // Validate items
    const validItems = items.filter(
      item => item.productId && item.quantity && item.unitPrice
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
      items: validItems as WholesaleOrderItem[],
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{order ? "Edit Wholesale Order" : "Create Wholesale Order"}</DialogTitle>
            <DialogDescription>
              {order ? "Update the details of this wholesale order." : "Enter the details to create a new wholesale order."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                id="orderNumber"
                name="orderNumber"
                value={formData.orderNumber}
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
              <Label htmlFor="orderDate">Order Date</Label>
              <Input
                id="orderDate"
                name="orderDate"
                type="date"
                value={formData.orderDate instanceof Date 
                  ? formData.orderDate.toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0]
                }
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
              <Input
                id="deliveryDate"
                name="deliveryDate"
                type="date"
                value={formData.deliveryDate instanceof Date 
                  ? formData.deliveryDate.toISOString().split('T')[0]
                  : ''
                }
                onChange={handleInputChange}
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="shippingAmount">Shipping Amount</Label>
              <Input
                id="shippingAmount"
                name="shippingAmount"
                type="number"
                step="0.01"
                value={formData.shippingAmount || ""}
                onChange={handleInputChange}
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
              <h3 className="text-lg font-medium">Order Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            
            <div className="border rounded-md p-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-7 gap-2 mb-2 pb-2 border-b last:border-0">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs" htmlFor={`item-${index}-product`}>Product</Label>
                    <Select
                      value={item.productId}
                      onValueChange={(value) => handleProductSelect(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.skuCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Label className="text-xs" htmlFor={`item-${index}-discount`}>Discount %</Label>
                    <Input
                      id={`item-${index}-discount`}
                      type="number"
                      min="0"
                      max="100"
                      value={item.discount || ""}
                      onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`item-${index}-tax`}>Tax %</Label>
                    <Input
                      id={`item-${index}-tax`}
                      type="number"
                      min="0"
                      value={item.tax || ""}
                      onChange={(e) => updateItem(index, 'tax', parseFloat(e.target.value) || 0)}
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
                <div className="text-sm">Shipping: {formatCurrency(formData.shippingAmount || 0, currency)}</div>
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
