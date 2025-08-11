import { useState, useEffect, useRef } from "react";
import { Search, Camera, X, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";

interface Product {
  id: string;
  name: string;
  sku_code: string;
  hsn_code: string;
  barcode: string;
  cost_price: number;
  sale_price: number;
  purchase_tax_type?: 'inclusive' | 'exclusive';
  sale_tax_type?: 'inclusive' | 'exclusive';
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
}

interface ProductSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onProductSelect: (product: Product) => void;
  recentProducts?: Product[];
  mode?: 'purchase' | 'sale';
}

export const ProductSearchDialog = ({ 
  open, 
  onOpenChange, 
  products, 
  onProductSelect,
  recentProducts = [],
  mode = 'purchase'
}: ProductSearchDialogProps) => {
  const { currency } = useCurrencyStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSearchResults([]);
      setError(null);
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

          {/* Camera Feed */}
          {isScanning && (
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
          {!searchTerm && !isScanning && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Search for products to add to your order</p>
              <p className="text-gray-500 text-sm mt-1">You can search by SKU, product name, HSN code, or scan a barcode</p>
            </div>
          )}

          {/* Recent Products */}
          {recentProducts.length > 0 && !searchTerm && !isScanning && (
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
                      onClick={() => !hasMissing && handleProductSelect(product)}
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
                              Add
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
          {searchTerm && (
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
                      onClick={() => !hasMissing && handleProductSelect(product)}
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
                              Add
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

          {searchTerm && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No products found matching "{searchTerm}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}; 