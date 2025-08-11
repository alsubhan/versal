import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash, Search, Link, Unlink } from "lucide-react";
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
import { toast } from "sonner";
import { type SaleInvoice, type SaleInvoiceItem } from "@/types/sale-invoice";
import { type SalesOrder } from "@/types/sales-order";
import { type Customer } from "@/types/customer";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getSaleInvoice, getProducts, getTaxes, getSalesOrders, getSalesOrder, getCustomers } from "@/lib/api";
import { ProductSearchDialog } from "@/components/shared/ProductSearchDialog";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface SaleInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleInvoice: SaleInvoice | null;
  onSave: (saleInvoice: Partial<SaleInvoice>) => void;
}

export const SaleInvoiceDialog = ({ open, onOpenChange, saleInvoice, onSave }: SaleInvoiceDialogProps) => {
  const { currency } = useCurrencyStore();
  const { settings: systemSettings } = useSystemSettings();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  
  // Mode state: 'linked' = against existing SO, 'direct' = create internal SO
  const [creationMode, setCreationMode] = useState<'linked' | 'direct'>('linked');
  
  const [formData, setFormData] = useState<Partial<SaleInvoice>>({
    invoiceNumber: "",
    salesOrderId: "", // For linked creation
    customerId: "", // For direct creation
    invoiceDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "draft",
    paymentMethod: undefined, // Payment method field
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    notes: "",
    items: [],
  });
  
  const [items, setItems] = useState<Partial<SaleInvoiceItem>[]>([]);
  
  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadProducts();
      loadTaxes();
      loadSalesOrders();
      loadCustomers();
    }
  }, [open]);

  // Set creation mode based on whether sale invoice has salesOrderId
  useEffect(() => {
    if (saleInvoice) {
      // For editing: preserve the original mode based on isDirect field
      if (saleInvoice.isDirect) {
        setCreationMode('direct');
      } else {
        setCreationMode('linked');
      }
    } else {
      // For new invoice: default to linked mode
      setCreationMode('linked');
    }
  }, [saleInvoice]);

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error("Failed to load products");
    }
  };

  const loadTaxes = async () => {
    try {
      const data = await getTaxes();
      setTaxes(data);
    } catch (error) {
      console.error('Error loading taxes:', error);
      toast.error("Failed to load taxes");
    }
  };

  const loadSalesOrders = async () => {
    try {
      const data = await getSalesOrders();
      // Filter to only show approved/sent SOs that haven't been fully invoiced
      const availableSOs = data.filter((so: SalesOrder) => 
        so.status === 'approved' || so.status === 'sent'
      );
      setSalesOrders(availableSOs);
    } catch (error) {
      console.error('Error loading sales orders:', error);
      toast.error("Failed to load sales orders");
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error("Failed to load customers");
    }
  };

  // Check for wholesale customer and set default payment method when customers are loaded
  useEffect(() => {
    if (customers.length > 0 && formData.customerId) {
      setDefaultPaymentMethodForWholesale();
    }
  }, [customers, formData.customerId]);

  // Check for wholesale customer and set default payment method when form data changes
  useEffect(() => {
    if (customers.length > 0 && formData.customerId && !formData.paymentMethod) {
      setDefaultPaymentMethodForWholesale();
    }
  }, [formData.customerId, formData.paymentMethod, customers]);

  // Get default tax rate
  const getDefaultTaxRate = () => {
    const defaultTax = taxes.find(tax => tax.is_default && tax.is_active);
    return defaultTax ? defaultTax.rate : 0.1; // Default to 10% if no default tax found
  };

  // Calculate tax based on product's tax type and rate
  const calculateTax = (product: any, quantity: number, unitPrice: number, discount: number = 0) => {
    // Get the product's specific tax rate - NO FALLBACK
    const productTaxRate = product?.sale_tax?.rate;
    const subtotal = quantity * unitPrice;
    const amountAfterDiscount = subtotal - discount;
    
    // Check if product has tax type
    const taxType = product?.sale_tax_type;
    
    // Validate that product has required tax information
    // Note: productTaxRate can be 0 (valid), so we check for undefined/null
    if (productTaxRate === undefined || productTaxRate === null || !taxType) {
      throw new Error(`Product ${product?.name} (${product?.sku_code}) is missing required tax information. Tax rate: ${productTaxRate}, Tax type: ${taxType}`);
    }
    
    if (taxType === 'inclusive') {
      // For inclusive tax, the unit price already includes tax
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
  const calculateTotal = (taxType: 'inclusive' | 'exclusive', quantity: number, unitPrice: number, discount: number, tax: number) => {
    const subtotal = quantity * unitPrice;
    const amountAfterDiscount = subtotal - discount;
    
    if (taxType === 'inclusive') {
      // For inclusive tax, total is the unit price minus discount (tax is already included)
      return amountAfterDiscount;
    } else {
      // For exclusive tax, add tax on top
      return amountAfterDiscount + tax;
    }
  };

  // Handle creation mode change
  // Function to set default payment method for wholesale customers
  const setDefaultPaymentMethodForWholesale = () => {
    if (formData.customerId) {
      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      if (selectedCustomer && selectedCustomer.customerType === 'wholesale' && !formData.paymentMethod) {
        setFormData(prev => ({ 
          ...prev, 
          paymentMethod: "credit"
        }));
      }
    }
  };

  const handleModeChange = (mode: 'linked' | 'direct') => {
    setCreationMode(mode);
    // Reset related fields when switching modes
    if (mode === 'linked') {
      setFormData(prev => ({ ...prev, customerId: "" }));
    } else {
      setFormData(prev => ({ ...prev, salesOrderId: "" }));
      // When switching to direct mode, check if we need to set default payment method
      setTimeout(() => setDefaultPaymentMethodForWholesale(), 100);
    }
    
    // Check if we need to set default payment method for wholesale customers in both modes
    setTimeout(() => setDefaultPaymentMethodForWholesale(), 100);
  };

  // Load SO items when SO is selected in linked mode
  const handleSalesOrderSelect = async (salesOrderId: string) => {
    if (!salesOrderId) return;
    
    try {
      // Fetch complete sales order data including items
      const completeSO = await getSalesOrder(salesOrderId);
      if (completeSO && completeSO.items) {
        // Set the customer ID from the sales order
        setFormData(prev => ({
          ...prev,
          customerId: completeSO.customerId || completeSO.customer?.id || ''
        }));
        
        // Check if we need to set default payment method for wholesale customers
        setTimeout(() => setDefaultPaymentMethodForWholesale(), 100);
        
        // Convert SO items to Sale Invoice items
        const invoiceItems = completeSO.items.map(item => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          saleInvoiceId: "",
          salesOrderItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          skuCode: item.skuCode,
          hsnCode: item.hsnCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          tax: item.tax || 0,
          total: item.total || 0,
          saleTaxType: item.saleTaxType,
          unitAbbreviation: item.unitAbbreviation,
        }));
        
        setItems(invoiceItems);
        calculateTotals(invoiceItems);
      }
    } catch (error) {
      console.error('Error loading sales order items:', error);
      toast.error("Failed to load sales order items");
    }
  };

  useEffect(() => {
    if (open) {
      if (saleInvoice) {
        // If we have a sale invoice with ID, fetch complete data including items
        if (saleInvoice.id && !saleInvoice.items) {
        const fetchCompleteData = async () => {
          try {
              setDataLoading(true);
              const completeData = await getSaleInvoice(saleInvoice.id);
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
                  ...saleInvoice,
                  salesOrderId: saleInvoice.salesOrderId || saleInvoice.salesOrder?.id || '',
                  isDirect: saleInvoice.isDirect || false,
                });
                setItems(processedItems);
                
                // Set creation mode based on isDirect field
                if (saleInvoice.isDirect) {
                  setCreationMode('direct');
                } else {
                  setCreationMode('linked');
                }
            } else {
              // Fallback to existing data
                const processedItems = (saleInvoice.items || []).map(item => {
                  const product = products.find(p => p.id === item.productId);
                  return {
                    ...item,
                    unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                  };
                });
                
              setFormData({
                  ...saleInvoice,
                  salesOrderId: saleInvoice.salesOrderId || saleInvoice.salesOrder?.id || '',
                  isDirect: saleInvoice.isDirect || false,
                });
                setItems(processedItems);
                
                // Set creation mode based on isDirect field
                if (saleInvoice.isDirect) {
                  setCreationMode('direct');
                } else {
                  setCreationMode('linked');
                }
            }
          } catch (error) {
            console.error('Error fetching complete sale invoice data:', error);
            // Fallback to existing data
              const processedItems = (saleInvoice.items || []).map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                  ...item,
                  unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                };
              });
              
            setFormData({
                ...saleInvoice,
                salesOrderId: saleInvoice.salesOrderId || saleInvoice.salesOrder?.id || '',
                isDirect: saleInvoice.isDirect || false,
              });
              setItems(processedItems);
              
              // Set creation mode based on isDirect field
              if (saleInvoice.isDirect) {
                setCreationMode('direct');
              } else {
                setCreationMode('linked');
              }
            } finally {
              setDataLoading(false);
          }
        };
        fetchCompleteData();
      } else {
        // Use existing data
          const processedItems = (saleInvoice.items || []).map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
              ...item,
              unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
            };
          });
          
        setFormData({
            ...saleInvoice,
            salesOrderId: saleInvoice.salesOrderId || saleInvoice.salesOrder?.id || '',
            isDirect: saleInvoice.isDirect || false,
          });
          setItems(processedItems);
          
          // Set creation mode based on isDirect field
          if (saleInvoice.isDirect) {
            setCreationMode('direct');
            // Check if we need to set default payment method for wholesale customers
            setTimeout(() => setDefaultPaymentMethodForWholesale(), 100);
    } else {
            setCreationMode('linked');
          }
      }
    } else {
        // Generate a new Invoice number based on current date
        const today = new Date();
        const invoiceNumber = `INV-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
        
    setFormData({
          invoiceNumber: invoiceNumber,
      salesOrderId: "",
      customerId: "",
          invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "draft",
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
          notes: "",
          items: [],
          isDirect: false, // Default to linked mode for new invoices
        });
        setItems([]);
      }
    }
  }, [saleInvoice, open]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    if (name === "customerId" && creationMode === 'direct') {
      // Auto-set payment method for wholesale customers
      const selectedCustomer = customers.find(c => c.id === value);
      if (selectedCustomer && selectedCustomer.customerType === 'wholesale') {
        setFormData(prev => ({ 
          ...prev, 
          [name]: value,
          paymentMethod: "credit" // Auto-set to credit for wholesale customers
        }));
        return;
      }
    }
    
    setFormData({ ...formData, [name]: value });
    
    // Handle special cases
    if (name === 'salesOrderId') {
      handleSalesOrderSelect(value);
    }
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
    // Note: product.sale_tax.rate can be 0 (valid), so we check for undefined/null
    if (product?.sale_tax?.rate === undefined || product?.sale_tax?.rate === null) {
      toast.error(`Product ${product?.name} (${product?.sku_code}) is missing tax rate information. Please update the product.`);
      return;
    }
    
    if (!product?.sale_tax_type) {
      toast.error(`Product ${product?.name} (${product?.sku_code}) is missing tax type information. Please update the product.`);
      return;
    }
    
    if (!product?.sale_price) {
      toast.error(`Product ${product?.name} (${product?.sku_code}) is missing sale price. Please update the product.`);
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
      const calculatedTax = calculateTax(product, quantity, product.sale_price, discount);
      
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        unitPrice: product.sale_price,
        saleTaxType: product.sale_tax_type,
        tax: calculatedTax,
        total: calculateTotal(product.sale_tax_type, quantity, product.sale_price, discount, calculatedTax),
        unitAbbreviation: product.units?.abbreviation || '',
      };
      
      setItems(newItems);
      calculateTotals(newItems);
      sessionStorage.removeItem('editingItemIndex');
    } else {
      // Add new item
      const quantity = 1;
      const discount = 0;
      const calculatedTax = calculateTax(product, quantity, product.sale_price, discount);
      
      const newItem = {
        id: `temp-${Date.now()}`,
        saleInvoiceId: "",
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        quantity: quantity,
        unitPrice: product.sale_price,
        discount: discount,
        tax: calculatedTax,
        total: calculateTotal(product.sale_tax_type, quantity, product.sale_price, discount, calculatedTax),
        saleTaxType: product.sale_tax_type,
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
        newItems[index].unitPrice = product.sale_price;
        newItems[index].unitAbbreviation = product.units?.abbreviation || '';
      }
    }
    
    // Recalculate item total and tax
    if (["quantity", "unitPrice", "discount"].includes(field)) {
      const item = newItems[index];
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discount = Number(item.discount) || 0;
      
      // Find the product to get its tax rate
      const product = products.find(p => p.id === item.productId);
      if (product) {
        try {
          const calculatedTax = calculateTax(product, quantity, unitPrice, discount);
          newItems[index].tax = calculatedTax;
        } catch (error) {
          console.error('Tax calculation failed:', error);
          toast.error("Tax Calculation Error");
          return; // Don't update the item if tax calculation fails
        }
      }
      
      const tax = Number(newItems[index].tax) || 0;
      const taxType = item.saleTaxType;
      const total = calculateTotal(taxType, quantity, unitPrice, discount, tax);
      
      newItems[index].total = total;
    }
    
    setItems(newItems);
    calculateTotals(newItems);
  };
  
  const calculateTotals = (itemsList: Partial<SaleInvoiceItem>[]) => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    
    itemsList.forEach(item => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discount = Number(item.discount) || 0;
      const itemSubtotal = quantity * unitPrice;
      
      subtotal += itemSubtotal;
      discountAmount += discount;
      
      // For tax calculation in invoice summary:
      // - Exclusive tax: Add the tax amount to the total
      // - Inclusive tax: Tax is already included in unit price, so don't add it again
      if (item.saleTaxType === 'exclusive') {
        taxAmount += Number(item.tax) || 0;
      }
      // For inclusive tax, we don't add the tax amount because it's already included in the unit price
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
    const baseValidation = (
      formData.invoiceNumber?.trim() &&
      formData.invoiceDate &&
      formData.dueDate &&
      formData.status?.trim() &&
      formData.customerId?.trim() && // Always require customer ID
      formData.paymentMethod && // Payment method is mandatory
      items && items.length > 0
    );

    if (creationMode === 'linked') {
      return baseValidation && formData.salesOrderId?.trim();
    } else {
      return baseValidation; // customerId is already checked in baseValidation
    }
  };

  const handleSubmit = async (finalize?: boolean, statusOverride?: string) => {
    try {
      setLoading(true);
      
      // Validation checks
      const errors: string[] = [];
      
      // Check mandatory fields
      if (!formData.invoiceNumber?.trim()) {
        errors.push("Invoice # is required");
      }
      
      if (!formData.customerId?.trim()) {
        errors.push("Customer is required");
      }
      
      if (creationMode === 'linked' && !formData.salesOrderId?.trim()) {
        errors.push("Sales Order is required for linked invoice");
      }
      
      if (!formData.invoiceDate) {
        errors.push("Invoice Date is required");
      }
      
      if (!formData.dueDate) {
        errors.push("Due Date is required");
      }
      
      // Validate payment method for all customers
      if (!formData.paymentMethod) {
        errors.push("Payment method is required");
      }
      
      // Check if at least one item is added
      if (!items || items.length === 0) {
        errors.push("At least one item must be added to the invoice");
      }
      
      // Validate items have required data
      if (items && items.length > 0) {
        items.forEach((item, index) => {
          if (!item.productId) {
            errors.push(`Item ${index + 1}: Product is required`);
          }
          if (!item.quantity || item.quantity <= 0) {
            errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
          }
          if (!item.unitPrice || item.unitPrice <= 0) {
            errors.push(`Item ${index + 1}: Unit price must be greater than 0`);
          }
        });
      }
      
      // If there are validation errors, show them and return
      if (errors.length > 0) {
        toast.error(errors.join(", "));
        return;
      }

      const saleInvoiceData = {
        ...formData,
        status: statusOverride || (finalize ? "sent" : (formData.status || "draft")),
        isDirect: creationMode === 'direct', // Set isDirect flag based on creation mode
        items: items
      } as Partial<SaleInvoice>;
      
      onSave(saleInvoiceData);
      
      toast.success(`Sale invoice ${formData.invoiceNumber} has been ${finalize ? 'sent' : (saleInvoice ? 'updated' : 'saved as draft')} successfully.`);
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving sale invoice:', error);
      toast.error("Failed to save sale invoice");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
          <DialogTitle>
            {saleInvoice ? "Edit Sale Invoice" : "Create Sale Invoice"}
          </DialogTitle>
          </DialogHeader>
          
        {dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading sale invoice data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* CREATION MODE SELECTOR */}
            <div className="mb-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Creation Mode
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={creationMode === 'linked' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('linked')}
                  className="flex items-center gap-2"
                  disabled={saleInvoice?.id !== undefined} // Only disable if editing existing invoice
                >
                  <Link className="h-4 w-4" />
                  Against Sales Order
                </Button>
                <Button
                  type="button"
                  variant={creationMode === 'direct' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('direct')}
                  className="flex items-center gap-2"
                  disabled={saleInvoice?.id !== undefined} // Only disable if editing existing invoice
                >
                  <Unlink className="h-4 w-4" />
                  Direct Invoice (Auto SO)
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {saleInvoice?.id ? 
                  'Creation mode cannot be changed for existing invoices' :
                  creationMode === 'linked' 
                    ? 'Create invoice against an existing confirmed Sales Order'
                    : 'Create invoice directly - a Sales Order will be generated automatically'
                }
              </p>
            </div>
              
            {/* TOP SECTION - Sale Invoice Details */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
              <div>
                <Label htmlFor="invoiceNumber" className="text-sm font-medium text-gray-700">
                  Invoice # <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoiceNumber"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleInputChange}
                  className="mt-1 bg-gray-50 font-mono text-sm"
                  disabled
                  title="Invoice number is auto-generated and cannot be changed"
                />
              </div>
              
              {creationMode === 'linked' ? (
                <div>
                  <Label htmlFor="salesOrderId" className="text-sm font-medium text-gray-700">
                    Sales Order <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.salesOrderId}
                    onValueChange={(value) => handleSelectChange("salesOrderId", value)}
                    disabled={saleInvoice?.id !== undefined} // Only disable if editing existing invoice
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select sales order" />
                  </SelectTrigger>
                  <SelectContent>
                      {salesOrders.map((so) => (
                        <SelectItem key={so.id} value={so.id}>
                          {so.orderNumber} - {so.customer?.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              ) : (
                <div>
                  <Label htmlFor="customerId" className="text-sm font-medium text-gray-700">
                    Customer <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => handleSelectChange("customerId", value)}
                    disabled={saleInvoice?.id !== undefined} // Only disable if editing existing invoice
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                </div>
              )}
              
              {creationMode === 'linked' && formData.salesOrderId && (
                <div>
                  <Label htmlFor="orderedDate" className="text-sm font-medium text-gray-700">
                    Ordered Date
                  </Label>
                  <Input
                    id="orderedDate"
                    value={(() => {
                      const selectedSO = salesOrders.find(so => so.id === formData.salesOrderId);
                      return selectedSO?.orderDate ? format(new Date(selectedSO.orderDate), "PPP") : "N/A";
                    })()}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
              </div>
              )}
            
              <div>
                <Label htmlFor="invoiceDate" className="text-sm font-medium text-gray-700">
                  Invoice Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.invoiceDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.invoiceDate ? format(formData.invoiceDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.invoiceDate}
                      onSelect={(date) => handleDateChange("invoiceDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label htmlFor="dueDate" className="text-sm font-medium text-gray-700">
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.dueDate ? format(formData.dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.dueDate}
                      onSelect={(date) => handleDateChange("dueDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
            </div>
            
              <div>
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Input value={formData.status ? (formData.status.charAt(0).toUpperCase() + formData.status.slice(1)) : 'Draft'} className="mt-1 bg-gray-50" disabled />
              </div>
              
              <div>
                <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700">
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.paymentMethod || ""}
                  onValueChange={(value) => handleSelectChange("paymentMethod", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="online">Online Payment</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* MIDDLE SECTION - Items Table */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Items <span className="text-red-500">*</span>
                </h3>
                {creationMode === 'direct' && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addItem}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                )}
                {creationMode === 'linked' && (
                  <div className="text-sm text-gray-500 italic">
                    Items are loaded from Sales Order - no editing allowed
                  </div>
                )}
                </div>
                
              <div className={`border rounded-lg overflow-hidden ${creationMode === 'linked' ? 'bg-gray-50' : ''}`}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium text-gray-700">Product</TableHead>
                      <TableHead className="font-medium text-gray-700">SKU</TableHead>
                      <TableHead className="font-medium text-gray-700">HSN</TableHead>
                      <TableHead className="font-medium text-gray-700">Quantity</TableHead>
                      <TableHead className="font-medium text-gray-700">Unit Price</TableHead>
                      <TableHead className="font-medium text-gray-700">Discount</TableHead>
                      <TableHead className="font-medium text-gray-700">Tax</TableHead>
                      <TableHead className="font-medium text-gray-700">Total</TableHead>
                      {creationMode === 'direct' && (
                        <TableHead className="w-[50px]"></TableHead>
                      )}
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
                              {creationMode === 'direct' && (
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
                              )}
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
                                disabled={creationMode === 'linked'}
                                title={creationMode === 'linked' ? "Quantity cannot be changed in linked mode" : "Quantity cannot be negative"}
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
                              value={item.unitPrice}
                              onChange={(e) => 
                                handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              className="w-24 bg-gray-50"
                              disabled
                              title="Unit price is set from product data and cannot be changed"
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
                              disabled={creationMode === 'linked'}
                              title={creationMode === 'linked' ? "Discount cannot be changed in linked mode" : "Discount cannot be negative"}
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
                              {item.saleTaxType && (
                                <div className="absolute -top-6 left-0 right-0 flex justify-center">
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                                    item.saleTaxType === 'inclusive' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {(() => {
                                      const product = products.find(p => p.id === item.productId);
                                      const taxRate = product?.sale_tax?.rate ?? 0;
                                      const typeLabel = item.saleTaxType === 'inclusive' ? 'Incl' : 'Excl';
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
                          {creationMode === 'direct' && (
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
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                          {creationMode === 'linked' 
                            ? 'No items found in the selected Sales Order.'
                            : 'No items added. Click "Add Item" to add products to this invoice.'
                          }
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                        </div>
                        </div>
                        
            {/* BOTTOM SECTION - Notes and Invoice Summary Side by Side */}
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
                        
              {/* RIGHT - Invoice Summary */}
              <div className="flex justify-end">
                <div className="bg-gray-50 rounded-lg p-6 min-w-[300px]">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h4>
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="secondary" onClick={() => handleSubmit(false)} disabled={loading || !isFormValid()}>
                {loading ? "Saving..." : (saleInvoice ? "Update Draft" : "Save Draft")}
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading || !isFormValid()}>
                {loading ? "Saving..." : (saleInvoice ? "Mark Sent" : "Complete Invoice")}
              </Button>
              <Button variant="destructive" onClick={() => handleSubmit(false, 'cancelled')} disabled={loading || !saleInvoice}>
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
        mode="sale"
      />
    </Dialog>
  );
};
