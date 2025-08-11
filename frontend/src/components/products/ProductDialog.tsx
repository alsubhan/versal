import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { type Category } from "@/types/category";
import { type Tax } from "@/types/tax";
import { type Unit } from "@/types/unit";
import { type Supplier } from "@/types/supplier";
import { createProduct, updateProduct, apiFetch } from '@/lib/api';
import { toast } from "sonner";
import { UnitConversionEditor } from './UnitConversionEditor';

// Define the Product interface to match the expected format
interface Product {
  id: string;
  sku_code: string;
  hsn_code: string;
  name: string;
  description?: string;
  barcode?: string;
  category_id?: string;
  unit_id?: string;
  cost_price?: number;
  selling_price?: number;
  sale_price?: number;
  supplier_id?: string;
  sale_tax_id?: string;
  sale_tax_type?: string;
  purchase_tax_id?: string;
  purchase_tax_type?: string;
  manufacturer?: string;
  brand?: string;
  manufacturer_part_number?: string;
  warranty_period?: number;
  warranty_unit?: string;
  product_tags?: string[];
  is_serialized?: boolean;
  track_inventory?: boolean;
  allow_override_price?: boolean;
  discount_percentage?: number;
  warehouse_rack?: string;
  unit_conversions?: any;
  is_active?: boolean;
  minimum_stock?: number;
  maximum_stock?: number;
  reorder_point?: number;
  mrp?: number;
  initial_quantity?: number;
  subcategory_id?: string;
  stock_levels?: Array<{ quantity_on_hand: number; quantity_available: number }> | { quantity_on_hand: number; quantity_available: number };
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSuccess?: () => void;
}

