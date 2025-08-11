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
  ean_code: string;
  cost_price: number;
  sale_price: number;
  purchase_tax_type?: 'inclusive' | 'exclusive';
  purchase_tax?: {
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
}

export const ProductSearchDialog = ({ 
  open, 
  onOpenChange, 
  products, 
  onProductSelect,
  recentProducts = []
}: ProductSearchDialogProps) => {
  const { currency } = useCurrencyStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search products based on multiple criteria
  const searchProducts = (term: string) => {
    if (!term.trim() || !Array.isArray(products)) {
      setSearchResults([]);
      return;
    }

    const lowerTerm = term.toLowerCase();
    const results = products.filter(product => {
      // Add null checks for all product properties
      const name = product?.name || '';
      const skuCode = product?.sku_code || '';
      const hsnCode = product?.hsn_code || '';
      const eanCode = product?.ean_code || '';
      
      return name.toLowerCase().includes(lowerTerm) ||
             skuCode.toLowerCase().includes(lowerTerm) ||
             hsnCode.toLowerCase().includes(lowerTerm) ||
             eanCode.toLowerCase().includes(lowerTerm);
    });

    setSearchResults(results.slice(0, 10)); // Limit to 10 results
  };

  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setSearchResults([]);
      setScanResult("");
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsScanning(false);
    }
  };

  // Stop barcode scanning
  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setScanResult("");
  };

  // Handle manual EAN entry
  const handleEANEntry = (ean: string) => {
    setScanResult(ean);
    const product = products.find(p => p?.ean_code === ean);
    if (product) {
      onProductSelect(product);
      onOpenChange(false);
    }
  };

  // Handle product selection
  const handleProductSelect = (product: Product) => {
    // Validate that product has required information before allowing selection
    if (!product?.purchase_tax?.rate) {
      alert(`Product ${product?.name} (${product?.sku_code}) is missing tax rate information. Please update the product settings.`);
      return;
    }
    
    if (!product?.purchase_tax_type) {
      alert(`Product ${product?.name} (${product?.sku_code}) is missing tax type information. Please update the product settings.`);
      return;
    }
    
    if (!product?.cost_price) {
      alert(`Product ${product?.name} (${product?.sku_code}) is missing cost price. Please update the product settings.`);
      return;
    }
    
    onProductSelect(product);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product to Order</DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by SKU, Name, HSN, or EAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={isScanning ? stopScanning : startScanning}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            {isScanning ? "Stop" : "Scan"}
          </Button>
        </div>

        {/* Barcode Scanner */}
        {isScanning && (
          <div className="mb-4 p-4 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm font-medium">Barcode Scanner</Label>
              <Button variant="ghost" size="sm" onClick={stopScanning}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-48 object-cover rounded border"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-red-500 w-48 h-24 rounded"></div>
              </div>
            </div>
            <div className="mt-2">
              <Label className="text-sm">Or enter EAN manually:</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Enter EAN code..."
                  value={scanResult}
                  onChange={(e) => setScanResult(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && scanResult) {
                      handleEANEntry(scanResult);
                    }
                  }}
                />
                <Button 
                  size="sm" 
                  onClick={() => handleEANEntry(scanResult)}
                  disabled={!scanResult}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Products */}
        {recentProducts.length > 0 && !searchTerm && (
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Recent Products
            </Label>
            <div className="space-y-2">
              {recentProducts.slice(0, 5).map((product) => (
                <div
                  key={product.id}
                  className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                    !product?.purchase_tax?.rate || !product?.purchase_tax_type || !product?.cost_price
                      ? 'border-red-200 bg-red-50'
                      : ''
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{product?.name || 'Unknown Product'}</div>
                    <div className="text-sm text-gray-500">
                      SKU: {product?.sku_code || 'N/A'} • HSN: {product?.hsn_code || 'N/A'}
                      {product?.units?.abbreviation && ` • Unit: ${product.units.abbreviation}`}
                    </div>
                    {product?.purchase_tax_type && product?.purchase_tax?.rate ? (
                      <div className="text-xs text-blue-600 mt-1">
                        Tax: {product.purchase_tax_type === 'inclusive' ? 'Inclusive' : 'Exclusive'} ({((product.purchase_tax.rate * 100).toFixed(0))}%)
                      </div>
                    ) : (
                      <div className="text-xs text-red-600 mt-1">
                        ⚠️ Missing Tax Info
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(product?.cost_price || 0, currency)}</div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-1"
                      disabled={!product?.purchase_tax?.rate || !product?.purchase_tax_type || !product?.cost_price}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Search Results ({searchResults.length})
            </Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((product) => (
                <div
                  key={product.id}
                  className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer ${
                    !product?.purchase_tax?.rate || !product?.purchase_tax_type || !product?.cost_price
                      ? 'border-red-200 bg-red-50'
                      : ''
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{product?.name || 'Unknown Product'}</div>
                    <div className="text-sm text-gray-500">
                      SKU: {product?.sku_code || 'N/A'} • HSN: {product?.hsn_code || 'N/A'}
                      {product?.units?.abbreviation && ` • Unit: ${product.units.abbreviation}`}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {product?.category && (
                        <Badge variant="secondary">
                          {product.category.name}
                        </Badge>
                      )}
                      {product?.purchase_tax_type && product?.purchase_tax?.rate ? (
                        <Badge variant="outline" className="text-xs">
                          Tax: {product.purchase_tax_type === 'inclusive' ? 'Inclusive' : 'Exclusive'} ({((product.purchase_tax.rate * 100).toFixed(0))}%)
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Missing Tax Info
                        </Badge>
                      )}
                    </div>
                    {(!product?.purchase_tax?.rate || !product?.purchase_tax_type || !product?.cost_price) && (
                      <div className="text-xs text-red-600 mt-1">
                        ⚠️ This product needs tax information to be added to purchase orders
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(product?.cost_price || 0, currency)}</div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-1"
                      disabled={!product?.purchase_tax?.rate || !product?.purchase_tax_type || !product?.cost_price}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {searchTerm && searchResults.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No products found matching "{searchTerm}"</p>
            <p className="text-sm">Try searching by SKU, product name, HSN code, or EAN</p>
          </div>
        )}

        {/* Instructions */}
        {!searchTerm && searchResults.length === 0 && recentProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>Search for products to add to your order</p>
            <p className="text-sm">You can search by SKU, product name, HSN code, or scan a barcode</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}; 