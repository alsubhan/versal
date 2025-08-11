import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Debug mode check
const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true' || import.meta.env.DEV;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { type GoodsReceiveNote, type GoodsReceiveNoteItem } from "@/types/grn";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getGoodReceiveNote, getProducts, getPurchaseOrder, getUsers } from "@/lib/api";

interface GRNViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grn: GoodsReceiveNote | null;
}

export const GRNView = ({ open, onOpenChange, grn }: GRNViewProps) => {
  const { currency } = useCurrencyStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [completeData, setCompleteData] = useState<GoodsReceiveNote | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<any>(null);
  const [receivedByUser, setReceivedByUser] = useState<any>(null);
  
  // Load products when dialog opens
  useEffect(() => {
    if (open) {
      loadProducts();
      loadCompleteData();
    }
  }, [open, grn]);

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadPurchaseOrderData = async (purchaseOrderId: string) => {
    try {
      const data = await getPurchaseOrder(purchaseOrderId);
      setPurchaseOrder(data);
    } catch (error) {
      console.error('Error loading purchase order:', error);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      const users = await getUsers();
      const user = users.find((u: any) => u.id === userId);
      setReceivedByUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadCompleteData = async () => {
    if (!grn?.id) return;
    
    try {
      setLoading(true);
      const data = await getGoodReceiveNote(grn.id);
      if (data && !data.error) {
        // Process items to ensure they have unit information
        const processedItems = (data.items || []).map(item => {
          if (DEBUG_MODE) {
            console.log('GRNView - Processing item:', item);
            console.log(`GRNView - Item tax data: tax=${item.tax}, discount=${item.discount}, purchaseTaxType=${item.purchaseTaxType}`);
          }
          const product = products.find(p => p.id === item.productId);
          const processedItem = {
            ...item,
            unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
          };
          if (DEBUG_MODE) {
            console.log('GRNView - Processed item:', processedItem);
            console.log(`GRNView - Processed item tax data: tax=${processedItem.tax}, discount=${processedItem.discount}, purchaseTaxType=${processedItem.purchaseTaxType}`);
          }
          return processedItem;
        });
        
        setCompleteData({
          ...data,
          items: processedItems
        });

        // Load related data
        if (data.purchaseOrderId) {
          await loadPurchaseOrderData(data.purchaseOrderId);
        }
        if (data.receivedBy) {
          await loadUserData(data.receivedBy);
        }
      } else {
        // Process items from existing GRN
        const processedItems = (grn.items || []).map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            ...item,
            unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
          };
        });
        
        setCompleteData({
          ...grn,
          items: processedItems
        });

        // Load related data
        if (grn.purchaseOrderId) {
          await loadPurchaseOrderData(grn.purchaseOrderId);
        }
        if (grn.receivedBy) {
          await loadUserData(grn.receivedBy);
        }
      }
    } catch (error) {
      console.error('Error loading complete GRN data:', error);
      // Process items from existing GRN
      const processedItems = (grn.items || []).map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          ...item,
          unitAbbreviation: product?.units?.abbreviation || item.unitAbbreviation || ''
        };
      });
      
      setCompleteData({
        ...grn,
        items: processedItems
      });

      // Load related data
      if (grn.purchaseOrderId) {
        await loadPurchaseOrderData(grn.purchaseOrderId);
      }
      if (grn.receivedBy) {
        await loadUserData(grn.receivedBy);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading GRN...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Loading GRN data...</p>
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
            <DialogTitle>GRN Not Found</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-600">GRN data could not be loaded.</p>
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
          <DialogTitle>View GRN - {completeData.grnNumber}</DialogTitle>
        </DialogHeader>
        
        {/* TOP SECTION - GRN Details */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
          <div>
            <Label htmlFor="grnNumber" className="text-sm font-medium text-gray-700">GRN #</Label>
            <Input
              id="grnNumber"
              value={completeData.grnNumber}
              disabled
              className="mt-1 bg-gray-50 font-mono text-sm"
            />
          </div>
          
          <div>
            <Label htmlFor="purchaseOrderId" className="text-sm font-medium text-gray-700">Purchase Order</Label>
            <Input
              id="purchaseOrderId"
              value={purchaseOrder?.orderNumber || completeData.purchaseOrder?.orderNumber || 'N/A'}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
          
          <div>
            <Label htmlFor="orderedDate" className="text-sm font-medium text-gray-700">Ordered Date</Label>
            <Input
              id="orderedDate"
              value={purchaseOrder?.orderDate ? format(new Date(purchaseOrder.orderDate), "PPP") : 'N/A'}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
          
          <div>
            <Label htmlFor="receivedDate" className="text-sm font-medium text-gray-700">Invoice Date</Label>
            <Input
              id="receivedDate"
              value={completeData.receivedDate ? format(new Date(completeData.receivedDate), "PPP") : "N/A"}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>

          <div>
            <Label htmlFor="vendorInvoiceNumber" className="text-sm font-medium text-gray-700">Supplier Invoice #</Label>
            <Input
              id="vendorInvoiceNumber"
              value={(completeData as any).vendorInvoiceNumber || ''}
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
          
          <div>
            <Label htmlFor="receivedBy" className="text-sm font-medium text-gray-700">Received By</Label>
            <Input
              id="receivedBy"
              value={receivedByUser?.name || 'N/A'}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>
          
          <div>
            <Label htmlFor="isDirect" className="text-sm font-medium text-gray-700">Type</Label>
            <Input
              id="isDirect"
              value={completeData.isDirect ? 'Direct (Auto PO)' : 'Linked to PO'}
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
                  <TableHead className="font-medium text-gray-700">Qty Received</TableHead>
                  <TableHead className="font-medium text-gray-700">Unit Cost</TableHead>
                  <TableHead className="font-medium text-gray-700">Discount</TableHead>
                  <TableHead className="font-medium text-gray-700">Tax</TableHead>
                  <TableHead className="font-medium text-gray-700">Batch #</TableHead>
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
                          <span className="font-medium">{item.receivedQuantity}</span>
                          {item.unitAbbreviation && (
                            <span className="text-sm text-gray-500 font-medium">
                              {item.unitAbbreviation}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCurrency(item.unitCost || 0, currency)}
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
                      <TableCell>
                        {item.batchNumber || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {formatCurrency(item.total || 0, currency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      No items found
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
              value={completeData.notes || ""}
              disabled
              className="mt-1 bg-gray-50"
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