export const ProductDialog: React.FC<ProductDialogProps> = ({ open, onOpenChange, product, onSuccess }) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [availableSubcategories, setAvailableSubcategories] = useState<Array<Category>>([]);
  const { currency } = useCurrencyStore();
  

  
  // State for API data
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, Category[]>>({});
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    skuCode: '',
    hsnCode: '',
    eanCode: '',
    name: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    supplierId: '',
    costPrice: '',
    mrp: '',
    retailPrice: '',
    salePrice: '',
    discount: '',
    saleTaxId: '',
    saleTaxType: 'exclusive',
    purchaseTaxId: '',
    purchaseTaxType: 'exclusive',
    unitId: '',
    initialQty: '',
    warehouseRack: '',
    reorderLevel: '',
    brand: '',
    manufacturer: '',
    manufacturerPartNumber: '',
    warrantyPeriod: '',
    warrantyUnit: 'days',
    productTags: '',
    isSerialized: false,
    trackInventory: true,
    allowOverridePrice: false,
    isActive: true,
    unitConversions: ''
  });

  // Function to populate form data
  const populateFormData = () => {
    if (product) {
      // Debug: Log the product data to see what we're receiving
      console.log('Product data received:', product);
      console.log('Stock levels:', product.stock_levels);
      console.log('Minimum stock:', product.minimum_stock);
      console.log('Reorder point:', product.reorder_point, '(type:', typeof product.reorder_point, ')');
      console.log('Unit conversions:', product.unit_conversions);

      
      // Handle stock_levels - ensure it's an array
      let stockLevels = product.stock_levels;
      if (stockLevels && !Array.isArray(stockLevels)) {
          stockLevels = [stockLevels];
      } else if (!stockLevels) {
          stockLevels = [];
      }
      
      console.log('Processed stock levels:', stockLevels);
      
      // Edit mode - populate form with product data
      setFormData({
        skuCode: product.sku_code || '',
        hsnCode: product.hsn_code || '',
        eanCode: product.barcode || '',
        name: product.name || '',
        description: product.description || '',
        categoryId: product.category_id || '',
        subcategoryId: product.subcategory_id || '',
        supplierId: product.supplier_id || '',
        costPrice: product.cost_price?.toString() || '',
        mrp: product.mrp?.toString() || '',
        retailPrice: product.selling_price?.toString() || '',
        salePrice: product.sale_price?.toString() || '',
        discount: product.discount_percentage?.toString() || '',
        saleTaxId: product.sale_tax_id || '',
        saleTaxType: product.sale_tax_type || 'exclusive',
        purchaseTaxId: product.purchase_tax_id || '',
        purchaseTaxType: product.purchase_tax_type || 'exclusive',
        unitId: product.unit_id || '',
        initialQty: product.initial_quantity?.toString() || stockLevels?.[0]?.quantity_on_hand?.toString() || '',
        warehouseRack: product.warehouse_rack || '',
        reorderLevel: (product.reorder_point !== null && product.reorder_point !== undefined) ? product.reorder_point.toString() : (product.minimum_stock !== null && product.minimum_stock !== undefined) ? product.minimum_stock.toString() : '',
        brand: product.brand || '',
        manufacturer: product.manufacturer || '',
        manufacturerPartNumber: product.manufacturer_part_number || '',
        warrantyPeriod: product.warranty_period?.toString() || '',
        warrantyUnit: product.warranty_unit || 'days',
        productTags: product.product_tags?.join(', ') || '',
        isSerialized: product.is_serialized || false,
        trackInventory: product.track_inventory ?? true,
        allowOverridePrice: product.allow_override_price || false,
        isActive: product.is_active ?? true,
        unitConversions: product.unit_conversions ? JSON.stringify(product.unit_conversions) : ''
      });

      setSelectedCategory(product.category_id || '');
    } else {
      // Add mode - reset form
      setFormData({
        skuCode: '',
        hsnCode: '',
        eanCode: '',
        name: '',
        description: '',
        categoryId: '',
        subcategoryId: '',
        supplierId: '',
        costPrice: '',
        mrp: '',
        retailPrice: '',
        salePrice: '',
        discount: '',
        saleTaxId: '',
        saleTaxType: 'exclusive',
        purchaseTaxId: '',
        purchaseTaxType: 'exclusive',
        unitId: '',
        initialQty: '',
        warehouseRack: '',
        reorderLevel: '',
        brand: '',
        manufacturer: '',
        manufacturerPartNumber: '',
        warrantyPeriod: '',
        warrantyUnit: 'days',
        productTags: '',
        isSerialized: false,
        trackInventory: true,
        allowOverridePrice: false,
        isActive: true,
        unitConversions: ''
      });
      setSelectedCategory('');
    }
  };

  // Reset form when dialog opens/closes or product changes
  useEffect(() => {
    if (open) {
      populateFormData();
    }
  }, [open, product]);

  // Handle form input changes
  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle input validation for specific fields
  const handleValidatedInputChange = (field: string, value: string) => {
    let validatedValue = value;
    
    switch (field) {
      case 'skuCode':
        // Allow only alphanumeric characters and remove spaces
        validatedValue = value.replace(/[^a-zA-Z0-9]/g, '');
        break;
      case 'hsnCode':
        // Allow only numeric characters
        validatedValue = value.replace(/[^0-9]/g, '');
        break;
      case 'eanCode':
        // Allow only numeric characters
        validatedValue = value.replace(/[^0-9]/g, '');
        break;
      default:
        validatedValue = value;
    }
    
    setFormData(prev => ({ ...prev, [field]: validatedValue }));
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate required fields
      if (!formData.skuCode || !formData.hsnCode || !formData.name || !formData.supplierId || 
          !formData.saleTaxId || !formData.purchaseTaxId) {
        setError('Please fill in all required fields');
        return;
      }

      // Prepare product data
      console.log('Form data being submitted:', formData);
      const productData = {
        name: formData.name,
        description: formData.description,
        skuCode: formData.skuCode,
        hsnCode: formData.hsnCode,
        eanCode: formData.eanCode,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || null,
        unitId: formData.unitId,
        costPrice: parseFloat(formData.costPrice) || 0,
        retailPrice: parseFloat(formData.retailPrice) || 0,
        salePrice: parseFloat(formData.salePrice) || 0,
        mrp: parseFloat(formData.mrp) || null,
        minimumStock: parseInt(formData.reorderLevel) || 0,
        maximumStock: null,
        reorderLevel: parseInt(formData.reorderLevel) || 0,
        isActive: formData.isActive,
        supplierId: formData.supplierId,
        saleTaxId: formData.saleTaxId,
        saleTaxType: formData.saleTaxType,
        purchaseTaxId: formData.purchaseTaxId,
        purchaseTaxType: formData.purchaseTaxType,
        manufacturer: formData.manufacturer,
        brand: formData.brand,
        manufacturerPartNumber: formData.manufacturerPartNumber,
        warrantyPeriod: parseInt(formData.warrantyPeriod) || null,
        warrantyUnit: formData.warrantyUnit,
        productTags: formData.productTags ? formData.productTags.split(',').map(tag => tag.trim()) : [],
        isSerialized: formData.isSerialized,
        trackInventory: formData.trackInventory,
        allowOverridePrice: formData.allowOverridePrice,
        discountPercentage: parseFloat(formData.discount) || 0,
        warehouseRack: formData.warehouseRack,
        unitConversions: formData.unitConversions ? JSON.parse(formData.unitConversions) : null,
        initialQty: parseInt(formData.initialQty) || 0
      };
      
      console.log('Product data being sent to backend:', productData);

      if (product) {
        // Update existing product
        await updateProduct(product.id, productData);
        toast.success('Product updated successfully');
      } else {
        // Create new product
        await createProduct(productData);
        toast.success('Product created successfully');
      }

      onOpenChange(false);
      // Call onSuccess callback to refresh the table
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error saving product:', err);
      setError(err.message || 'Failed to save product');
      toast.error(err.message || 'Failed to save product');
      // Don't close dialog or refresh on error
      return;
    } finally {
      setIsSaving(false);
    }
  };
  
  // Fetch data from APIs
  const fetchCategories = async () => {
    try {
      const data = await apiFetch('/categories');
      if (data && Array.isArray(data)) {
        setCategories(data);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError('Failed to fetch categories');
    }
  };

  const fetchSubcategories = async () => {
    try {
      // Fetch categories that have parent_id (subcategories)
      const data = await apiFetch('/categories');
      if (data && Array.isArray(data)) {
        const subcats: Record<string, Category[]> = {};
        data.forEach(category => {
          if (category.parentId) {
            if (!subcats[category.parentId]) {
              subcats[category.parentId] = [];
            }
            subcats[category.parentId].push(category);
          }
        });
        setSubcategories(subcats);
      }
    } catch (err: any) {
      console.error('Error fetching subcategories:', err);
    }
  };

  const fetchTaxes = async () => {
    try {
      const data = await apiFetch('/taxes');
      if (data && Array.isArray(data)) {
        setTaxes(data);
      }
    } catch (err: any) {
      console.error('Error fetching taxes:', err);
      setError('Failed to fetch taxes');
    }
  };

  const fetchUnits = async () => {
    try {
      const data = await apiFetch('/units');
      if (data && Array.isArray(data)) {
        setUnits(data);
      }
    } catch (err: any) {
      console.error('Error fetching units:', err);
      setError('Failed to fetch units');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const data = await apiFetch('/suppliers');
      if (data && Array.isArray(data)) {
        setSuppliers(data);
      }
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
      setError('Failed to fetch suppliers');
    }
  };

  // Helper function to fetch stock levels for a product
  const fetchStockLevels = async (productId: string) => {
    try {
      const data = await apiFetch(`/inventory/stock-levels?product_id=${productId}`);
      if (data && Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return null;
    } catch (err: any) {
      console.error('Error fetching stock levels:', err);
      return null;
    }
  };

  // Load all data when component mounts
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      
      Promise.all([
        fetchCategories(),
        fetchSubcategories(),
        fetchTaxes(),
        fetchUnits(),
        fetchSuppliers()
      ]).then(() => {
        // After all data is loaded, repopulate form data if editing a product
        if (product) {
          populateFormData();
        }
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [open, product]);
  
  // Update subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      setAvailableSubcategories(subcategories[selectedCategory] || []);
    } else {
      setAvailableSubcategories([]);
    }
  }, [selectedCategory, subcategories]);

  // Fetch stock levels if missing when editing a product
  useEffect(() => {
    const fetchMissingStockLevels = async () => {
      if (product && product.id && (!product.stock_levels || (Array.isArray(product.stock_levels) && product.stock_levels.length === 0))) {
        console.log('Stock levels missing, fetching separately...');
        const stockData = await fetchStockLevels(product.id);
        if (stockData) {
          console.log('Fetched stock levels:', stockData);
          // Update the form with the fetched stock data
          setFormData(prev => ({
            ...prev,
            initialQty: stockData.quantity_on_hand?.toString() || ''
          }));
        }
      }
    };

    fetchMissingStockLevels();
  }, [product]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {product 
              ? "Edit the details of this product."
              : "Create a new product in your inventory. Fill in all required fields."}
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading product data...</p>
            </div>
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="other">Other Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="skuCode">SKU Code *</Label>
                    <Input 
                      id="skuCode" 
                      placeholder="PRD001" 
                      value={formData.skuCode}
                      onChange={(e) => handleValidatedInputChange('skuCode', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Alphanumeric characters only, no spaces</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="hsnCode">HSN Code *</Label>
                    <Input 
                      id="hsnCode" 
                      placeholder="123456" 
                      maxLength={6}
                      pattern="[0-9]{6}"
                      title="HSN Code must be exactly 6 digits"
                      value={formData.hsnCode}
                      onChange={(e) => handleValidatedInputChange('hsnCode', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Numeric characters only (6 digits)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="eanCode">EAN Code</Label>
                    <Input 
                      id="eanCode" 
                      placeholder="123456789012" 
                      value={formData.eanCode}
                      onChange={(e) => handleValidatedInputChange('eanCode', e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Numeric characters only</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name">SKU Name *</Label>
                  <Input 
                    id="name" 
                    placeholder="Product name" 
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select 
                      value={formData.categoryId} 
                      onValueChange={(value) => {
                        handleInputChange('categoryId', value);
                        setSelectedCategory(value);
                      }}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder={categories.length > 0 ? "Select category" : "Loading categories..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select 
                      value={formData.subcategoryId}
                      onValueChange={(value) => handleInputChange('subcategoryId', value)}
                      disabled={!selectedCategory}
                    >
                      <SelectTrigger id="subcategory">
                        <SelectValue placeholder={selectedCategory ? "Select subcategory" : "Select a category first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubcategories.map(subcategory => (
                          <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Short description of the product"
                    className="min-h-20"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier/Vendor *</Label>
                  <Select 
                    value={formData.supplierId}
                    onValueChange={(value) => handleInputChange('supplierId', value)}
                  >
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder={suppliers.length > 0 ? "Select supplier" : "Loading suppliers..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.supplierId && (
                    <p className="text-xs text-gray-500">
                      Selected: {suppliers.find(s => s.id === formData.supplierId)?.name || 'Unknown'}
                    </p>
                  )}
                </div>
              </TabsContent>
          
                        <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price *</Label>
                <Input 
                  id="costPrice" 
                  type="number" 
                  placeholder="0.00" 
                  value={formData.costPrice}
                  onChange={(e) => handleInputChange('costPrice', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="salePrice">Sale Price *</Label>
                <Input 
                  id="salePrice" 
                  type="number" 
                  placeholder="0.00" 
                  value={formData.salePrice}
                  onChange={(e) => handleInputChange('salePrice', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="retailPrice">Retail Price *</Label>
                <Input 
                  id="retailPrice" 
                  type="number" 
                  placeholder="0.00" 
                  value={formData.retailPrice}
                  onChange={(e) => handleInputChange('retailPrice', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mrp">MRP *</Label>
                <Input 
                  id="mrp" 
                  type="number" 
                  placeholder="0.00" 
                  value={formData.mrp}
                  onChange={(e) => handleInputChange('mrp', e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="saleTax" className="flex items-center justify-between">
                  Sale Tax *
                  <span className="text-xs text-gray-500">
                    ({formatCurrency(0, currency)})
                  </span>
                </Label>
                <div className="space-y-2">
                  <Select 
                    value={formData.saleTaxId}
                    onValueChange={(value) => handleInputChange('saleTaxId', value)}
                  >
                    <SelectTrigger id="saleTax">
                      <SelectValue placeholder={taxes.length > 0 ? "Select tax" : "Loading taxes..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {taxes.map(tax => (
                        <SelectItem key={tax.id} value={tax.id}>{tax.name} ({tax.rate}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.saleTaxId && (
                    <p className="text-xs text-gray-500">
                      Selected: {taxes.find(t => t.id === formData.saleTaxId)?.name || 'Unknown'}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 pt-2">
                    <Label className="text-sm font-normal">Tax Type:</Label>
                    <RadioGroup 
                      value={formData.saleTaxType} 
                      onValueChange={(value) => handleInputChange('saleTaxType', value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="inclusive" id="saleTaxInclusive" />
                        <Label htmlFor="saleTaxInclusive" className="font-normal">Inclusive</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="exclusive" id="saleTaxExclusive" />
                        <Label htmlFor="saleTaxExclusive" className="font-normal">Exclusive</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="purchaseTax" className="flex items-center justify-between">
                  Purchase Tax *
                  <span className="text-xs text-gray-500">
                    ({formatCurrency(0, currency)})
                  </span>
                </Label>
                <div className="space-y-2">
                  <Select 
                    value={formData.purchaseTaxId}
                    onValueChange={(value) => handleInputChange('purchaseTaxId', value)}
                  >
                    <SelectTrigger id="purchaseTax">
                      <SelectValue placeholder={taxes.length > 0 ? "Select tax" : "Loading taxes..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {taxes.map(tax => (
                        <SelectItem key={tax.id} value={tax.id}>{tax.name} ({tax.rate}%)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.purchaseTaxId && (
                    <p className="text-xs text-gray-500">
                      Selected: {taxes.find(t => t.id === formData.purchaseTaxId)?.name || 'Unknown'}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 pt-2">
                    <Label className="text-sm font-normal">Tax Type:</Label>
                    <RadioGroup 
                      value={formData.purchaseTaxType} 
                      onValueChange={(value) => handleInputChange('purchaseTaxType', value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="inclusive" id="purchaseTaxInclusive" />
                        <Label htmlFor="purchaseTaxInclusive" className="font-normal">Inclusive</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="exclusive" id="purchaseTaxExclusive" />
                        <Label htmlFor="purchaseTaxExclusive" className="font-normal">Exclusive</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="discount">Discount %</Label>
              <Input 
                id="discount" 
                type="number" 
                placeholder="0" 
                value={formData.discount}
                onChange={(e) => handleInputChange('discount', e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="overridePrice" 
                checked={formData.allowOverridePrice}
                onCheckedChange={(checked) => handleInputChange('allowOverridePrice', checked as boolean)}
              />
              <Label htmlFor="overridePrice">Allow Override Price (while selling)</Label>
            </div>
          </TabsContent>
          
              <TabsContent value="inventory" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                                                      <div className="space-y-2">
                    <Label htmlFor="unit">Unit *</Label>
                    <Select 
                      value={formData.unitId}
                      onValueChange={(value) => handleInputChange('unitId', value)}
                    >
                      <SelectTrigger id="unit">
                        <SelectValue placeholder={units.length > 0 ? "Select unit" : "Loading units..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.abbreviation})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                                    <div className="space-y-2">
                    <Label htmlFor="initialQty">
                      {product ? "Initial Quantity (Read-only)" : "Initial Quantity *"}
                    </Label>
                        <Input 
                          id="initialQty" 
                          type="number" 
                          placeholder="0" 
                          value={formData.initialQty}
                          onChange={(e) => handleInputChange('initialQty', e.target.value)}
                          disabled={!!product} // Disable in edit mode
                        />
                        {product && (
                          <p className="text-xs text-muted-foreground">
                            Stock quantities can be managed through the Inventory module
                          </p>
                        )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="warehouseRack">Warehouse Rack</Label>
                    <Input 
                      id="warehouseRack" 
                      placeholder="A1-01" 
                      value={formData.warehouseRack}
                      onChange={(e) => handleInputChange('warehouseRack', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reorderLevel">Reorder Level</Label>
                    <Input 
                      id="reorderLevel" 
                      type="number" 
                      placeholder="10" 
                      value={formData.reorderLevel}
                      onChange={(e) => handleInputChange('reorderLevel', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <UnitConversionEditor
                    value={formData.unitConversions}
                    onChange={(value) => handleInputChange('unitConversions', value)}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="serialized" 
                    checked={formData.isSerialized}
                    onCheckedChange={(checked) => handleInputChange('isSerialized', checked as boolean)}
                  />
                  <Label htmlFor="serialized">Serialized Product (Track each item separately)</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="trackInventory" 
                    checked={formData.trackInventory}
                    onCheckedChange={(checked) => handleInputChange('trackInventory', checked as boolean)}
                  />
                  <Label htmlFor="trackInventory">Track Inventory</Label>
                </div>
              </TabsContent>
          
              <TabsContent value="other" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input 
                    id="brand" 
                    placeholder="Product brand" 
                    value={formData.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input 
                    id="manufacturer" 
                    placeholder="Manufacturer name" 
                    value={formData.manufacturer}
                    onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manufacturerPartNumber">Manufacturer Part Number (MPN)</Label>
                  <Input 
                    id="manufacturerPartNumber" 
                    placeholder="MPN-123456" 
                    value={formData.manufacturerPartNumber}
                    onChange={(e) => handleInputChange('manufacturerPartNumber', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="warrantyPeriod">Warranty Period</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="warrantyPeriod" 
                      type="number" 
                      placeholder="0" 
                      value={formData.warrantyPeriod}
                      onChange={(e) => handleInputChange('warrantyPeriod', e.target.value)}
                    />
                    <Select 
                      value={formData.warrantyUnit}
                      onValueChange={(value) => handleInputChange('warrantyUnit', value)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                        <SelectItem value="years">Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="productTags" className="flex justify-between">
                    Tags
                    <span className="text-xs text-gray-500 font-normal">
                      (For searching and filtering products)
                    </span>
                  </Label>
                  <Input 
                    id="productTags" 
                    placeholder="Enter tags, separated by commas" 
                    value={formData.productTags}
                    onChange={(e) => handleInputChange('productTags', e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tags help in searching and filtering products. Example: premium, imported, seasonal
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="isActive" 
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleInputChange('isActive', checked as boolean)}
                  />
                  <Label htmlFor="isActive">Product Active</Label>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? 'Saving...' : (product ? "Save Changes" : "Save Product")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
