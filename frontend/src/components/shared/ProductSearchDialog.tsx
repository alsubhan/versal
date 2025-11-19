import { useState, useEffect, useRef } from "react";
import { Search, Camera, X, Plus, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { lookupSerial, listSerials } from "@/lib/api";
import { useCurrencyStore } from "@/stores/currencyStore";

interface Product {
  id: string;
  name: string;
  sku_code: string;
  hsn_code: string;
  barcode: string;
  cost_price: number;
  sale_price: number;
  mrp?: number;
  purchase_tax_type?: 'inclusive' | 'exclusive';
  sale_tax_type?: 'inclusive' | 'exclusive';
  allow_override_price?: boolean;
  is_serialized?: boolean;
  unit_conversions?: Record<string, number> | string | null;
  purchase_tax?: {
    id: string;
    name: string;
    rate: number;
  };
  sale_tax?: {
    id: string;
    name: string;
    rate: number;
  };
  units?: {
    name: string;
    abbreviation: string;
  };
  category?: {
    name: string;
  };
  // Enriched fields produced by this dialog for consumers
  _selectedQuantity?: number;
  _selectedUnitLabel?: string;
  _selectedUnitMultiplier?: number;
  _selectedUnitPrice?: number;
  _serialNumbers?: string[];
}

interface ProductSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onProductSelect: (product: Product) => void;
  recentProducts?: Product[];
  mode?: 'purchase' | 'sale';
  context?: 'planning' | 'receiving' | 'selling'; // New prop to distinguish context
}

