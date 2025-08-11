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
import { type CreditNote, type CreditNoteItem } from "@/types/credit-note";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getCreditNote, getProducts, getTaxes, getCustomerInvoices, getSaleInvoice } from "@/lib/api";
import { ProductSearchDialog } from "@/components/shared/ProductSearchDialog";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface CreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditNote: CreditNote | null;
  onSave: (creditNote: Partial<CreditNote>) => void;
  customers: { id: string; name: string }[];
}

export const CreditNoteDialog = ({ open, onOpenChange, creditNote, onSave, customers }: CreditNoteDialogProps) => {
  const { toast } = useToast();
  const { currency } = useCurrencyStore();
  const { settings: systemSettings } = useSystemSettings();
  
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]); // NEW: Store customer invoices
  
  const [formData, setFormData] = useState<Partial<CreditNote>>({
    creditNoteNumber: "",
    customerId: "",
    invoiceId: undefined,  // NEW: Add invoice_id field - use undefined instead of empty string
    creditDate: new Date(),
    reason: "return",
    reasonDescription: "",
    status: "draft",
    approvalRequired: false,
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    refundMethod: "credit_account",
    refundProcessed: false,
    affectsInventory: true,
    inventoryProcessed: false,
    creditNoteType: "invoice_linked",  // NEW: Default to invoice_linked
    notes: "",
    items: [],
  });
  
  const [items, setItems] = useState<Partial<CreditNoteItem>[]>([]);
  
  // Load products and taxes when dialog opens
  useEffect(() => {
    if (open) {
      loadProducts();
      loadTaxes();
    }
  }, [open]);

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

  // NEW: Load customer invoices when customer is selected
  const loadCustomerInvoices = async (customerId: string) => {
    if (!customerId) {
      setCustomerInvoices([]);
      return;
    }
    
    try {
      const data = await getCustomerInvoices(customerId);
      setCustomerInvoices(data || []);
    } catch (error) {
      console.error('Error loading customer invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load customer invoices",
        variant: "destructive",
      });
    }
  };

  // NEW: Load invoice items when invoice is selected
  const loadInvoiceItems = async (invoiceId: string) => {
    if (!invoiceId) {
      setItems([]);
      return;
    }
    
    try {
      const invoiceData = await getSaleInvoice(invoiceId);
      
      if (invoiceData && !invoiceData.error && invoiceData.items) {
        // Convert invoice items to credit note items format
        const creditNoteItems = invoiceData.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          skuCode: item.skuCode,
          hsnCode: item.hsnCode,
          quantity: item.quantity,
          originalQuantity: item.quantity, // Store original quantity for validation
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          originalDiscount: item.discount || 0, // Store original discount for validation
          tax: item.tax || 0,
          total: item.total || (item.quantity * item.unitPrice),
          saleTaxType: item.saleTaxType,
          unitAbbreviation: item.unitAbbreviation,
        }));
        
        setItems(creditNoteItems);
        
        // Update form data with invoice totals
        setFormData(prev => ({
          ...prev,
          subtotal: invoiceData.subtotal || 0,
          taxAmount: invoiceData.taxAmount || 0,
          discountAmount: invoiceData.discountAmount || 0,
          totalAmount: invoiceData.totalAmount || 0,
        }));
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading invoice items:', error);
      toast({
        title: "Error",
        description: "Failed to load invoice items",
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

  useEffect(() => {
    if (open) {
    if (creditNote) {
      // If we have a credit note with ID, fetch complete data including items
      if (creditNote.id && !creditNote.items) {
        const fetchCompleteData = async () => {
          try {
              setDataLoading(true);
            const completeData = await getCreditNote(creditNote.id);
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
                const processedItems = (creditNote.items || []).map(item => {
                  const product = products.find(p => p.id === item.productId);
                  return {
                    ...item,
                    unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                  };
                });
                
              setFormData({
                ...creditNote,
              });
                setItems(processedItems);
            }
          } catch (error) {
            console.error('Error fetching complete credit note data:', error);
            // Fallback to existing data
              const processedItems = (creditNote.items || []).map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                  ...item,
                  unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
                };
              });
              
            setFormData({
              ...creditNote,
            });
              setItems(processedItems);
            } finally {
              setDataLoading(false);
          }
        };
        fetchCompleteData();
      } else {
        // Use existing data
          const processedItems = (creditNote.items || []).map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
              ...item,
              unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
            };
          });
          
        setFormData({
          ...creditNote,
        });
          setItems(processedItems);
      }
    } else {
        // Generate a new Credit Note number based on current date
        const today = new Date();
        const creditNoteNumber = `CN-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
        
              setFormData({
          creditNoteNumber: creditNoteNumber,
          customerId: "",
          invoiceId: undefined,  // NEW: Initialize invoice_id
          creditDate: new Date(),
          reason: "return",
          reasonDescription: "",
          status: "draft",
          approvalRequired: false,
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          refundMethod: "credit_account",
          refundProcessed: false,
          affectsInventory: true,
          inventoryProcessed: false,
          creditNoteType: "invoice_linked",  // NEW: Default to invoice_linked
          notes: "",
          items: [],
      });
        setItems([]);
      }
    }
  }, [creditNote, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
    if (name === "customerId") {
      loadCustomerInvoices(value);
      // Clear invoice and items when customer changes
      setFormData(prev => ({ ...prev, invoiceId: undefined }));
      setItems([]);
    } else if (name === "invoiceId" && value && formData.creditNoteType === "invoice_linked") {
      loadInvoiceItems(value);
    } else if (name === "creditNoteType") {
      if (value === "standalone") {
        // Clear invoice selection and items when switching to standalone
        setFormData(prev => ({ ...prev, invoiceId: undefined }));
        setItems([]);
      }
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
      toast({
        title: "Invalid Product",
        description: `Product ${product?.name} (${product?.sku_code}) is missing tax rate information. Please update the product.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!product?.sale_tax_type) {
      toast({
        title: "Invalid Product",
        description: `Product ${product?.name} (${product?.sku_code}) is missing tax type information. Please update the product.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!product?.sale_price) {
      toast({
        title: "Invalid Product",
        description: `Product ${product?.name} (${product?.sku_code}) is missing sale price. Please update the product.`,
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
        creditNoteId: "",
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
    const currentItem = newItems[index];
    
    // Validation for Invoice Linked mode
    if (formData.creditNoteType === "invoice_linked") {
      if (field === 'quantity') {
        // Limit quantity to original invoice quantity
        const maxQuantity = currentItem.originalQuantity || currentItem.quantity || 0;
        if (value > maxQuantity) {
          toast({
            title: "Validation Error",
            description: `Quantity cannot exceed the original invoice quantity (${maxQuantity})`,
            variant: "destructive",
          });
          return; // Don't update if validation fails
        }
      }
      
      if (field === 'discount') {
        // Prevent discount editing in Invoice Linked mode
        toast({
          title: "Restricted",
          description: "Discount cannot be modified in Invoice Linked mode",
          variant: "destructive",
        });
        return; // Don't update if validation fails
      }
    }
    
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
          toast({
            title: "Tax Calculation Error",
            description: error.message,
            variant: "destructive",
          });
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
  
  const calculateTotals = (itemsList: Partial<CreditNoteItem>[]) => {
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
      
      // For tax calculation in credit note summary:
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
      formData.creditNoteNumber?.trim() &&
      formData.customerId?.trim() &&
      formData.creditDate &&
      formData.reason?.trim() &&
      formData.status?.trim() &&
      formData.creditNoteType &&
      items && items.length > 0
    );
    
    // Additional validation for invoice_linked credit notes
    if (formData.creditNoteType === "invoice_linked") {
      return baseValidation && formData.invoiceId && typeof formData.invoiceId === 'string' && formData.invoiceId.trim();
    }
    
    return baseValidation;
  };

  const handleSubmit = async (statusOverride?: string) => {
    try {
      setLoading(true);
      
      // Validation checks
      const errors: string[] = [];
      
      // Check mandatory fields
      if (!formData.creditNoteNumber?.trim()) {
        errors.push("Credit Note # is required");
      }
      
      if (!formData.customerId?.trim()) {
        errors.push("Customer is required");
      }
      
      if (!formData.creditDate) {
        errors.push("Credit Date is required");
      }
      
      if (!formData.reason?.trim()) {
        errors.push("Reason is required");
      }
      
      if (!formData.status?.trim()) {
        errors.push("Status is required");
      }
      
      // Check if at least one item is added
      if (!items || items.length === 0) {
        errors.push("At least one item must be added to the credit note");
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
    
      const creditNoteData = {
        ...formData,
        status: statusOverride || formData.status || "draft",
        items: items
      } as Partial<CreditNote>;
      
      onSave(creditNoteData);
      
      toast({
        title: creditNote ? "Credit Note Updated" : "Credit Note Created",
        description: `Credit note ${formData.creditNoteNumber} has been ${creditNote ? "updated" : "created"} successfully.`,
    });
    
    onOpenChange(false);
    } catch (error) {
      console.error('Error saving credit note:', error);
      toast({
        title: "Error",
        description: "Failed to save credit note",
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
          {creditNote ? "Edit Credit Note" : "Create Credit Note"}
        </DialogTitle>
        </DialogHeader>
          
        {dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading credit note data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* TOP SECTION - Credit Note Details */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
              <div>
                <Label htmlFor="creditNoteNumber" className="text-sm font-medium text-gray-700">
                  Credit Note # <span className="text-red-500">*</span>
                </Label>
              <Input
                id="creditNoteNumber"
                name="creditNoteNumber"
                value={formData.creditNoteNumber}
                onChange={handleInputChange}
                  className="mt-1 bg-gray-50 font-mono text-sm"
                  disabled
                  title="Credit Note number is auto-generated and cannot be changed"
              />
            </div>
            
                          <div>
              <Label htmlFor="customerId" className="text-sm font-medium text-gray-700">
                Customer <span className="text-red-500">*</span>
              </Label>

              <Select 
                value={formData.customerId || undefined}
                onValueChange={(value) => handleSelectChange("customerId", value)}
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
            
            <div>
              <Label htmlFor="creditNoteType" className="text-sm font-medium text-gray-700">
                Credit Note Type <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={formData.creditNoteType || undefined}
                onValueChange={(value) => handleSelectChange("creditNoteType", value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice_linked">Invoice Linked</SelectItem>
                  <SelectItem value="standalone">Standalone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.creditNoteType === "invoice_linked" && (
              <div>
                <Label htmlFor="invoiceId" className="text-sm font-medium text-gray-700">
                  Invoice <span className="text-red-500">*</span>
                </Label>

                <Select 
                  value={formData.invoiceId || undefined}
                  onValueChange={(value) => handleSelectChange("invoiceId", value === "no-invoices" ? undefined : value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerInvoices.length > 0 ? (
                      customerInvoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber || invoice.invoice_number} - ₹{invoice.totalAmount || invoice.total_amount} ({new Date(invoice.invoiceDate || invoice.invoice_date).toLocaleDateString()})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-invoices" disabled>
                        {formData.customerId ? "No invoices found for this customer" : "Select customer first"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formData.customerId && customerInvoices.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No invoices found for this customer. You may need to create a standalone credit note instead.
                  </p>
                )}
                {formData.creditNoteType === "invoice_linked" && formData.invoiceId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Invoice items will be automatically loaded when an invoice is selected.
                  </p>
                )}
              </div>
            )}
            
              <div>
                <Label htmlFor="creditDate" className="text-sm font-medium text-gray-700">
                  Credit Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.creditDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.creditDate ? format(formData.creditDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.creditDate}
                      onSelect={(date) => handleDateChange("creditDate", date)}
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
                {formData.creditNoteType === "standalone" && (
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
              </div>
            
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium text-gray-700">Product</TableHead>
                      <TableHead className="font-medium text-gray-700">SKU</TableHead>
                      <TableHead className="font-medium text-gray-700">HSN</TableHead>
                      <TableHead className="font-medium text-gray-700">Credit Qty</TableHead>
                      <TableHead className="font-medium text-gray-700">Unit Price</TableHead>
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
                                max={formData.creditNoteType === "invoice_linked" ? item.originalQuantity || item.quantity : undefined}
                                value={item.quantity}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  const safe = isNaN(v) ? 0 : Math.max(0, v);
                                  handleItemChange(index, "quantity", safe);
                                }}
                                className="w-16"
                                title={formData.creditNoteType === "invoice_linked" ? `Max quantity: ${item.originalQuantity || item.quantity}` : "Enter quantity"}
                              />
                              {item.unitAbbreviation && (
                                <span className="text-sm text-gray-500 font-medium">
                                  {item.unitAbbreviation}
                                </span>
                              )}
                              {formData.creditNoteType === "invoice_linked" && item.originalQuantity && (
                                <span className="text-xs text-gray-400">
                                  /{item.originalQuantity}
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
                              className={`w-20 ${formData.creditNoteType === "invoice_linked" ? "bg-gray-50" : ""}`}
                              disabled={formData.creditNoteType === "invoice_linked"}
                              title={formData.creditNoteType === "invoice_linked" ? "Discount cannot be modified in Invoice Linked mode" : "Discount cannot be negative"}
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
                          No items added. Click "Add Item" to add products to this credit note.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
                  </div>
                  
            {/* BOTTOM SECTION - Notes and Credit Note Summary Side by Side */}
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
                  
              {/* RIGHT - Credit Note Summary */}
              <div className="flex justify-end">
                <div className="bg-gray-50 rounded-lg p-6 min-w-[300px]">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Credit Note Summary</h4>
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
              <Button variant="secondary" onClick={() => handleSubmit('draft')} disabled={loading || !isFormValid()}>
                {loading ? "Saving..." : (creditNote ? "Update Draft" : "Save Draft")}
              </Button>
              <Button onClick={() => handleSubmit('processed')} disabled={loading || !isFormValid()}>
                {loading ? "Saving..." : (creditNote ? "Mark Processed" : "Create & Process")}
              </Button>
              <Button variant="destructive" onClick={() => handleSubmit('cancelled')} disabled={loading || !creditNote}>
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
