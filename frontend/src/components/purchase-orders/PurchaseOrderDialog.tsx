import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type PurchaseOrder, type PurchaseOrderItem } from "@/types/purchase-order";
import { type Supplier } from "@/types/supplier";
import { useCurrencyStore } from "@/stores/currencyStore";

// Mock suppliers
const mockSuppliers: Supplier[] = [
  {
    id: "1",
    name: "ABC Suppliers Ltd.",
    contactName: "John Smith",
    phone: "123-456-7890",
    email: "info@abcsuppliers.com",
    address: "123 Supply St",
    paymentTerms: "Net 30",
    taxId: "TAX123",
    notes: "Preferred supplier",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "2",
    name: "XYZ Distribution",
    contactName: "Jane Doe",
    phone: "987-654-3210",
    email: "contact@xyzdist.com",
    address: "456 Distribution Ave",
    paymentTerms: "Net 45",
    taxId: "TAX456",
    notes: "",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Mock products
const mockProducts = [
  { id: "1", name: "Product A", skuCode: "SKU-001", costPrice: 100.00 },
  { id: "2", name: "Product B", skuCode: "SKU-002", costPrice: 40.00 },
  { id: "3", name: "Product C", skuCode: "SKU-003", costPrice: 175.00 },
];

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export const PurchaseOrderDialog = ({ open, onOpenChange, purchaseOrder }: PurchaseOrderDialogProps) => {
  const { toast } = useToast();
  const { currency } = useCurrencyStore();
  
  const [formData, setFormData] = useState<Partial<PurchaseOrder>>({
    orderNumber: "",
    supplierId: "",
    orderDate: new Date(),
    expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "draft",
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    notes: "",
    items: [],
  });
  
  const [items, setItems] = useState<Partial<PurchaseOrderItem>[]>([]);
  
  useEffect(() => {
    if (purchaseOrder) {
      setFormData({
        ...purchaseOrder,
      });
      setItems([...purchaseOrder.items]);
    } else {
      // Generate a new PO number based on current date
      const today = new Date();
      const poNumber = `PO-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
      
      setFormData({
        orderNumber: poNumber,
        supplierId: "",
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: "draft",
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        notes: "",
        items: [],
      });
      setItems([]);
    }
  }, [purchaseOrder, open]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };
  
  const handleDateChange = (name: string, date: Date | undefined) => {
    if (date) {
      setFormData({ ...formData, [name]: date });
    }
  };
  
  const addItem = () => {
    setItems([...items, {
      id: `temp-${Date.now()}`,
      purchaseOrderId: "",
      productId: "",
      productName: "",
      skuCode: "",
      quantity: 1,
      costPrice: 0,
      discount: 0,
      tax: 0,
      total: 0,
    }]);
  };
  
  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
    calculateTotals(newItems);
  };
  
  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    
    // If product is selected, update related fields
    if (field === "productId") {
      const product = mockProducts.find(p => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].skuCode = product.skuCode;
        newItems[index].costPrice = product.costPrice;
      }
    }
    
    // Recalculate item total
    if (["quantity", "costPrice", "discount", "tax"].includes(field)) {
      const item = newItems[index];
      const quantity = Number(item.quantity) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const discount = Number(item.discount) || 0;
      const tax = Number(item.tax) || 0;
      
      const subtotal = quantity * costPrice;
      const totalAfterDiscount = subtotal - discount;
      const total = totalAfterDiscount + tax;
      
      newItems[index].total = total;
    }
    
    setItems(newItems);
    calculateTotals(newItems);
  };
  
  const calculateTotals = (itemsList: Partial<PurchaseOrderItem>[]) => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    
    itemsList.forEach(item => {
      subtotal += (Number(item.quantity) || 0) * (Number(item.costPrice) || 0);
      taxAmount += Number(item.tax) || 0;
      discountAmount += Number(item.discount) || 0;
    });
    
    const totalAmount = subtotal - discountAmount + taxAmount;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount
    }));
  };
  
  const handleSubmit = () => {
    // Here you would typically send the data to your API
    console.log("Submitting purchase order:", { ...formData, items });
    
    toast({
      title: purchaseOrder ? "Purchase Order Updated" : "Purchase Order Created",
      description: `Purchase order ${formData.orderNumber} has been ${purchaseOrder ? "updated" : "created"} successfully.`,
    });
    
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder ? "Edit Purchase Order" : "Create Purchase Order"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <div>
            <Label htmlFor="orderNumber">Purchase Order #</Label>
            <Input
              id="orderNumber"
              name="orderNumber"
              value={formData.orderNumber}
              onChange={handleInputChange}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="supplierId">Supplier</Label>
            <Select
              value={formData.supplierId}
              onValueChange={(value) => handleSelectChange("supplierId", value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {mockSuppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="orderDate">Order Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full mt-1 justify-start text-left font-normal",
                    !formData.orderDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.orderDate ? format(formData.orderDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={formData.orderDate}
                  onSelect={(date) => handleDateChange("orderDate", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full mt-1 justify-start text-left font-normal",
                    !formData.expectedDeliveryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.expectedDeliveryDate ? format(formData.expectedDeliveryDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={formData.expectedDeliveryDate}
                  onSelect={(date) => handleDateChange("expectedDeliveryDate", date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "draft" | "pending" | "approved" | "received" | "cancelled") => 
                handleSelectChange("status", value)
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Order Items</h3>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addItem}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
          
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select
                          value={item.productId}
                          onValueChange={(value) => handleItemChange(index, "productId", value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {mockProducts.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{item.skuCode}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => 
                            handleItemChange(index, "quantity", parseInt(e.target.value, 10) || 0)
                          }
                          className="w-16"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.costPrice}
                          onChange={(e) => 
                            handleItemChange(index, "costPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.discount}
                          onChange={(e) => 
                            handleItemChange(index, "discount", parseFloat(e.target.value) || 0)
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.tax}
                          onChange={(e) => 
                            handleItemChange(index, "tax", parseFloat(e.target.value) || 0)
                          }
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.total || 0, currency)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      No items added. Click "Add Item" to add products to this order.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <div className="mt-6">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            value={formData.notes || ""}
            onChange={handleInputChange}
            className="mt-1"
            placeholder="Add any additional notes or instructions..."
          />
        </div>
        
        <div className="mt-6 flex justify-end space-x-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-right font-medium">Subtotal:</div>
            <div className="text-right">{formatCurrency(formData.subtotal || 0, currency)}</div>
            
            <div className="text-right font-medium">Discount:</div>
            <div className="text-right">{formatCurrency(formData.discountAmount || 0, currency)}</div>
            
            <div className="text-right font-medium">Tax:</div>
            <div className="text-right">{formatCurrency(formData.taxAmount || 0, currency)}</div>
            
            <div className="text-right font-medium">Total:</div>
            <div className="text-right font-bold">{formatCurrency(formData.totalAmount || 0, currency)}</div>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {purchaseOrder ? "Update" : "Create"} Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
