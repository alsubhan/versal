
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatCurrency, applyRounding } from "@/lib/utils";
import { type PurchaseIndent, type PurchaseIndentItem } from "@/types/purchase-indent";
import { getProducts, getUsers, getTaxes } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCurrencyStore } from "@/stores/currencyStore";
import { ProductSearchDialog } from "@/components/shared/ProductSearchDialog";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface PurchaseIndentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indent: PurchaseIndent | null;
  onSave: (indent: any) => void;
}

export const PurchaseIndentDialog = ({ open, onOpenChange, indent, onSave }: PurchaseIndentDialogProps) => {
  const { user, hasPermission } = useAuth();
  const { currency } = useCurrencyStore();
  const { settings: systemSettings } = useSystemSettings();
  
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  
  // Form State
  const [indentNumber, setIndentNumber] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [department, setDepartment] = useState("");
  const [requiredDate, setRequiredDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<any>("draft");
  const [items, setItems] = useState<Partial<PurchaseIndentItem>[]>([]);
  
  // Summary Stats
  const [summary, setSummary] = useState({
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    roundingAdjustment: 0
  });

  useEffect(() => {
    if (open) {
      loadInitialData();
      if (indent) {
        setIndentNumber(indent.indentNumber);
        setRequesterId(indent.requesterId);
        setDepartment(indent.department || "");
        setRequiredDate(indent.requiredDate ? new Date(indent.requiredDate) : new Date());
        setStatus(indent.status);
        setNotes(indent.notes || "");
        setItems(indent.items || []);
        calculateTotals(indent.items || []);
      } else {
        const today = new Date();
        setIndentNumber(`IND-${today.getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`);
        setRequesterId(user?.id || "");
        setDepartment("");
        setRequiredDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        setStatus("draft");
        setNotes("");
        setItems([]);
        setSummary({ subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0, roundingAdjustment: 0 });
      }
    }
  }, [open, indent, user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [prodData, userData, taxData] = await Promise.all([
        getProducts(),
        getUsers(),
        getTaxes()
      ]);
      setProducts(prodData || []);
      setUsers(userData || []);
      setTaxes(taxData || []);
    } catch (error) {
      console.error("Error loading dialog data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTax = (product: any, quantity: number, unitPrice: number, discount: number = 0) => {
    const taxRate = product?.purchase_tax?.rate || 0;
    const taxType = product?.purchase_tax_type || 'exclusive';
    const amountAfterDiscount = (quantity * unitPrice) - discount;
    
    if (taxType === 'inclusive') {
      const taxAmount = amountAfterDiscount - (amountAfterDiscount / (1 + taxRate));
      return Math.round(taxAmount * 100) / 100;
    } else {
      const taxAmount = amountAfterDiscount * taxRate;
      return Math.round(taxAmount * 100) / 100;
    }
  };

  const calculateItemTotal = (product: any, quantity: number, unitPrice: number, discount: number, tax: number) => {
    const taxType = product?.purchase_tax_type || 'exclusive';
    const amountAfterDiscount = (quantity * unitPrice) - discount;
    
    if (taxType === 'inclusive') {
      return amountAfterDiscount;
    } else {
      return amountAfterDiscount + tax;
    }
  };

  const calculateTotals = (itemsList: Partial<PurchaseIndentItem>[]) => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;
    
    itemsList.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.estimatedUnitPrice) || 0;
      // Note: We don't have per-item discount in first version, but keeping logic for mirroring
      const discount = 0; 
      
      subtotal += (quantity * unitPrice);
      
      if (product?.purchase_tax_type === 'exclusive') {
        taxAmount += Number(item.tax) || 0;
      }
    });
    
    const unroundedTotal = subtotal - discountAmount + taxAmount;
    const totalAmount = applyRounding(unroundedTotal, systemSettings?.roundingMethod || 'nearest', String(systemSettings?.roundingPrecision || '0.01'));

    const roundingAdjustment = totalAmount - unroundedTotal;
    
    setSummary({
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      roundingAdjustment
    });
  };

  const addItem = () => {
    setShowProductSearch(true);
  };

  const handleProductSelect = (product: any) => {
    // Check if we are replacing an item
    const editingIndexStr = sessionStorage.getItem('editingIndentItemIndex');
    const hasValidEditingIndex = editingIndexStr !== null;

    const unitPrice = product.purchase_price || 0;
    const quantity = 1;
    const tax = calculateTax(product, quantity, unitPrice);
    
    const newItem: Partial<PurchaseIndentItem> = {
      productId: product.id,
      productName: product.name,
      skuCode: product.sku_code,
      hsnCode: product.hsn_code,
      quantity: quantity,
      estimatedUnitPrice: unitPrice,
      discount: 0,
      tax: tax,
      purchaseTaxType: product.purchase_tax_type,
      total: calculateItemTotal(product, quantity, unitPrice, 0, tax),
      unitAbbreviation: product.units?.abbreviation || ''
    };



    let newItems = [...items];
    if (hasValidEditingIndex) {
      const index = parseInt(editingIndexStr!);
      newItems[index] = newItem;
      sessionStorage.removeItem('editingIndentItemIndex');
    } else {
      newItems.push(newItem);
    }

    setItems(newItems);
    calculateTotals(newItems);
    setShowProductSearch(false);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    calculateTotals(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    const product = products.find(p => p.id === item.productId);
    if (product) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.estimatedUnitPrice) || 0;
      const tax = calculateTax(product, quantity, unitPrice);
      item.tax = tax;
      item.total = calculateItemTotal(product, quantity, unitPrice, 0, tax);
    }
    
    newItems[index] = item;
    setItems(newItems);
    calculateTotals(newItems);
  };

  const handleSave = () => {
    if (!indentNumber || !requesterId || items.length === 0) {
      toast.error("Please fill in all required fields and add at least one item.");
      return;
    }

    const payload = {
      indentNumber,
      requesterId,
      department,
      requiredDate: format(requiredDate, "yyyy-MM-dd"),
      status,
      notes,
      totalEstimatedValue: summary.totalAmount,
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        skuCode: item.skuCode,
        hsnCode: item.hsnCode,
        quantity: Number(item.quantity),
        estimatedUnitPrice: Number(item.estimatedUnitPrice),
        discount: Number(item.discount || 0),
        tax: Number(item.tax || 0),
        total: Number(item.total || 0),
        purchaseTaxType: item.purchaseTaxType,
        unitAbbreviation: item.unitAbbreviation
      }))


    };

    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{indent ? "Edit Purchase Indent" : "Create Purchase Indent"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 py-4">
          <div>
            <Label className="text-sm font-medium">Indent #</Label>
            <Input value={indentNumber} onChange={e => setIndentNumber(e.target.value)} disabled className="mt-1 bg-muted font-mono" />
          </div>
          
          <div>
            <Label className="text-sm font-medium">Requester *</Label>
            <Select onValueChange={setRequesterId} value={requesterId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select requester" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Department</Label>
            <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Operations" className="mt-1" />
          </div>

          <div>
            <Label className="text-sm font-medium">Required Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !requiredDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {requiredDate ? format(requiredDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={requiredDate} onSelect={(d) => d && setRequiredDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-sm font-medium">Status</Label>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending Approval</SelectItem>
                {hasPermission('purchase_orders_approve') && (
                  <>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </>
                )}
                {status === 'converted' && <SelectItem value="converted">Converted to PO</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Items Requested</h3>
            <Button variant="outline" size="sm" onClick={addItem} className="flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[350px]">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead className="w-[100px] text-right">Qty</TableHead>

                  <TableHead className="w-[150px] text-right">Est. Unit Price</TableHead>
                  <TableHead className="w-[120px] text-right">Tax</TableHead>
                  <TableHead className="text-right">Total Est.</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">
                      No items added yet. Click "Add Item" to start.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[250px]">{item.productName || 'No product'}</span>
                          <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => {
                            sessionStorage.setItem('editingIndentItemIndex', index.toString());
                            setShowProductSearch(true);
                          }}>
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.skuCode || "-"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{item.hsnCode || "-"}</TableCell>

                      <TableCell>
                        <Input type="number" value={item.quantity} onChange={e => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)} className="text-right h-8" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={item.estimatedUnitPrice} onChange={e => handleItemChange(index, "estimatedUnitPrice", parseFloat(e.target.value) || 0)} className="text-right h-8" step="0.01" />
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <div className="relative pt-2">
                          <span className="font-mono">{formatCurrency(item.tax || 0, currency)}</span>
                          {item.purchaseTaxType && (
                            <div className="absolute top-0 right-0">
                                <span className={`px-1 rounded-[2px] text-[8px] font-bold uppercase ${
                                    item.purchaseTaxType === 'inclusive' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                }`}>
                                    {item.purchaseTaxType.slice(0, 3)}
                                </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.total || 0, currency)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Internal Notes / Reason for Purchase</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Please provide specific details or justification for this request..." className="resize-none" />
          </div>
          
          <div className="flex justify-end pt-4">
            <div className="bg-muted/30 p-6 rounded-xl min-w-[320px] shadow-sm border">
               <h4 className="text-sm font-bold uppercase text-muted-foreground mb-4 tracking-wider">Estimated Summary</h4>
               <div className="space-y-3">
                 <div className="flex justify-between items-center text-sm">
                   <span>Subtotal:</span>
                   <span className="font-mono">{formatCurrency(summary.subtotal, currency)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span>Tax:</span>
                   <span className="font-mono">{formatCurrency(summary.taxAmount, currency)}</span>
                 </div>
                 {summary.roundingAdjustment !== 0 && (
                   <div className="flex justify-between items-center text-sm text-muted-foreground">
                     <span>Rounding:</span>
                     <span className="font-mono">{summary.roundingAdjustment > 0 ? '+' : ''}{formatCurrency(summary.roundingAdjustment, currency)}</span>
                   </div>
                 )}
                 <div className="border-t pt-3 flex justify-between items-center">
                   <span className="text-lg font-bold">Total Estimated:</span>
                   <span className="text-xl font-black text-primary">{formatCurrency(summary.totalAmount, currency)}</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-8 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || items.length === 0}>
            {loading ? "Saving..." : (indent ? "Update Purchase Indent" : "Submit Purchase Indent")}
          </Button>
        </DialogFooter>

        <ProductSearchDialog
          open={showProductSearch}
          onOpenChange={setShowProductSearch}
          products={products}
          onProductSelect={handleProductSelect}
          mode="purchase"
        />
      </DialogContent>
    </Dialog>
  );
};
