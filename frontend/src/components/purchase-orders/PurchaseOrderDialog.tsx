import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash, Search } from "lucide-react";
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
import { cn, formatCurrency, applyRounding } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type PurchaseOrder, type PurchaseOrderItem } from "@/types/purchase-order";
import { type Supplier } from "@/types/supplier";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getSuppliers, getProducts, getPurchaseOrder, getTaxes } from "@/lib/api";
import { ProductSearchDialog } from "@/components/shared/ProductSearchDialog";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
  onSave: (purchaseOrder: Partial<PurchaseOrder>) => void;
}

export const PurchaseOrderDialog = ({ open, onOpenChange, purchaseOrder, onSave }: PurchaseOrderDialogProps) => {
  const { toast } = useToast();
  const { currency } = useCurrencyStore();
  const { settings: systemSettings } = useSystemSettings();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  
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
  
  // Load suppliers, products, and taxes when dialog opens
  useEffect(() => {
    if (open) {
      loadSuppliers();
      loadProducts();
      loadTaxes();
    }
  }, [open]);

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      });
    }
  };

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  };

  const loadTaxes = async () => {
    try {
      const data = await getTaxes();
      setTaxes(data);
    } catch (error) {
      console.error('Error loading taxes:', error);
      toast({
        title: "Error",
        description: "Failed to load taxes",
        variant: "destructive",
      });
    }
  };

  // Get default tax rate
  const getDefaultTaxRate = () => {
    const defaultTax = taxes.find(tax => tax.is_default && tax.is_active);
    return defaultTax ? defaultTax.rate : 0.1; // Default to 10% if no default tax found
  };

  // Calculate tax based on product's tax type and rate
  const calculateTax = (product: any, quantity: number, costPrice: number, discount: number = 0) => {
    // Get the product's specific tax rate - NO FALLBACK
    const productTaxRate = product?.purchase_tax?.rate;
    const subtotal = quantity * costPrice;
    const amountAfterDiscount = subtotal - discount;
    
    // Check if product has tax type
    const taxType = product?.purchase_tax_type;
    
    // Validate that product has required tax information
    // Note: productTaxRate can be 0 (valid), so we check for undefined/null
    if (productTaxRate === undefined || productTaxRate === null || !taxType) {
      throw new Error(`Product ${product?.name} (${product?.sku_code}) is missing required tax information. Tax rate: ${productTaxRate}, Tax type: ${taxType}`);
    }
    
    if (taxType === 'inclusive') {
      // For inclusive tax, the cost price already includes tax
      // So we need to extract the tax amount
      const taxAmount = amountAfterDiscount - (amountAfterDiscount / (1 + productTaxRate));
      return Math.round(taxAmount * 100) / 100; // Round to 2 decimal places
    } else {
      // For exclusive tax, add tax on top
      const taxAmount = amountAfterDiscount * productTaxRate;
      return Math.round(taxAmount * 100) / 100; // Round to 2 decimal places
    }
  };

  // Calculate total based on tax type
  const calculateTotal = (taxType: 'inclusive' | 'exclusive', quantity: number, costPrice: number, discount: number, tax: number) => {
    const subtotal = quantity * costPrice;
    const amountAfterDiscount = subtotal - discount;
    
    if (taxType === 'inclusive') {
      // For inclusive tax, total is the cost price minus discount (tax is already included)
      return amountAfterDiscount;
    } else {
      // For exclusive tax, add tax on top
      return amountAfterDiscount + tax;
    }
  };
  
  useEffect(() => {
    if (open) {
      if (purchaseOrder) {
        // If we have a purchase order with ID, fetch complete data including items
        if (purchaseOrder.id && !purchaseOrder.items) {
          const fetchCompleteData = async () => {
            try {
              setDataLoading(true);
              const completeData = await getPurchaseOrder(purchaseOrder.id);
              if (completeData && !completeData.error) {
                // Process items to ensure they have unit information
                const processedItems = (completeData.items || []).map(item => {
                  // Find the product to get unit information
                  const product = products.find(p => p.id === item.productId);
                  return {
                    ...item,
                    unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                  };
                });
                
                setFormData({
                  ...completeData,
                });
                setItems(processedItems);
              } else {
                // Fallback to existing data
                const processedItems = (purchaseOrder.items || []).map(item => {
                  const product = products.find(p => p.id === item.productId);
                  return {
                    ...item,
                    unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                  };
                });
                
                setFormData({
                  ...purchaseOrder,
                });
                setItems(processedItems);
              }
            } catch (error) {
              console.error('Error fetching complete purchase order data:', error);
              // Fallback to existing data
              const processedItems = (purchaseOrder.items || []).map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                  ...item,
                  unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                };
              });
              
              setFormData({
                ...purchaseOrder,
              });
              setItems(processedItems);
            } finally {
              setDataLoading(false);
            }
          };
          fetchCompleteData();
        } else {
          // Use existing data
          const processedItems = (purchaseOrder.items || []).map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
              ...item,
              unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
            };
          });
          
          setFormData({
            ...purchaseOrder,
          });
          setItems(processedItems);
        }
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
    setShowProductSearch(true);
  };

  const handleProductSelect = (product: any) => {
    // Validate that product has required information
    // Note: product.purchase_tax.rate can be 0 (valid), so we check for undefined/null
    if (product?.purchase_tax?.rate === undefined || product?.purchase_tax?.rate === null) {
      toast({
        title: "Invalid Product",
        description: `Product ${product?.name} (${product?.sku_code}) is missing tax rate information. Please update the product.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!product?.purchase_tax_type) {
      toast({
        title: "Invalid Product",
        description: `Product ${product?.name} (${product?.sku_code}) is missing tax type information. Please update the product.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!product?.cost_price) {
      toast({
        title: "Invalid Product",
        description: `Product ${product?.name} (${product?.sku_code}) is missing cost price. Please update the product.`,
        variant: "destructive",
      });
      return;
    }
    
    // Check if we're editing an existing item
    const editingIndex = sessionStorage.getItem('editingItemIndex');
    
    if (editingIndex !== null) {
      // Update existing item
      const index = parseInt(editingIndex);
      const newItems = [...items];
      const quantity = newItems[index].quantity || 1;
      const discount = newItems[index].discount || 0;
      const calculatedTax = calculateTax(product, quantity, product.cost_price, discount);
      
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        costPrice: product.cost_price,
        purchaseTaxType: product.purchase_tax_type,
        tax: calculatedTax,
        total: calculateTotal(product.purchase_tax_type, quantity, product.cost_price, discount, calculatedTax),
        unitAbbreviation: product.units?.abbreviation || '',
      };
      
      setItems(newItems);
      calculateTotals(newItems);
      sessionStorage.removeItem('editingItemIndex');
    } else {
      // Add new item
      const quantity = 1;
      const discount = 0;
      const calculatedTax = calculateTax(product, quantity, product.cost_price, discount);
      
      const newItem = {
        id: `temp-${Date.now()}`,
        purchaseOrderId: "",
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        quantity: quantity,
        costPrice: product.cost_price,
        discount: discount,
        tax: calculatedTax,
        total: calculateTotal(product.purchase_tax_type, quantity, product.cost_price, discount, calculatedTax),
        purchaseTaxType: product.purchase_tax_type,
        unitAbbreviation: product.units?.abbreviation || '',
      };
      
      setItems([...items, newItem]);
      calculateTotals([...items, newItem]);
    }
    
    // Add to recent products
    setRecentProducts(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      return [product, ...filtered].slice(0, 10);
    });
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
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].productName = product.name;
        newItems[index].skuCode = product.sku_code;
        newItems[index].hsnCode = product.hsn_code;
        newItems[index].costPrice = product.cost_price;
        newItems[index].unitAbbreviation = product.units?.abbreviation || '';
      }
    }
    
    // Recalculate item total and tax
    if (["quantity", "costPrice", "discount"].includes(field)) {
      const item = newItems[index];
      const quantity = Number(item.quantity) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const discount = Number(item.discount) || 0;
      
      // Find the product to get its tax rate
      const product = products.find(p => p.id === item.productId);
      if (product) {
        try {
          const calculatedTax = calculateTax(product, quantity, costPrice, discount);
          newItems[index].tax = calculatedTax;
        } catch (error) {
          console.error('Tax calculation failed:', error);
          toast({
            title: "Tax Calculation Error",
            description: error.message,
            variant: "destructive",
          });
          return; // Don't update the item if tax calculation fails
        }
      }
      
      const tax = Number(newItems[index].tax) || 0;
      const taxType = item.purchaseTaxType;
      const total = calculateTotal(taxType, quantity, costPrice, discount, tax);
      
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
      const quantity = Number(item.quantity) || 0;
      const costPrice = Number(item.costPrice) || 0;
      const discount = Number(item.discount) || 0;
      const itemSubtotal = quantity * costPrice;
      
      subtotal += itemSubtotal;
      discountAmount += discount;
      
      // For tax calculation in order summary:
      // - Exclusive tax: Add the tax amount to the total
      // - Inclusive tax: Tax is already included in cost price, so don't add it again
      if (item.purchaseTaxType === 'exclusive') {
        taxAmount += Number(item.tax) || 0;
      }
      // For inclusive tax, we don't add the tax amount because it's already included in the cost price
    });
    
    // Calculate unrounded total
    const unroundedTotal = subtotal - discountAmount + taxAmount;
    
    // Apply rounding only to the total
    const totalAmount = applyRounding(unroundedTotal, systemSettings.roundingMethod, systemSettings.roundingPrecision);
    
    // Calculate rounding adjustment
    const roundingAdjustment = totalAmount - unroundedTotal;
    
    setFormData(prev => ({
      ...prev,
      subtotal: subtotal,
      taxAmount: taxAmount,
      discountAmount: discountAmount,
      totalAmount,
      roundingAdjustment
    }));
  };
  
  // Check if form is valid
  const isFormValid = () => {
    return (
      formData.orderNumber?.trim() &&
      formData.supplierId?.trim() &&
      formData.orderDate &&
      formData.expectedDeliveryDate &&
      formData.status?.trim() &&
      items && items.length > 0
    );
  };

  const handleSubmit = async (statusOverride?: string) => {
    try {
      setLoading(true);
      
      // Validation checks
      const errors: string[] = [];
      
      // Check mandatory fields
      if (!formData.orderNumber?.trim()) {
        errors.push("Purchase Order # is required");
      }
      
      if (!formData.supplierId?.trim()) {
        errors.push("Supplier is required");
      }
      
      if (!formData.orderDate) {
        errors.push("Order Date is required");
      }
      
      if (!formData.expectedDeliveryDate) {
        errors.push("Expected Delivery Date is required");
      }
      
      const finalStatus = statusOverride || formData.status;
      if (!finalStatus?.trim()) {
        errors.push("Status is required");
      }
      
      // Check if at least one item is added
      if (!items || items.length === 0) {
        errors.push("At least one item must be added to the purchase order");
      }
      
      // If there are validation errors, show them and return
      if (errors.length > 0) {
        toast({
          title: "Validation Error",
          description: errors.join(", "),
          variant: "destructive",
        });
        return;
      }
      
      const purchaseOrderData = {
        ...formData,
        status: finalStatus,
        items: items
      } as Partial<PurchaseOrder>;
      
      console.log('Submitting PO with status:', finalStatus);
      
      onSave(purchaseOrderData);
      
      toast({
        title: purchaseOrder ? "Purchase Order Updated" : "Purchase Order Created",
        description: `Purchase order ${formData.orderNumber} has been ${purchaseOrder ? "updated" : "created"} successfully.`,
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving purchase order:', error);
      toast({
        title: "Error",
        description: "Failed to save purchase order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {purchaseOrder ? "Edit Purchase Order" : "Create Purchase Order"}
          </DialogTitle>
        </DialogHeader>
        
        {dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading purchase order data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* TOP SECTION - Purchase Order Details */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
          <div>
            <Label htmlFor="orderNumber" className="text-sm font-medium text-gray-700">
              Purchase Order # <span className="text-red-500">*</span>
            </Label>
            <Input
              id="orderNumber"
              name="orderNumber"
              value={formData.orderNumber}
              onChange={handleInputChange}
              className="mt-1 bg-gray-50 font-mono text-sm"
              disabled
              title="Purchase Order number is auto-generated and cannot be changed"
            />
          </div>
          
          <div>
            <Label htmlFor="supplierId" className="text-sm font-medium text-gray-700">
              Supplier <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.supplierId}
              onValueChange={(value) => handleSelectChange("supplierId", value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="orderDate" className="text-sm font-medium text-gray-700">
              Order Date <span className="text-red-500">*</span>
            </Label>
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
            <Label htmlFor="expectedDeliveryDate" className="text-sm font-medium text-gray-700">
              Expected Delivery Date <span className="text-red-500">*</span>
            </Label>
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
            <Label className="text-sm font-medium text-gray-700">Status</Label>
            <Input value={formData.status ? (formData.status.charAt(0).toUpperCase() + formData.status.slice(1)) : 'Draft'} className="mt-1 bg-gray-50" disabled />
          </div>
        </div>
        
        {/* MIDDLE SECTION - Items Table */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Items <span className="text-red-500">*</span>
            </h3>
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
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                                  <TableRow className="bg-gray-50">
                    <TableHead className="font-medium text-gray-700">Product</TableHead>
                    <TableHead className="font-medium text-gray-700">SKU</TableHead>
                    <TableHead className="font-medium text-gray-700">HSN</TableHead>
                    <TableHead className="font-medium text-gray-700">Quantity</TableHead>
                    <TableHead className="font-medium text-gray-700">Cost Price</TableHead>
                    <TableHead className="font-medium text-gray-700">Discount</TableHead>
                    <TableHead className="font-medium text-gray-700">Tax</TableHead>
                    <TableHead className="font-medium text-gray-700">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                                                <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.productName || 'No product selected'}</div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setShowProductSearch(true);
                                  // Store current item index for replacement
                                  sessionStorage.setItem('editingItemIndex', index.toString());
                                }}
                                className="flex-shrink-0"
                              >
                                <Search className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                      <TableCell className="font-mono text-sm">{item.skuCode || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{item.hsnCode || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              const safe = isNaN(v) ? 0 : Math.max(0, v);
                              handleItemChange(index, "quantity", safe);
                            }}
                            className="w-16"
                          />
                          {item.unitAbbreviation && (
                            <span className="text-sm text-gray-500 font-medium">
                              {item.unitAbbreviation}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.costPrice}
                          onChange={(e) => 
                            handleItemChange(index, "costPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-24 bg-gray-50"
                          disabled
                          title="Cost price is set from product data and cannot be changed"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.discount}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            const safe = isNaN(v) ? 0 : Math.max(0, v);
                            handleItemChange(index, "discount", safe);
                          }}
                          className="w-20"
                          title="Discount cannot be negative"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <Input
                            type="number"
                            value={item.tax}
                            onChange={(e) => 
                              handleItemChange(index, "tax", parseFloat(e.target.value) || 0)
                            }
                            className="w-20 bg-gray-50"
                            disabled
                            title="Tax is calculated automatically and cannot be changed"
                          />
                          {item.purchaseTaxType && (
                            <div className="absolute -top-6 left-0 right-0 flex justify-center">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                item.purchaseTaxType === 'inclusive' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {(() => {
                                  const product = products.find(p => p.id === item.productId);
                                  const taxRate = product?.purchase_tax?.rate ?? 0;
                                  const typeLabel = item.purchaseTaxType === 'inclusive' ? 'Incl' : 'Excl';
                                  return `${typeLabel} ${(taxRate * 100).toFixed(0)}%`;
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {formatCurrency(item.total || 0, currency)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No items added. Click "Add Item" to add products to this order.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* BOTTOM SECTION - Notes and Order Summary Side by Side */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT - Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes || ""}
              onChange={handleInputChange}
              className="mt-1"
              placeholder="Add any additional notes or instructions..."
              rows={4}
            />
          </div>
          
          {/* RIGHT - Order Summary */}
          <div className="flex justify-end">
            <div className="bg-gray-50 rounded-lg p-6 min-w-[300px]">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-mono font-medium">{formatCurrency(formData.subtotal || 0, currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-mono font-medium text-red-600">{formatCurrency(formData.discountAmount || 0, currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-mono font-medium">{formatCurrency(formData.taxAmount || 0, currency)}</span>
                </div>
                {(formData.roundingAdjustment !== null && formData.roundingAdjustment !== undefined) && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Rounding:</span>
                    <span className={`font-mono font-medium ${formData.roundingAdjustment > 0 ? 'text-green-600' : formData.roundingAdjustment < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {formData.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(formData.roundingAdjustment, currency)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(formData.totalAmount || 0, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="mt-8 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => handleSubmit('draft')} disabled={loading || !isFormValid()}>
            {loading ? "Saving..." : (purchaseOrder ? "Update Draft" : "Save Draft")}
          </Button>
          <Button onClick={() => handleSubmit('approved')} disabled={loading || !isFormValid()}>
            {loading ? "Saving..." : (purchaseOrder ? "Approve" : "Create & Approve")}
          </Button>
          <Button variant="destructive" onClick={() => handleSubmit('cancelled')} disabled={loading || !purchaseOrder}>
            {loading ? "Saving..." : "Mark Cancelled"}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
      
      {/* Product Search Dialog */}
      <ProductSearchDialog
        open={showProductSearch}
        onOpenChange={setShowProductSearch}
        products={products}
        onProductSelect={handleProductSelect}
        recentProducts={recentProducts}
        mode="purchase"
      />
    </Dialog>
  );
};
