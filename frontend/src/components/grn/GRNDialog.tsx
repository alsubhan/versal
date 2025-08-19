import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash, Search, Link, Unlink } from "lucide-react";

// Debug mode check
const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true' || import.meta.env.DEV;
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
import { type GoodsReceiveNote, type GoodsReceiveNoteItem } from "@/types/grn";
import { type PurchaseOrder } from "@/types/purchase-order";
import { type Supplier } from "@/types/supplier";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getGoodReceiveNote, getProducts, getTaxes, getPurchaseOrders, getAvailablePurchaseOrdersForGRN, getSuppliers, getPurchaseOrder, createGoodReceiveNote, updateGoodReceiveNote, listSerials } from "@/lib/api";
import { ProductSearchDialog } from "@/components/shared/ProductSearchDialog";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useAuthStore } from "@/stores/authStore";

interface GRNDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grn: GoodsReceiveNote | null;
  onSave: (grn: Partial<GoodsReceiveNote>) => void;
}

export const GRNDialog = ({ open, onOpenChange, grn, onSave }: GRNDialogProps): JSX.Element => {
  const { currency } = useCurrencyStore();
  const { settings: systemSettings } = useSystemSettings();
  const { user } = useAuthStore();
  
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [recentProducts, setRecentProducts] = useState<any[]>([]);
  
  // Mode state: 'linked' = against existing PO, 'direct' = create internal PO
  const [creationMode, setCreationMode] = useState<'linked' | 'direct'>('linked');
  
  const [formData, setFormData] = useState<Partial<GoodsReceiveNote>>({
    grnNumber: "",
    purchaseOrderId: "",
    supplierId: "", // For direct creation
    receivedDate: new Date(),
    deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) as any, // For direct mode - default to 7 days from now
    status: "draft",
    receivedBy: "",
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    notes: "",
    items: [],
  });
  
  const [items, setItems] = useState<Partial<GoodsReceiveNoteItem>[]>([]);
  const poItemsLoadedRef = useRef<boolean>(false);
  const lastAutoLoadKeyRef = useRef<string | null>(null);

  // Debug items state changes
  useEffect(() => {
    if (DEBUG_MODE) {
      console.log('Items state updated:', items.length, items);
    }
  }, [items]);

  // Debug showProductSearch state changes
  useEffect(() => {
    console.log('DEBUG: showProductSearch state changed to:', showProductSearch);
  }, [showProductSearch]);
  
  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadProducts();
      loadTaxes();
      loadPurchaseOrders();
      loadSuppliers();
    }
  }, [open]);

  // Reset auto-load guards whenever dialog opens or GRN changes
  useEffect(() => {
    if (open) {
      poItemsLoadedRef.current = false;
      lastAutoLoadKeyRef.current = null;
    }
  }, [open, grn?.id]);

  // Default Received By to the signed-in user for new GRNs
  useEffect(() => {
    if (open && !grn && user?.id) {
      setFormData(prev => ({ ...prev, receivedBy: prev.receivedBy || user.id }));
    }
  }, [open, grn, user?.id]);

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

  const loadPurchaseOrders = async () => {
    try {
      // Use the new efficient endpoint that already filters out orders with GRNs
      const data = await getAvailablePurchaseOrdersForGRN();
      setPurchaseOrders(data);
    } catch (error) {
      console.error('Error loading available purchase orders:', error);
      toast.error("Failed to load available purchase orders");
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast.error("Failed to load suppliers");
    }
  };

  // Get default tax rate
  const getDefaultTaxRate = () => {
    const defaultTax = taxes.find(tax => tax.is_default && tax.is_active);
    return defaultTax ? defaultTax.rate : 0.1; // Default to 10% if no default tax found
  };

  // Calculate tax based on product's tax type and rate
  const calculateTax = (product: any, quantity: number, unitCost: number, discount: number = 0) => {
    // Get the product's specific tax rate - NO FALLBACK
    const productTaxRate = product?.purchase_tax?.rate;
    const subtotal = quantity * unitCost;
    const amountAfterDiscount = subtotal - discount;
    
    // Check if product has tax type
    const taxType = product?.purchase_tax_type;
    
    // Validate that product has required tax information
    // Note: productTaxRate can be 0 (valid), so we check for undefined/null
    if (productTaxRate === undefined || productTaxRate === null || !taxType) {
      throw new Error(`Product ${product?.name} (${product?.sku_code}) is missing required tax information. Tax rate: ${productTaxRate}, Tax type: ${taxType}`);
    }
    
    if (taxType === 'inclusive') {
      // For inclusive tax, the unit cost already includes tax
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
  const calculateTotal = (taxType: 'inclusive' | 'exclusive', quantity: number, unitCost: number, discount: number, tax: number) => {
    const subtotal = quantity * unitCost;
    const amountAfterDiscount = subtotal - discount;
    
    if (taxType === 'inclusive') {
      // For inclusive tax, total is the unit cost minus discount (tax is already included)
      return amountAfterDiscount;
    } else {
      // For exclusive tax, add tax on top
      return amountAfterDiscount + tax;
    }
  };

  // Handle creation mode change
  const handleModeChange = (mode: 'linked' | 'direct') => {
    setCreationMode(mode);
    // Reset related fields when switching modes
    if (mode === 'linked') {
      setFormData(prev => ({ ...prev, supplierId: "" }));
    } else {
      setFormData(prev => ({ ...prev, purchaseOrderId: "" }));
    }
  };

  // Load PO items when PO is selected in linked mode
  const handlePurchaseOrderSelect = async (purchaseOrderId: string) => {
    if (!purchaseOrderId) {
      setItems([]);
      calculateTotals([]);
      return;
    }
    
    try {
      if (DEBUG_MODE) {
        console.log('Loading purchase order:', purchaseOrderId);
      }
      
      // Fetch complete purchase order data including items
      const completePO = await getPurchaseOrder(purchaseOrderId);
      
      if (DEBUG_MODE) {
        console.log('Complete PO data:', completePO);
        console.log('PO items:', completePO?.items);
      }
      
      if (completePO && completePO.items && completePO.items.length > 0) {
        // Convert PO items to GRN items
        const grnItems = completePO.items.map((item, index) => {
          if (DEBUG_MODE) {
            console.log(`Processing item ${index}:`, item);
          }
          
          return {
            id: `temp-${Date.now()}-${index}`,
            goodReceiveNoteId: "",
            purchaseOrderItemId: item.id, // CRITICAL: Link to the purchase order item
            productId: item.productId,
            productName: item.productName,
            skuCode: item.skuCode,
            hsnCode: item.hsnCode,
            orderedQuantity: item.quantity,
            receivedQuantity: 0, // Start with 0 received
            unitCost: item.costPrice,
            discount: item.discount || 0,
            tax: item.tax || 0,
            total: 0, // Will be calculated when quantity is entered
            purchaseTaxType: item.purchaseTaxType,
            unitAbbreviation: item.unitAbbreviation,
          };
        });
        
        if (DEBUG_MODE) {
          console.log('Converted GRN items:', grnItems);
        }
        
        setItems(grnItems);
        calculateTotals(grnItems);
        
        toast.success(`Loaded ${grnItems.length} items from purchase order`);
      } else {
        if (DEBUG_MODE) {
          console.log('No items found in purchase order or completePO is null');
        }
        setItems([]);
        calculateTotals([]);
        
        if (completePO) {
          toast.info("The selected purchase order has no items");
        }
      }
    } catch (error) {
      console.error('Error loading purchase order items:', error);
      toast.error(`Failed to load purchase order items: ${error.message}`);
      setItems([]);
      calculateTotals([]);
    }
  };

  // Auto-load PO items for newly selected PO (only for new GRNs)
  useEffect(() => {
    if (formData.purchaseOrderId && open && !grn) {
      handlePurchaseOrderSelect(formData.purchaseOrderId);
    }
  }, [formData.purchaseOrderId, open, grn]);

  useEffect(() => {
    if (open && grn) {
      // Always fetch complete data when editing, don't wait for products
      const fetchCompleteData = async () => {
        try {
          setDataLoading(true);
          if (DEBUG_MODE) {
            console.log('Fetching complete GRN data for ID:', grn.id);
          }
          const completeData = await getGoodReceiveNote(grn.id);
          if (DEBUG_MODE) {
            console.log('Complete GRN data received:', completeData);
            console.log('Items in complete data:', completeData?.items);
          }
          
          if (completeData && !completeData.error) {
            // Process items to ensure they have unit information and proper tax data
            const processedItems = (completeData.items || []).map((item, index) => {
              if (DEBUG_MODE) {
                console.log(`Processing GRN item ${index}:`, item);
                console.log(`GRN item ${index} tax data: tax=${item.tax}, discount=${item.discount}, purchaseTaxType=${item.purchaseTaxType}`);
              }
              // Find the product to get unit information and tax data
              const product = products.find(p => p.id === item.productId);
              
              // For Direct GRN, orderedQuantity should equal receivedQuantity since there's no separate PO
              const orderedQuantity = completeData.isDirect ? item.receivedQuantity : (item.orderedQuantity || 0);
              
              const processedItem = {
                ...item,
                orderedQuantity: orderedQuantity,
                unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || '',
                // Ensure tax data is available for display
                purchaseTaxType: item.purchaseTaxType || product?.purchase_tax_type || 'exclusive',
              };
              if (DEBUG_MODE) {
                console.log(`Processed GRN item ${index}:`, processedItem);
                console.log(`Processed GRN item ${index} tax data: tax=${processedItem.tax}, discount=${processedItem.discount}, purchaseTaxType=${processedItem.purchaseTaxType}`);
              }
              return processedItem;
            });
            
            if (DEBUG_MODE) {
              console.log('All processed items:', processedItems);
            }
            
            setFormData({
              ...completeData,
            });
            setItems(processedItems);
            
            // Set creation mode based on isDirect flag, with fallback to purchaseOrderId check
            if (completeData.isDirect) {
              setCreationMode('direct');
            } else if (completeData.purchaseOrderId) {
              setCreationMode('linked');
            } else {
              setCreationMode('direct'); // Default to direct if unclear
            }
            
            // If this is a linked GRN, also load the purchase order details
            if (completeData.purchaseOrderId) {
              try {
                const poData = await getPurchaseOrder(completeData.purchaseOrderId);
                if (poData) {
                  // Update the purchase orders list to include this PO if it's not already there
                  setPurchaseOrders(prev => {
                    const exists = prev.find(po => po.id === poData.id);
                    if (!exists) {
                      return [...prev, poData];
                    }
                    return prev;
                  });
                }
              } catch (error) {
                console.error('Error loading purchase order details:', error);
              }
            }
          } else {
            // Fallback to existing data
            const processedItems = (grn.items || []).map(item => {
              const product = products.find(p => p.id === item.productId);
              
              // For Direct GRN, orderedQuantity should equal receivedQuantity
              const orderedQuantity = grn.isDirect ? item.receivedQuantity : (item.orderedQuantity || 0);
              
              return {
                ...item,
                orderedQuantity: orderedQuantity,
                unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || '',
                purchaseTaxType: item.purchaseTaxType || product?.purchase_tax_type || 'exclusive',
              };
            });
            
            setFormData({
              ...grn,
            });
            setItems(processedItems);
            
            // Set creation mode based on isDirect flag
            if (grn.isDirect) {
              setCreationMode('direct');
            } else if (grn.purchaseOrderId) {
              setCreationMode('linked');
            } else {
              setCreationMode('direct');
            }
          }
        } catch (error) {
          console.error('Error fetching complete GRN data:', error);
          // Fallback to existing data
          const processedItems = (grn.items || []).map(item => {
            const product = products.find(p => p.id === item.productId);
            
            // For Direct GRN, orderedQuantity should equal receivedQuantity
            const orderedQuantity = grn.isDirect ? item.receivedQuantity : (item.orderedQuantity || 0);
            
            return {
              ...item,
              orderedQuantity: orderedQuantity,
              unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || '',
              purchaseTaxType: item.purchaseTaxType || product?.purchase_tax_type || 'exclusive',
            };
          });
          
          setFormData({
            ...grn,
          });
          setItems(processedItems);
          
          // Set creation mode based on isDirect flag
          if (grn.isDirect) {
            setCreationMode('direct');
          } else if (grn.purchaseOrderId) {
            setCreationMode('linked');
          } else {
            setCreationMode('direct');
          }
        } finally {
          setDataLoading(false);
        }
      };
      
      fetchCompleteData();
    } else if (open && !grn) {
        // Generate a new GRN number based on current date
        const today = new Date();
        const grnNumber = `GRN-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
        
      setFormData({
          grnNumber: grnNumber,
        purchaseOrderId: "",
        supplierId: "",
        receivedDate: new Date(),
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) as any,
          status: "draft",
        receivedBy: user?.id || "",
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0,
          notes: "",
          items: [],
      });
        setItems([]);
      }
  }, [grn, open]);

  // In edit mode, if linked to a PO and items are empty, auto-load PO items (mirror Sale Invoice behavior)
  useEffect(() => {
    if (!open || !grn) return;
    if (creationMode !== 'linked') return;
    if (!formData.purchaseOrderId) return;
    if (items.length > 0) return;

    const key = `${grn.id}|${formData.purchaseOrderId}`;
    if (lastAutoLoadKeyRef.current === key) return;
    lastAutoLoadKeyRef.current = key;
    handlePurchaseOrderSelect(formData.purchaseOrderId);
  }, [open, grn, creationMode, formData.purchaseOrderId, items.length]);

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
    console.log('DEBUG: handleProductSelect called with product:', product);
    console.log('DEBUG: Product serial numbers:', product._serialNumbers);
    console.log('DEBUG: Product is_serialized:', product.is_serialized);
    
    // Validate that product has required information
    // Note: product.purchase_tax.rate can be 0 (valid), so we check for undefined/null
    if (product?.purchase_tax?.rate === undefined || product?.purchase_tax?.rate === null) {
      toast.error(`Product ${product?.name} (${product?.sku_code}) is missing tax rate information. Please update the product.`);
      return;
    }
    
    if (!product?.purchase_tax_type) {
      toast.error(`Product ${product?.name} (${product?.sku_code}) is missing tax type information. Please update the product.`);
      return;
    }
    
    if (!product?.cost_price) {
      toast.error(`Product ${product?.name} (${product?.sku_code}) is missing cost price. Please update the product.`);
      return;
    }
    
    // Additional validation for product data integrity
    if (!product?.id || !product?.name || !product?.sku_code) {
      toast.error(`Product data is incomplete. Please try selecting the product again.`);
      return;
    }
    
    // Check if we're editing an existing item
    const editingIndex = sessionStorage.getItem('editingItemIndex');
    
    if (editingIndex !== null) {
      // Update existing item
      const index = parseInt(editingIndex);
      const newItems = [...items];
      const receivedQuantity = product._selectedQuantity ?? newItems[index].receivedQuantity ?? 1;
      const discount = (product._selectedDiscount ?? newItems[index].discount ?? 0) as number;
      const unitCost = product._selectedUnitPrice ?? product.cost_price;
      const calculatedTax = calculateTax(product, receivedQuantity, unitCost, discount);
      
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        unitCost: unitCost,
        purchaseTaxType: product.purchase_tax_type,
        eanCode: product.ean_code || newItems[index].eanCode,
        tax: calculatedTax,
        total: calculateTotal(product.purchase_tax_type, receivedQuantity, unitCost, discount, calculatedTax),
        unitAbbreviation: (product._selectedUnitLabel ?? (product.units?.abbreviation ?? '')),
      };
      if (product._serialNumbers) {
        (newItems[index] as any).serialNumbers = product._serialNumbers;
      }
      
      setItems(newItems);
      calculateTotals(newItems);
      sessionStorage.removeItem('editingItemIndex');
    } else {
      // Add new item
      const receivedQuantity = product._selectedQuantity ?? 1;
      const discount = Number((product as any)._selectedDiscount ?? 0);
      const unitCost = product._selectedUnitPrice ?? product.cost_price;
      const calculatedTax = calculateTax(product, receivedQuantity, unitCost, discount);
      
      const newItem = {
        id: `temp-${Date.now()}`,
        goodReceiveNoteId: "",
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        orderedQuantity: 0,
        receivedQuantity: receivedQuantity,
        unitCost: unitCost,
        discount: discount,
        tax: calculatedTax,
        total: calculateTotal(product.purchase_tax_type, receivedQuantity, unitCost, discount, calculatedTax),
        purchaseTaxType: product.purchase_tax_type,
        eanCode: product.ean_code,
        unitAbbreviation: (product._selectedUnitLabel ?? (product.units?.abbreviation ?? '')),
      };
      if (product._serialNumbers) {
        (newItem as any).serialNumbers = product._serialNumbers;
      }
      
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
        newItems[index].unitCost = product.cost_price;
        newItems[index].eanCode = product.ean_code || newItems[index].eanCode;
        newItems[index].unitAbbreviation = product.units?.abbreviation || '';
      }
    }
    
    // Recalculate item total and tax
    if (["receivedQuantity", "unitCost", "discount"].includes(field)) {
      const item = newItems[index];
      const receivedQuantity = Number(item.receivedQuantity) || 0;
      const unitCost = Number(item.unitCost) || 0;
      const discount = Number(item.discount) || 0;
      
      // Find the product to get its tax rate
      const product = products.find(p => p.id === item.productId);
      if (product) {
        try {
          const calculatedTax = calculateTax(product, receivedQuantity, unitCost, discount);
          newItems[index].tax = calculatedTax;
        } catch (error) {
          console.error('Tax calculation failed:', error);
          toast.error(`Tax calculation failed for ${product.name}: ${error.message}`);
          // Don't update the item if tax calculation fails, but don't crash the UI
          newItems[index].tax = 0;
        }
      } else {
        // If product not found, set tax to 0
        newItems[index].tax = 0;
      }
      
      const tax = Number(newItems[index].tax) || 0;
      const taxType = item.purchaseTaxType;
      const total = calculateTotal(taxType, receivedQuantity, unitCost, discount, tax);
      
      newItems[index].total = total;
    }
    
    setItems(newItems);
    calculateTotals(newItems);
  };
  
  const calculateTotals = (itemsList: Partial<GoodsReceiveNoteItem>[]) => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    
    itemsList.forEach(item => {
      const receivedQuantity = Number(item.receivedQuantity) || 0;
      const unitCost = Number(item.unitCost) || 0;
      const discount = Number(item.discount) || 0;
      const itemSubtotal = receivedQuantity * unitCost;
      
      subtotal += itemSubtotal;
      discountAmount += discount;
      
      // For tax calculation in GRN summary:
      // - Exclusive tax: Add the tax amount to the total
      // - Inclusive tax: Tax is already included in unit cost, so don't add it again
      if (item.purchaseTaxType === 'exclusive') {
        taxAmount += Number(item.tax) || 0;
      }
      // For inclusive tax, we don't add the tax amount because it's already included in the unit cost
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
      formData.grnNumber?.trim() &&
      formData.receivedDate &&
      // receivedBy is set server-side from token; do not block on UI
      items && items.length > 0
    );

    if (creationMode === 'linked') {
      return baseValidation && formData.purchaseOrderId?.trim();
    } else {
      return baseValidation && formData.supplierId?.trim() && (formData as any).deliveryDate;
    }
  };

  const handleSubmit = async (finalize?: boolean, statusOverride?: string) => {
    try {
      setLoading(true);
      
      // Validation checks
      const errors: string[] = [];
      
      // Check mandatory fields
      if (!formData.grnNumber?.trim()) {
        errors.push("GRN # is required");
      }
      
      if (creationMode === 'linked' && !formData.purchaseOrderId?.trim()) {
        errors.push("Purchase Order is required for linked GRN");
      }
      
      if (creationMode === 'direct' && !formData.supplierId?.trim()) {
        errors.push("Supplier is required for direct GRN");
      }

      if (creationMode === 'direct' && !(formData as any).deliveryDate) {
        errors.push("Delivery Date is required for direct GRN");
      }
      
      if (!formData.receivedDate) {
        errors.push("Received Date is required");
      }
      
      if (!(formData as any).vendorInvoiceNumber?.trim()) {
        errors.push("Supplier Invoice # is required");
      }
      
      // Received By is set automatically from signed-in user, no need to validate
      // if (!formData.receivedBy?.trim()) {
      //   errors.push("Received By is required");
      // }
      
      // Check if at least one item is added
      if (!items || items.length === 0) {
        errors.push("At least one item must be added to the GRN");
      } else {
        // Validate each item
        items.forEach((item, index) => {
          if (!item.productId || !item.productName) {
            errors.push(`Item ${index + 1}: Product is required`);
          }
          if (!item.receivedQuantity || item.receivedQuantity <= 0) {
            errors.push(`Item ${index + 1}: Received quantity must be greater than 0`);
          }

          // Serialized product constraints
          const product = products.find(p => p.id === item.productId);
          const isSerialized = !!product?.is_serialized;
          if (isSerialized) {
            // Force base unit by disallowing unitAbbreviation differing from base for serialized (UI ensures this via ProductSearchDialog; linked mode uses PO unit but received is in base)
            const requiredCount = Number(item.receivedQuantity || 0);
            const serials = ((item as any).serialNumbers || []).map((s: string) => (s || '').trim()).filter(Boolean);
            if (creationMode === 'linked') {
              if (serials.length !== requiredCount) {
                errors.push(`Item ${index + 1}: Serial # required (${requiredCount}). Provided: ${serials.length}.`);
              }
              // Duplicate check
              const set = new Set<string>();
              const dup = serials.find((s: string) => {
                if (set.has(s)) return true; set.add(s); return false;
              });
              if (dup) {
                errors.push(`Item ${index + 1}: Duplicate serial detected (${dup})`);
              }
            }
          }
        });
      }
      
      // If there are validation errors, show them and return
      if (errors.length > 0) {
        errors.forEach(msg => toast.error(msg));
        setLoading(false);
        return;
      }

      // Backend existence check to prevent duplicates against existing inventory
      for (let idx = 0; idx < items.length; idx += 1) {
        const item = items[idx];
        const product = products.find(p => p.id === item.productId);
        const isSerialized = !!product?.is_serialized;
        if (!isSerialized) continue;
        const serials: string[] = ((item as any).serialNumbers || []).map((s: string) => (s || '').trim()).filter(Boolean);
        if (serials.length === 0) continue;
        try {
          const res: any = await listSerials(item.productId);
          const rows = Array.isArray(res) ? res : (res?.data || []);
          const existing: Set<string> = new Set(
            rows.map((r: any) => r.serial_number || r.serialNumber || r.serial).filter(Boolean)
          );
          const conflict = serials.find(s => existing.has(s));
          if (conflict) {
            toast.error(`Item ${idx + 1}: Serial '${conflict}' already exists for this product`);
            setLoading(false);
            return;
          }
        } catch (e) {
          toast.error(`Item ${idx + 1}: Failed to validate serials against inventory`);
          setLoading(false);
          return;
        }
      }
    
      const grnData = {
        ...formData,
        status: statusOverride || (finalize ? "completed" : (formData.status || "draft")),
        isDirect: creationMode === 'direct', // Set isDirect flag based on creation mode
        items: items
      } as Partial<GoodsReceiveNote>;
      
      onSave(grnData);
      
      toast.success(`GRN ${formData.grnNumber} has been ${finalize ? 'completed' : (grn ? 'updated' : 'saved as draft')} successfully.`);
    
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving GRN:', error);
      toast.error("Failed to save GRN");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
          <DialogTitle>
            {grn ? "Edit GRN" : "Create GRN"}
          </DialogTitle>
          </DialogHeader>
          
        {dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading GRN data...</p>
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
                  disabled={grn?.id !== undefined} // Only disable if editing existing GRN
                >
                  <Link className="h-4 w-4" />
                  Against Purchase Order
                </Button>
                <Button
                  type="button"
                  variant={creationMode === 'direct' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModeChange('direct')}
                  className="flex items-center gap-2"
                  disabled={grn?.id !== undefined} // Only disable if editing existing GRN
                >
                  <Unlink className="h-4 w-4" />
                  Direct GRN (Auto PO)
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {grn?.id ? 
                  'Creation mode cannot be changed for existing GRNs' :
                  creationMode === 'linked' 
                    ? 'Create GRN against an existing approved Purchase Order'
                    : 'Create GRN directly - a Purchase Order will be generated automatically'
                }
              </p>
            </div>

            {/* TOP SECTION - GRN Details */}
            <div className={`grid gap-4 pt-4 ${creationMode === 'direct' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-7' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'}`}>
              <div>
                <Label htmlFor="grnNumber" className="text-sm font-medium text-gray-700">
                  GRN # <span className="text-red-500">*</span>
                </Label>
              <Input
                id="grnNumber"
                name="grnNumber"
                value={formData.grnNumber}
                onChange={handleInputChange}
                  className="mt-1 bg-gray-50 font-mono text-sm"
                  disabled
                  title="GRN number is auto-generated and cannot be changed"
              />
            </div>
            
              {creationMode === 'linked' ? (
                <>
                  <div>
                    <Label htmlFor="purchaseOrderId" className="text-sm font-medium text-gray-700">
                      Purchase Order <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.purchaseOrderId}
                      onValueChange={(value) => handleSelectChange("purchaseOrderId", value)}
                      disabled={grn?.id !== undefined} // Only disable if editing existing GRN
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select purchase order" />
                      </SelectTrigger>
                      <SelectContent>
                        {purchaseOrders.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.orderNumber} - {po.supplier?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="orderedDate" className="text-sm font-medium text-gray-700">
                      Ordered Date
                    </Label>
              <Input
                      id="orderedDate"
                      value={(() => {
                        const selectedPO = purchaseOrders.find(po => po.id === formData.purchaseOrderId);
                        return selectedPO?.orderDate ? format(new Date(selectedPO.orderDate), "PPP") : 'N/A';
                      })()}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="supplierId" className="text-sm font-medium text-gray-700">
                    Supplier <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => handleSelectChange("supplierId", value)}
                    disabled={grn?.id !== undefined} // Only disable if editing existing GRN
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
              )}
            
              <div>
                <Label htmlFor="receivedDate" className="text-sm font-medium text-gray-700">
                  Invoice Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.receivedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.receivedDate ? format(formData.receivedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.receivedDate}
                      onSelect={(date) => handleDateChange("receivedDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label htmlFor="vendorInvoiceNumber" className="text-sm font-medium text-gray-700">
                  Supplier Invoice # <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="vendorInvoiceNumber"
                  name="vendorInvoiceNumber"
                  value={(formData as any).vendorInvoiceNumber || ""}
                  onChange={handleInputChange}
                  placeholder="e.g., INV-12345"
                  className="mt-1"
                />
              </div>

              {/* Delivery Date field - only for Direct mode */}
              {creationMode === 'direct' && (
                <div>
                  <Label htmlFor="deliveryDate" className="text-sm font-medium text-gray-700">
                    Delivery Date <span className="text-red-500">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full mt-1 justify-start text-left font-normal",
                          !(formData as any).deliveryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {(formData as any).deliveryDate ? format((formData as any).deliveryDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                      <Calendar
                        mode="single"
                        selected={(formData as any).deliveryDate}
                        onSelect={(date) => handleDateChange("deliveryDate", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
            </div>
              )}
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Input value={formData.status ? (formData.status.charAt(0).toUpperCase() + formData.status.slice(1)) : 'Draft'} className="mt-1 bg-gray-50" disabled />
              </div>
            
              {false && (
              <div>
                <Label htmlFor="receivedBy" className="text-sm font-medium text-gray-700">
                  Received By <span className="text-red-500">*</span>
                </Label>
                  <Input id="receivedBy" value={(formData as any).receivedByUser?.full_name || user?.fullName || ""} className="mt-1 bg-gray-50" disabled />
              </div>
              )}
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
                    Items are loaded from Purchase Order - click the search icon to edit details and add serial numbers
                  </div>
                )}
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-medium text-gray-700">Product</TableHead>
                      <TableHead className="font-medium text-gray-700">SKU</TableHead>
                      <TableHead className="font-medium text-gray-700">HSN</TableHead>
                      {creationMode === 'linked' && (
                        <TableHead className="font-medium text-gray-700">Ordered</TableHead>
                      )}
                      <TableHead className="font-medium text-gray-700">Received</TableHead>
                      <TableHead className="font-medium text-gray-700">Unit Cost</TableHead>
                      <TableHead className="font-medium text-gray-700">Discount</TableHead>
                      <TableHead className="font-medium text-gray-700">Tax</TableHead>
                      <TableHead className="font-medium text-gray-700">Batch #</TableHead>
                      <TableHead className="font-medium text-gray-700">Serial #</TableHead>
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
                                  title={'Edit item'}
                                >
                                  <Search className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.skuCode || '-'}</TableCell>
                          <TableCell className="font-mono text-sm">{item.hsnCode || '-'}</TableCell>
                          {creationMode === 'linked' && (
                            <TableCell className="text-center">
                              <span className="text-sm font-medium">{item.orderedQuantity || 0}</span>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={creationMode === 'linked' ? item.orderedQuantity : undefined}
                                value={item.receivedQuantity}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  let safe = isNaN(v) ? 0 : Math.max(0, v);
                                  
                                  // In linked mode, don't allow received quantity to exceed ordered quantity
                                  if (creationMode === 'linked' && item.orderedQuantity) {
                                    safe = Math.min(safe, item.orderedQuantity);
                                  }
                                  
                                  handleItemChange(index, "receivedQuantity", safe);
                                }}
                                className="w-16"
                                disabled={creationMode === 'linked' && false}
                                title={creationMode === 'linked' ? `Cannot exceed ordered quantity (${item.orderedQuantity})` : ""}
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
                              value={item.unitCost}
                              onChange={(e) => 
                                handleItemChange(index, "unitCost", parseFloat(e.target.value) || 0)
                              }
                              className="w-24 bg-gray-50"
                              disabled
                              title="Unit cost is set from product data and cannot be changed"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.discount}
                              onChange={() => {}}
                              className="w-20 bg-gray-50"
                              disabled
                              title="Discount is set in the product configuration and cannot be changed here"
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
                          <TableCell>
                            <Input
                              value={item.batchNumber || ""}
                              onChange={(e) => {
                                // Allow only alphanumeric characters
                                const alphanumericValue = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                                handleItemChange(index, "batchNumber", alphanumericValue);
                              }}
                              placeholder="Batch"
                              className="w-28"
                              title="Only alphanumeric characters allowed"
                            />
                          </TableCell>
                          
                          <TableCell className="text-sm">
                            {(() => {
                              const product = products.find(p => p.id === item.productId);
                              const isSerialized = !!product?.is_serialized;
                              if (!isSerialized) {
                                return <span className="text-xs text-gray-400">N/A</span>;
                              }
                              // For linked GRN, allow inline per-unit serial entry
                              if (creationMode === 'linked') {
                                const count = Number(item.receivedQuantity || 0);
                                const serials = Array.from({ length: count }, (_, i) => (item as any).serialNumbers?.[i] || '');
                                const dupes = new Set<string>();
                                const duplicates: Record<number, boolean> = {};
                                serials.forEach((s, i) => {
                                  const key = (s || '').trim();
                                  if (!key) return;
                                  if (dupes.has(key)) duplicates[i] = true; else dupes.add(key);
                                });
                                return (
                                  <div className="flex flex-col gap-1">
                                    {serials.length === 0 && (
                                      <span className="text-xs text-gray-400">Enter {count} serial{count === 1 ? '' : 's'}</span>
                                    )}
                                    {serials.map((val, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-6">{i + 1}.</span>
                                        <Input
                                          value={val}
                                          placeholder="#"
                                          onChange={(e) => {
                                            // Alphanumeric only
                                            const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                                            const updated = [...items];
                                            const arr = [ ...(((updated[index] as any).serialNumbers) || []) ];
                                            arr[i] = cleaned;
                                            (updated[index] as any).serialNumbers = arr;
                                            setItems(updated);
                                          }}
                                          className={`h-7 text-xs ${duplicates[i] ? 'border-red-500' : ''}`}
                                        />
                                      </div>
                                    ))}
                                    {serials.length > 0 && Object.keys(duplicates).length > 0 && (
                                      <div className="text-xs text-red-600">Duplicate serials detected</div>
                                    )}
                                  </div>
                                );
                              }
                              // Direct GRN: show a compact preview (serials supplied via dialog)
                              return (
                                <div className="max-w-32">
                                  {(item as any).serialNumbers && (item as any).serialNumbers.length > 0 ? (
                                    <>
                                      <div className="text-xs text-gray-600 mb-1">
                                        {(item as any).serialNumbers.length} serials
                                      </div>
                                      <div className="text-xs font-mono bg-gray-100 p-1 rounded truncate" title={(item as any).serialNumbers?.join(', ')}>
                                        {(item as any).serialNumbers?.slice(0, 2).join(', ')}
                                        {(item as any).serialNumbers?.length > 2 && '...'}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-400">No serials</span>
                                  )}
                                </div>
                              );
                            })()}
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
                          <TableCell colSpan={creationMode === 'linked' ? 10 : 11} className="text-center py-8 text-gray-500">
                            {creationMode === 'linked' 
                              ? 'No items found in the selected Purchase Order.'
                              : 'No items added. Click "Add Item" to add products to this GRN.'
                            }
                          </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* BOTTOM SECTION - Notes and GRN Summary Side by Side */}
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
                  
              {/* RIGHT - GRN Summary */}
              <div className="flex justify-end">
                <div className="bg-gray-50 rounded-lg p-6 min-w-[300px]">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">GRN Summary</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-mono font-medium">{formatCurrency(formData.subtotal || 0, currency)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Discount:</span>
                      <span className="font-mono font-medium text-red-600">{formatCurrency((formData as any).discountAmount || 0, currency)}</span>
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
                {loading ? "Saving..." : (grn ? "Update Draft" : "Save Draft")}
            </Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading || !isFormValid()}>
                {loading ? "Saving..." : (grn ? "Mark Complete" : "Complete GRN")}
              </Button>
              <Button variant="destructive" onClick={() => handleSubmit(false, 'rejected')} disabled={loading || !grn}>
                {loading ? "Saving..." : "Mark Rejected"}
              </Button>
          </DialogFooter>
          </>
        )}
      </DialogContent>
      
      {/* Product Search Dialog */}
      <ProductSearchDialog
        open={showProductSearch}
        onOpenChange={(open) => {
          console.log('DEBUG: ProductSearchDialog onOpenChange called with:', open);
          setShowProductSearch(open);
        }}
        products={products}
        onProductSelect={handleProductSelect}
        recentProducts={recentProducts}
        mode="purchase"
        context="receiving"
      />
    </Dialog>
  );
};
