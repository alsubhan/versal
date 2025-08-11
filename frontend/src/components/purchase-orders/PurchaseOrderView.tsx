import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { type PurchaseOrder, type PurchaseOrderItem } from "@/types/purchase-order";
import { type Supplier } from "@/types/supplier";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getPurchaseOrder, getSuppliers, getProducts } from "@/lib/api";

interface PurchaseOrderViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder | null;
}

export const PurchaseOrderView = ({ open, onOpenChange, purchaseOrder }: PurchaseOrderViewProps) => {
  const { currency } = useCurrencyStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completeData, setCompleteData] = useState<PurchaseOrder | null>(null);
  
  // Load suppliers and products when dialog opens
  useEffect(() => {
    if (open) {
      loadSuppliers();
      loadProducts();
      loadCompleteData();
    }
  }, [open, purchaseOrder]);

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCompleteData = async () => {
    if (!purchaseOrder?.id) return;
    
    try {
      setLoading(true);
      const data = await getPurchaseOrder(purchaseOrder.id);
      if (data && !data.error) {
        // Process items to ensure they have unit information
        const processedItems = (data.items || []).map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            ...item,
            unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
          };
        });
        
        setCompleteData({
          ...data,
          items: processedItems
        });
      } else {
        // Process items from existing purchase order
        const processedItems = (purchaseOrder.items || []).map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            ...item,
            unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
          };
        });
        
        setCompleteData({
          ...purchaseOrder,
          items: processedItems
        });
      }
    } catch (error) {
      console.error('Error loading complete purchase order data:', error);
      // Process items from existing purchase order
      const processedItems = (purchaseOrder.items || []).map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          ...item,
          unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
        };
      });
      
      setCompleteData({
        ...purchaseOrder,
        items: processedItems
      });
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || 'Unknown Supplier';
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Purchase Order...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading purchase order data...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!completeData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order Not Found</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-600">Purchase order data could not be loaded.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View Purchase Order - {completeData.orderNumber}</DialogTitle>
        </DialogHeader>
        
        {/* TOP SECTION - Purchase Order Details */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
          <div>
            <Label htmlFor="orderNumber" className="text-sm font-medium text-gray-700">Purchase Order #</Label>
            <Input
              id="orderNumber"
              value={completeData.orderNumber}
              disabled
              className="mt-1 bg-gray-50 font-mono text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="supplierId" className="text-sm font-medium text-gray-700">Supplier</Label>
            <Input
              id="supplierId"
              value={getSupplierName(completeData.supplierId)}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
          
          <div>
            <Label htmlFor="orderDate" className="text-sm font-medium text-gray-700">Order Date</Label>
            <Input
              id="orderDate"
              value={completeData.orderDate ? format(new Date(completeData.orderDate), "PPP") : "N/A"}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
          
          <div>
            <Label htmlFor="expectedDeliveryDate" className="text-sm font-medium text-gray-700">Expected Delivery Date</Label>
            <Input
              id="expectedDeliveryDate"
              value={completeData.expectedDeliveryDate ? format(new Date(completeData.expectedDeliveryDate), "PPP") : "N/A"}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
          
          <div>
            <Label htmlFor="status" className="text-sm font-medium text-gray-700">Status</Label>
            <Input
              id="status"
              value={completeData.status ? completeData.status.charAt(0).toUpperCase() + completeData.status.slice(1) : 'N/A'}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
        </div>
        
        {/* MIDDLE SECTION - Items Table */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Items</h3>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {completeData.items && completeData.items.length > 0 ? (
                  completeData.items.map((item, index) => (
                    <TableRow key={item.id || index} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.productName || 'Unknown Product'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.skuCode || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{item.hsnCode || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item.quantity}</span>
                          {item.unitAbbreviation && (
                            <span className="text-sm text-gray-500 font-medium">
                              {item.unitAbbreviation}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCurrency(item.costPrice || 0, currency)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.discount || 0}
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <div className="font-mono text-sm">
                            {formatCurrency(item.tax || 0, currency)}
                          </div>
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No items found
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
              value={completeData.notes || ""}
              disabled
              className="mt-1 bg-gray-50"
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
                  <span className="font-mono font-medium">{formatCurrency(completeData.subtotal || 0, currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-mono font-medium text-red-600">{formatCurrency(completeData.discountAmount || 0, currency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-mono font-medium">{formatCurrency(completeData.taxAmount || 0, currency)}</span>
                </div>
                {(completeData.roundingAdjustment && completeData.roundingAdjustment !== 0) && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Rounding:</span>
                    <span className={`font-mono font-medium ${completeData.roundingAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {completeData.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(completeData.roundingAdjustment, currency)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(completeData.totalAmount || 0, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 