export const ProductSearchDialog = ({ 
  open, 
  onOpenChange, 
  products, 
  onProductSelect,
  recentProducts = [],
  mode = 'purchase',
  context = 'planning'
}: ProductSearchDialogProps) => {
  
  console.log('DEBUG: ProductSearchDialog rendered with props:', {
    open,
    mode,
    context,
    productsCount: products?.length
  });
  const { currency } = useCurrencyStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [configQty, setConfigQty] = useState<number>(1);
  const [configUnitLabel, setConfigUnitLabel] = useState<string>("");
  const [configUnitMultiplier, setConfigUnitMultiplier] = useState<number>(1);
  const [configUnitPrice, setConfigUnitPrice] = useState<number>(0);
  const [configDiscount, setConfigDiscount] = useState<number>(0);
  const [serialInput, setSerialInput] = useState<string>("");
  const [availableSerials, setAvailableSerials] = useState<string[]>([]);
  const [selectedSerials, setSelectedSerials] = useState<Set<string>>(new Set<string>());
  const [loadingSerials, setLoadingSerials] = useState<boolean>(false);
  const [receivingSerials, setReceivingSerials] = useState<string[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);

  // Search products based on multiple criteria
  const searchProducts = (term: string) => {
    if (!term.trim() || !Array.isArray(products)) {
      setSearchResults([]);
      return;
    }

    const lowerTerm = term.toLowerCase().trim();
    
    const results = products.filter(product => {
      // Add null checks for all product properties
      if (!product || typeof product !== 'object') return false;
      
      const name = product?.name || '';
      const skuCode = product?.sku_code || '';
      const hsnCode = product?.hsn_code || '';
      const barcode = product?.barcode || '';
      
      // Check if any field contains the search term
      const matches = name.toLowerCase().includes(lowerTerm) ||
             skuCode.toLowerCase().includes(lowerTerm) ||
             hsnCode.toLowerCase().includes(lowerTerm) ||
             barcode.toLowerCase().includes(lowerTerm) ||
             // Also check for exact matches (useful for EAN codes)
             name.toLowerCase() === lowerTerm ||
             skuCode.toLowerCase() === lowerTerm ||
             hsnCode.toLowerCase() === lowerTerm ||
             barcode.toLowerCase() === lowerTerm;
      
      return matches;
    });

    setSearchResults(results.slice(0, 10)); // Limit to 10 results
  };

  // Serial lookup for sale mode: if search looks like a serial, try resolving it
  useEffect(() => {
    const controller = new AbortController();
    const tryLookup = async () => {
      if (!open || mode !== 'sale') return;
      const term = searchTerm.trim();
      if (!term) return;
      // Heuristic: long non-whitespace tokens might be serials; always allow manual try
      if (term.length < 4) return;
      try {
        const res: any = await lookupSerial(term);
        if (res && res.found && res.product && res.status === 'available') {
          // Build a minimal product-like object and auto-open configure with 1 qty and the serial prefilled
          const prod = products.find(p => p.id === res.productId);
          const base: Product = prod || {
            id: res.productId,
            name: res.product?.name || 'Product',
            sku_code: res.product?.sku_code || '',
            hsn_code: res.product?.hsn_code || '',
            barcode: res.product?.barcode || '',
            cost_price: res.product?.cost_price || 0,
            sale_price: res.product?.sale_price || 0,
            purchase_tax_type: res.product?.purchase_tax_type,
            sale_tax_type: res.product?.sale_tax_type,
            units: res.product?.units || { name: 'Unit', abbreviation: 'Unit' }
          } as any;
          openConfigure(base);
          setConfigQty(1);
          setSerialInput(term);
          // If override is not allowed, we can immediately confirm as a 1-qty add
          if (!base.allow_override_price) {
            // Set price for one unit
            setConfigUnitLabel(base.units?.abbreviation || 'Unit');
            setConfigUnitMultiplier(1);
            setConfigUnitPrice(base.sale_price);
          }
        }
      } catch (_) {
        // ignore lookup errors silently
      }
    };
    tryLookup();
    return () => controller.abort();
  }, [searchTerm, mode, open, products]);

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSearchResults([]);
      setError(null);
      // reset config state as well
      setConfigProduct(null);
      setConfigQty(1);
      setConfigUnitLabel("");
      setConfigUnitMultiplier(1);
      setConfigUnitPrice(0);
      setSerialInput("");
      setConfigError(null);
    }
  }, [open]);

  useEffect(() => {
    if (Array.isArray(products)) {
      searchProducts(searchTerm);
    }
  }, [searchTerm, products]);

  // Start barcode scanning
  const startScanning = async () => {
    try {
      setIsScanning(true);
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported in this browser');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Failed to access camera. Please check permissions.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Handle barcode detection (simplified - in real implementation, you'd use a barcode library)
  const handleBarcodeDetected = (barcode: string) => {
    setSearchTerm(barcode);
    stopScanning();
  };

  // Handle product selection with validation
  const handleProductSelect = (product: Product) => {
    try {
      // Validate product object
      if (!product || typeof product !== 'object') {
        setError('Invalid product data');
        return;
      }

      // Validate required fields
      if (!product.id || !product.name || !product.sku_code) {
        setError('Product is missing required information');
        return;
      }

      // Validate product has required information based on mode
      if (mode === 'purchase') {
        if (!product.purchase_tax_type) {
          setError('Product is missing purchase tax type');
          return;
        }
        if (typeof product.cost_price !== 'number' || product.cost_price < 0) {
          setError('Product is missing or has invalid cost price');
          return;
        }
        if (!product.purchase_tax) {
          setError('Product is missing purchase tax information');
          return;
        }
      } else {
        if (!product.sale_tax_type) {
          setError('Product is missing sale tax type');
          return;
        }
        if (typeof product.sale_price !== 'number' || product.sale_price < 0) {
          setError('Product is missing or has invalid sale price');
          return;
        }
        if (!product.sale_tax) {
          setError('Product is missing sale tax information');
          return;
        }
      }

      // Clear any previous errors
      setError(null);
      
      // Call the parent's onProductSelect with the validated product
      onProductSelect(product);
      onOpenChange(false);
    } catch (error) {
      console.error('Error selecting product:', error);
      setError('Failed to select product. Please try again.');
    }
  };

  // Helpers for configuration step
  const getUnitOptions = (product: Product) => {
    const options: Array<{ label: string; multiplier: number }> = [];
    const baseLabel = product?.units?.abbreviation || 'Unit';
    options.push({ label: baseLabel, multiplier: 1 });
    const conversions = product?.unit_conversions;
    let mapping: Record<string, number> = {};
    if (conversions) {
      if (typeof conversions === 'string') {
        try {
          const parsed = JSON.parse(conversions);
          if (parsed && typeof parsed === 'object') mapping = parsed;
        } catch {}
      } else if (typeof conversions === 'object') {
        mapping = conversions as Record<string, number>;
      }
    }
    Object.entries(mapping).forEach(([label, qty]) => {
      const m = Number(qty);
      if (label && m > 0) options.push({ label, multiplier: m });
    });
    return options;
  };

  const computeDefaultUnitPrice = (product: Product, multiplier: number) => {
    const basePrice = mode === 'purchase' ? product.cost_price : product.sale_price;
    let price = (Number(basePrice) || 0) * (Number(multiplier) || 1);
    if (mode === 'sale' && typeof product.mrp === 'number' && product.mrp > 0) {
      const max = product.mrp * (Number(multiplier) || 1);
      if (price > max) price = max;
    }
    return Math.round(price * 100) / 100;
  };

  const getMaxAllowedUnitPrice = (product: Product, multiplier: number) => {
    if (mode !== 'sale') return Infinity;
    if (typeof product.mrp !== 'number' || product.mrp <= 0) return Infinity;
    return product.mrp * (Number(multiplier) || 1);
  };

  const openConfigure = (product: Product) => {
    setConfigProduct(product);
    const unitOptions = getUnitOptions(product);
    const defaultUnit = unitOptions[0];
    setConfigUnitLabel(defaultUnit.label);
    setConfigUnitMultiplier(defaultUnit.multiplier);
    setConfigQty(1);
    setConfigUnitPrice(computeDefaultUnitPrice(product, defaultUnit.multiplier));
    setSerialInput("");
    setSelectedSerials(new Set<string>());
    setReceivingSerials([]);
    // Preload available serials for selling context
    if ((product as any)?.is_serialized && context === 'selling') {
      setLoadingSerials(true);
      listSerials(product.id, 'available')
        .then((res: any) => {
          const rows = Array.isArray(res) ? res : (res?.data || []);
          const values = rows.map((r: any) => r.serial_number || r.serialNumber || r.serial);
          setAvailableSerials(values.filter(Boolean));
        })
        .catch(() => setAvailableSerials([]))
        .finally(() => setLoadingSerials(false));
    } else {
      setAvailableSerials([]);
    }
    setConfigError(null);
    setConfigDiscount(0);
  };

  const requiredSerialCount = (() => {
    if (!configProduct || !configProduct.is_serialized) return 0;
    return (configQty || 0) * (configUnitMultiplier || 1);
  })();

  // Keep receiving serial slots in sync with required count
  useEffect(() => {
    if (!configProduct?.is_serialized) return;
    if (context !== 'receiving') return;
    const count = requiredSerialCount;
    setReceivingSerials(prev => {
      const arr = [...prev];
      if (arr.length < count) return [...arr, ...Array(count - arr.length).fill("")];
      if (arr.length > count) return arr.slice(0, count);
      return arr;
    });
  }, [requiredSerialCount, context, configProduct?.is_serialized]);

  const parseSerials = (text: string) => {
    return text
      .split(/\r?\n|,/) // newline or comma separated
      .map(s => s.trim())
      .filter(Boolean);
  };

  const validateConfig = () => {
    if (!configProduct) return 'No product selected';
    if (!configQty || configQty <= 0) return 'Quantity must be greater than 0';
    if (!configUnitPrice || configUnitPrice <= 0) return 'Unit price must be greater than 0';
    if (configDiscount < 0) return 'Discount cannot be negative';
    const maxAllowed = getMaxAllowedUnitPrice(configProduct, configUnitMultiplier);
    if (configUnitPrice > maxAllowed) return `Unit price cannot exceed ${formatCurrency(maxAllowed, currency)} (MRP limit)`;
    
    // Serial number validation for serialized products
    if (configProduct.is_serialized && context !== 'planning') {
      if (context === 'selling') {
        const n = selectedSerials.size;
        if (n !== requiredSerialCount) {
          return `Select exactly ${requiredSerialCount} serial${requiredSerialCount === 1 ? '' : 's'}`;
        }
      } else if (context === 'receiving') {
        const serials = receivingSerials.map(s => (s || '').trim()).filter(() => true);
        if (serials.length !== requiredSerialCount) {
          return `Enter exactly ${requiredSerialCount} serial${requiredSerialCount === 1 ? '' : 's'}`;
        }
        if (serials.some(s => s === '')) {
          return 'All serial fields are required';
        }
        // Duplicates
        const set = new Set<string>();
        const dup = serials.find(s => { if (set.has(s)) return true; set.add(s); return false; });
        if (dup) return `Duplicate serial numbers detected: ${dup}`;
        // Alphanumeric enforcement
        const bad = serials.find(s => /[^a-zA-Z0-9]/.test(s));
        if (bad) return 'Serials must be alphanumeric only';
      } else {
        // Fallback: textarea path (not used now)
        if (!serialInput || serialInput.trim() === '') {
          return 'Serial numbers are required for serialized products';
        }
      }
    }
    
    return null;
  };

  const confirmConfigure = () => {
    if (!configProduct) return;
    const err = validateConfig();
    setConfigError(err);
    if (err) return;

    console.log('DEBUG: confirmConfigure - configProduct.is_serialized:', configProduct.is_serialized);
    console.log('DEBUG: confirmConfigure - context:', context);
    console.log('DEBUG: confirmConfigure - serialInput:', serialInput);
    console.log('DEBUG: confirmConfigure - parsed serials:', parseSerials(serialInput));

    const enriched: Product = {
      ...configProduct,
      _selectedQuantity: configQty,
      _selectedUnitLabel: configUnitLabel || configProduct.units?.abbreviation || 'Unit',
      _selectedUnitMultiplier: configUnitMultiplier || 1,
      _selectedUnitPrice: configUnitPrice,
      // We'll attach discount via a temporary property for consumers
      // @ts-ignore
      _selectedDiscount: configDiscount,
      _serialNumbers: (configProduct.is_serialized && context !== 'planning') ? (
        context === 'selling' ? Array.from(selectedSerials) : receivingSerials.map(s => s.trim())
      ) : undefined,
    };

    console.log('DEBUG: confirmConfigure - enriched product:', enriched);
    console.log('DEBUG: confirmConfigure - final _serialNumbers:', enriched._serialNumbers);

    // Reuse existing validation and selection flow
    handleProductSelect(enriched);
  };

  // Get tax info based on mode
  const getTaxInfo = (product: Product | undefined) => {
    if (!product || typeof product !== 'object') return { type: undefined, rate: 0, name: undefined };
    
    if (mode === 'purchase') {
      return {
        type: product.purchase_tax_type,
        rate: product.purchase_tax?.rate || 0,
        name: product.purchase_tax?.name
      };
    } else {
      return {
        type: product.sale_tax_type,
        rate: product.sale_tax?.rate || 0,
        name: product.sale_tax?.name
      };
    }
  };

  // Get price based on mode
  const getPrice = (product: Product | undefined) => {
    if (!product || typeof product !== 'object') return 0;
    return mode === 'purchase' ? product.cost_price : product.sale_price;
  };

  // Check if product has missing tax info
  const hasMissingTaxInfo = (product: Product | undefined) => {
    if (!product || typeof product !== 'object') return true;
    
    if (mode === 'purchase') {
      // Check if tax type is missing (this is required)
      if (!product.purchase_tax_type) return true;
      // Check if cost price is missing (this is required)
      if (typeof product.cost_price !== 'number' || product.cost_price < 0) return true;
      // Tax rate can be 0 (valid), but tax object should exist
      if (!product.purchase_tax) return true;
      return false;
    } else {
      // Check if tax type is missing (this is required)
      if (!product.sale_tax_type) return true;
      // Check if sale price is missing (this is required)
      if (typeof product.sale_price !== 'number' || product.sale_price < 0) return true;
      // Tax rate can be 0 (valid), but tax object should exist
      if (!product.sale_tax) return true;
      return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product to Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Search Input */}
          {!configProduct && (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by SKU, Name, HSN, or EAN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4"
                />
              </div>
              <Button
                variant="outline"
                onClick={isScanning ? stopScanning : startScanning}
                disabled={!navigator.mediaDevices}
              >
                {isScanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                <span className="ml-2">Scan</span>
              </Button>
            </div>
          )}

          {/* Camera Feed */}
          {isScanning && !configProduct && (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-48 object-cover rounded border"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={stopScanning}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!configProduct && !searchTerm && !isScanning && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Search for products to add to your order</p>
              <p className="text-gray-500 text-sm mt-1">You can search by SKU, product name, HSN code, or scan a barcode</p>
            </div>
          )}

          {/* Recent Products */}
          {!configProduct && recentProducts.length > 0 && !searchTerm && !isScanning && (
            <div>
              <Label className="text-sm font-medium">Recent Products</Label>
              <div className="grid gap-2 mt-2">
                {recentProducts.slice(0, 5).map((product) => {
                  const taxInfo = getTaxInfo(product);
                  const price = getPrice(product);
                  const hasMissing = hasMissingTaxInfo(product);
                  
                  return (
                    <div
                      key={product.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                        hasMissing ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      onClick={() => !hasMissing && openConfigure(product)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-600">
                            SKU: {product.sku_code} • HSN: {product.hsn_code}
                            {product.units?.abbreviation && ` • Unit: ${product.units.abbreviation}`}
                          </div>
                          <div className="text-sm text-gray-600">
                            Tax: {taxInfo.type} {taxInfo.name && `(${taxInfo.name})`} ({taxInfo.rate ? (taxInfo.rate * 100).toFixed(0) : 0}%)
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(price, currency)}</div>
                          </div>
                          {hasMissing ? (
                            <Badge variant="destructive" className="text-xs">
                              Missing Tax Info
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" className="flex items-center gap-1">
                              <Plus className="h-4 w-4" />
                              Configure
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results */}
          {!configProduct && searchTerm && (
            <div>
              <Label className="text-sm font-medium">
                Search Results ({searchResults.length})
              </Label>
              <div className="grid gap-2 mt-2">
                {searchResults.map((product) => {
                  const taxInfo = getTaxInfo(product);
                  const price = getPrice(product);
                  const hasMissing = hasMissingTaxInfo(product);
                  
                  return (
                    <div
                      key={product.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                        hasMissing ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      onClick={() => !hasMissing && openConfigure(product)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-600">
                            SKU: {product.sku_code} • HSN: {product.hsn_code}
                            {product.units?.abbreviation && ` • Unit: ${product.units.abbreviation}`}
                          </div>
                          <div className="text-sm text-gray-600">
                            Tax: {taxInfo.type} {taxInfo.name && `(${taxInfo.name})`} ({taxInfo.rate ? (taxInfo.rate * 100).toFixed(0) : 0}%)
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(price, currency)}</div>
                          </div>
                          {hasMissing ? (
                            <Badge variant="destructive" className="text-xs">
                              Missing Tax Info
                            </Badge>
                          ) : (
                            <Button size="sm" variant="outline" className="flex items-center gap-1">
                              <Plus className="h-4 w-4" />
                              Configure
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!configProduct && searchTerm && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No products found matching "{searchTerm}"
            </div>
          )}

          {/* Configure Item Panel */}
          {configProduct && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setConfigProduct(null); setConfigError(null); }} className="flex items-center gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <div className="font-medium">{configProduct.name}</div>
                </div>
                <div className="text-sm text-gray-600">SKU: {configProduct.sku_code} • HSN: {configProduct.hsn_code}</div>
              </div>

              {configError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{configError}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Select
                    value={configUnitLabel}
                    onValueChange={(val) => {
                      setConfigUnitLabel(val);
                      const option = getUnitOptions(configProduct).find(o => o.label === val) || { label: val, multiplier: 1 };
                      setConfigUnitMultiplier(option.multiplier);
                      setConfigUnitPrice(computeDefaultUnitPrice(configProduct, option.multiplier));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {getUnitOptions(configProduct).map(opt => (
                        <SelectItem key={opt.label} value={opt.label}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={configQty}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      const safe = isNaN(v) ? 1 : Math.max(1, v);
                      setConfigQty(safe);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price ({configUnitLabel || configProduct.units?.abbreviation || 'Unit'})</Label>
                  <Input
                    type="number"
                    value={configUnitPrice}
                    onChange={(e) => {
                      const raw = parseFloat(e.target.value);
                      const val = isNaN(raw) ? 0 : raw;
                      const max = getMaxAllowedUnitPrice(configProduct, configUnitMultiplier);
                      const clamped = val > max ? max : val;
                      setConfigUnitPrice(clamped);
                    }}
                    disabled={mode === 'sale' ? !configProduct.allow_override_price : false}
                    title={mode === 'sale' ? (configProduct.allow_override_price ? 'Price override enabled for this product' : 'Price override not allowed') : 'Editable in purchase mode'}
                  />
                  {mode === 'sale' && typeof configProduct.mrp === 'number' && configProduct.mrp > 0 && (
                    <div className="text-xs text-gray-500">Max allowed: {formatCurrency(getMaxAllowedUnitPrice(configProduct, configUnitMultiplier), currency)} (MRP limit)</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Discount</Label>
                  <Input
                    type="number"
                    min={0}
                    value={configDiscount}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setConfigDiscount(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                  />
                </div>
              </div>

              {/* Serialized handling */}
              {configProduct.is_serialized && context !== 'planning' && (
                <div className="space-y-2">
                  <Label className="text-red-600">
                    Serial # <span className="text-red-500">*</span>
                    {requiredSerialCount > 0 && (
                      <span className="text-xs text-gray-500 ml-2">(Required: {requiredSerialCount})</span>
                    )}
                  </Label>
                  {context === 'selling' ? (
                    <div className="border rounded p-2 max-h-40 overflow-auto bg-white">
                      {loadingSerials ? (
                        <div className="text-xs text-gray-500">Loading available serials...</div>
                      ) : availableSerials.length === 0 ? (
                        <div className="text-xs text-red-600">No available serials found for this product</div>
                      ) : (
                        availableSerials.map((s) => {
                          const checked = selectedSerials.has(s);
                          const disabled = !checked && selectedSerials.size >= requiredSerialCount;
                          return (
                            <label key={s} className={`flex items-center gap-2 text-xs py-1 ${disabled ? 'opacity-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(e) => {
                                  const next = new Set<string>(selectedSerials);
                                  if (e.target.checked) next.add(s); else next.delete(s);
                                  setSelectedSerials(next);
                                }}
                              />
                              <span className="font-mono">{s}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {Array.from({ length: requiredSerialCount }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-6">{idx + 1}.</span>
                          <Input
                            value={receivingSerials[idx] || ''}
                            placeholder="#"
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                              setReceivingSerials(prev => {
                                const next = [...prev];
                                next[idx] = cleaned;
                                return next;
                              });
                            }}
                            className="h-7 text-xs"
                          />
                        </div>
                      ))}
                      <div className="text-xs text-gray-500">Enter exactly {requiredSerialCount} alphanumeric serials. Duplicates are not allowed.</div>
                    </div>
                  )}
                </div>
              )}
              {/* Removed debug info from UI */}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Total ({configQty} × {formatCurrency(configUnitPrice, currency)}): <span className="font-medium">{formatCurrency(configQty * configUnitPrice, currency)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setConfigProduct(null); setConfigError(null); }}>Cancel</Button>
                  <Button onClick={confirmConfigure}>Confirm</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 