import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, applyRounding } from "@/lib/utils";
import { toast } from "sonner";
import { type SaleQuotation, type SaleQuotationItem } from "@/types/sale-quotation";
import { type Customer } from "@/types/customer";
import { useCurrencyStore } from "@/stores/currencyStore";
import { getSaleQuotation, getProducts, getTaxes, getCustomers, getFrequentItems } from "@/lib/api";
import { ProductSearchDialog } from "@/components/shared/ProductSearchDialog";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { customerGstType, computeGstBreakup } from "@/lib/gst";
import { GstBreakupRows } from "@/components/GstBreakupRows";

interface SaleQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: SaleQuotation | null;
  onSave: (q: Partial<SaleQuotation>) => void;
}

const STATUS_OPTIONS = ["draft", "sent", "rejected", "cancelled"] as const;

export const SaleQuotationDialog = ({
  open,
  onOpenChange,
  quotation,
  onSave,
}: SaleQuotationDialogProps) => {
  const { currency } = useCurrencyStore();
  const { settings: systemSettings } = useSystemSettings();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showFrequentItemsDialog, setShowFrequentItemsDialog] = useState(false);
  const [frequentItems, setFrequentItems] = useState<any[]>([]);

  const [formData, setFormData] = useState<Partial<SaleQuotation>>({
    quotationNumber: "",
    customerId: "",
    quotationDate: new Date(),
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: "draft",
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    notes: "",
    termsConditions: "",
    items: [],
  });

  const activeCustomer = useMemo(() => customers.find((c) => c.id === formData?.customerId), [customers, formData?.customerId]);
  
  const billingOptions = useMemo(() => {
    if (!activeCustomer) return [];
    const opts = [];
    if (activeCustomer.billingAddress?.street) {
      opts.push({ ...activeCustomer.billingAddress, _label: 'Default Billing', _id: 'default-billing' });
    }
    const additionals = (activeCustomer.additionalAddresses || []).filter(a => a.type === 'billing' || a.type === 'both');
    additionals.forEach((a, i) => opts.push({ ...a, _label: a.label || `Additional ${i+1}`, _id: `add-b-${i}` }));
    return opts;
  }, [activeCustomer]);

  const shippingOptions = useMemo(() => {
    if (!activeCustomer) return [];
    const opts = [];
    if (activeCustomer.shippingAddress?.street) {
      opts.push({ ...activeCustomer.shippingAddress, _label: 'Default Shipping', _id: 'default-shipping' });
    }
    const additionals = (activeCustomer.additionalAddresses || []).filter(a => a.type === 'shipping' || a.type === 'both');
    additionals.forEach((a, i) => opts.push({ ...a, _label: a.label || `Additional ${i+1}`, _id: `add-s-${i}` }));
    return opts;
  }, [activeCustomer]);

  const [items, setItems] = useState<Partial<SaleQuotationItem>[]>([]);

  // Load reference data when dialog opens
  useEffect(() => {
    if (open) {
      loadProducts();
      loadTaxes();
      loadCustomers();
    }
  }, [open]);

  const loadProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch {
      toast.error("Failed to load products");
    }
  };

  const loadTaxes = async () => {
    try {
      const data = await getTaxes();
      setTaxes(data);
    } catch {
      toast.error("Failed to load taxes");
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch {
      toast.error("Failed to load customers");
    }
  };

  // Populate default T&C from system settings when creating a new quotation
  const getDefaultTerms = () => {
    return (systemSettings as any)?.defaultQuotationTerms || "";
  };

  // Tax calculation (same as SaleOrderDialog)
  const calculateTax = (
    product: any,
    quantity: number,
    unitPrice: number,
    discount: number = 0
  ): number => {
    const rate = product?.sale_tax?.rate;
    const taxType = product?.sale_tax_type;
    if (rate === undefined || rate === null || !taxType)
      throw new Error(`Product ${product?.name} missing tax info`);
    const sub = quantity * unitPrice - discount;
    if (taxType === "inclusive") {
      return Math.round((sub - sub / (1 + rate)) * 100) / 100;
    }
    return Math.round(sub * rate * 100) / 100;
  };

  const calculateTotal = (
    taxType: "inclusive" | "exclusive",
    quantity: number,
    unitPrice: number,
    discount: number,
    tax: number
  ): number => {
    const sub = quantity * unitPrice - discount;
    return taxType === "inclusive" ? sub : sub + tax;
  };

  // Populate form when editing
  useEffect(() => {
    if (!open) return;

    if (quotation) {
      if (quotation.id && !quotation.items) {
        setDataLoading(true);
        getSaleQuotation(quotation.id)
          .then((full) => {
            const q = full && !full.error ? full : quotation;
            setFormData({ ...q });
            setItems(q.items || []);
          })
          .catch(() => {
            setFormData({ ...quotation });
            setItems(quotation.items || []);
          })
          .finally(() => setDataLoading(false));
      } else {
        setFormData({ ...quotation });
        setItems(quotation.items || []);
      }
    } else {
      const today = new Date();
      const num = `QTN-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
      setFormData({
        quotationNumber: num,
        customerId: "",
        quotationDate: today,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: "draft",
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        notes: "",
        termsConditions: getDefaultTerms(),
        items: [],
      });
      setItems([]);
    }
  }, [quotation, open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = async (name: string, value: string) => {
    let updates: any = { [name]: value };
    if (name === "customerId" && value) {
      try {
        const data = await getFrequentItems(value);
        if (data && data.length > 0) {
          setFrequentItems(data);
          setShowFrequentItemsDialog(true);
        }
      } catch (error) {
        console.error('Error fetching frequent items:', error);
      }
      
      const selectedCustomer = customers.find(c => c.id === value);
      if (selectedCustomer && selectedCustomer.shippingAddress && Object.keys(selectedCustomer.shippingAddress).length > 0) {
        updates.shippingAddress = { ...selectedCustomer.shippingAddress };
      } else {
        updates.shippingAddress = { street: "", city: "", state: "", zipCode: "", country: "" };
      }
      if (selectedCustomer && selectedCustomer.billingAddress && Object.keys(selectedCustomer.billingAddress).length > 0) {
        updates.billingAddress = { ...selectedCustomer.billingAddress };
      } else {
        updates.billingAddress = { street: "", city: "", state: "", zipCode: "", country: "" };
      }
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const applyFrequentItems = () => {
    if (frequentItems.length > 0) {
      const newItems = frequentItems.map(item => ({
        ...item,
        id: undefined,
        quantity: 1
      }));
      setItems(newItems as any);
      calculateTotals(newItems as any);
      toast.success(`Added ${newItems.length} frequently purchased items`);
    }
    setShowFrequentItemsDialog(false);
  };


  const handleDateChange = (name: string, date: Date | undefined) => {
    if (date) setFormData((prev) => ({ ...prev, [name]: date }));
  };

  const handleProductSelect = (product: any) => {
    try {
      if (!product?.id || !product?.name || !product?.sku_code) {
        toast.error("Incomplete product data. Please try again.");
        return;
      }
      if (product?.sale_tax?.rate === undefined || !product?.sale_tax_type) {
        toast.error(`${product?.name} is missing tax information.`);
        return;
      }
      if (!product?.sale_price) {
        toast.error(`${product?.name} is missing sale price.`);
        return;
      }

      const qty = (product._selectedQuantity ?? 1) as number;
      const discount = Number(product._selectedDiscount ?? 0);
      const unitPrice = (product._selectedUnitPrice ?? product.sale_price) as number;
      const calculatedTax = calculateTax(product, qty, unitPrice, discount);

      const newItem: Partial<SaleQuotationItem> = {
        id: `temp-${Date.now()}`,
        quotationId: "",
        productId: product.id,
        productName: product.name,
        skuCode: product.sku_code,
        hsnCode: product.hsn_code,
        quantity: qty,
        unitPrice,
        discount,
        tax: calculatedTax,
        total: calculateTotal(product.sale_tax_type, qty, unitPrice, discount, calculatedTax),
        saleTaxType: product.sale_tax_type,
        unitAbbreviation: product._selectedUnitLabel ?? product.units?.abbreviation ?? "",
      };

      const newItems = [...items, newItem];
      setItems(newItems);
      calculateTotals(newItems);
    } catch (err: any) {
      toast.error(err.message || "Error adding product");
    }
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

    if (["quantity", "unitPrice", "discount"].includes(field)) {
      const item = newItems[index];
      const qty = Number(item.quantity) || 0;
      const up = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        try {
          const tax = calculateTax(product, qty, up, disc);
          newItems[index].tax = tax;
          newItems[index].total = calculateTotal(item.saleTaxType!, qty, up, disc, tax);
        } catch {
          newItems[index].tax = 0;
        }
      }
    }

    setItems(newItems);
    calculateTotals(newItems);
  };

  const calculateTotals = (itemsList: Partial<SaleQuotationItem>[]) => {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    itemsList.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const up = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      subtotal += qty * up;
      discountAmount += disc;
      if (item.saleTaxType === "exclusive") taxAmount += Number(item.tax) || 0;
    });

    const unrounded = subtotal - discountAmount + taxAmount;
    const totalAmount = applyRounding(unrounded, systemSettings.roundingMethod, systemSettings.roundingPrecision);
    const roundingAdjustment = totalAmount - unrounded;

    // Compute GST breakup
    const selectedCustomer = customers.find(c => c.id === formData.customerId);
    const gstType = customerGstType(systemSettings.company_state, selectedCustomer);
    const { cgstAmount, sgstAmount, igstAmount } = computeGstBreakup(taxAmount, gstType);

    setFormData((prev) => ({ ...prev, subtotal, taxAmount, discountAmount, totalAmount, roundingAdjustment, gstType, cgstAmount, sgstAmount, igstAmount }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const errors: string[] = [];
      if (!formData.quotationNumber?.trim()) errors.push("Quotation # is required");
      if (!formData.customerId?.trim()) errors.push("Customer is required");
      if (!formData.quotationDate) errors.push("Quotation Date is required");
      if (!items || items.length === 0) errors.push("At least one item is required");

      if (errors.length > 0) {
        toast.error(errors.join(", "));
        return;
      }

      onSave({ ...formData, items } as Partial<SaleQuotation>);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save quotation");
    } finally {
      setLoading(false);
    }
  };

  const isReadOnly = ["accepted", "expired"].includes(formData.status || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isReadOnly
              ? `View Quotation — ${formData.quotationNumber}`
              : quotation
              ? "Edit Quotation"
              : "Create Quotation"}
          </DialogTitle>
        </DialogHeader>

        {dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
          </div>
        ) : (
          <>
            {/* Header fields */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
              <div>
                <Label htmlFor="quotationNumber" className="text-sm font-medium text-gray-700">
                  Quotation # <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quotationNumber"
                  name="quotationNumber"
                  value={formData.quotationNumber || ""}
                  className="mt-1 bg-gray-50 font-mono text-sm"
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="customerId" className="text-sm font-medium text-gray-700">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(v) => handleSelectChange("customerId", v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.customerId && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Billing Location</Label>
                    <Select
                      value={formData.billingAddress?.street ? JSON.stringify(formData.billingAddress) : ""}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, billingAddress: JSON.parse(val) }))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select billing location" />
                      </SelectTrigger>
                      <SelectContent>
                        {billingOptions.map((opt: any) => (
                          <SelectItem key={opt._id} value={JSON.stringify(opt)}>
                            {opt._label} - {opt.street}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Shipping Location</Label>
                    <Select
                      value={formData.shippingAddress?.street ? JSON.stringify(formData.shippingAddress) : ""}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, shippingAddress: JSON.parse(val) }))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select shipping location" />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingOptions.map((opt: any) => (
                          <SelectItem key={opt._id} value={JSON.stringify(opt)}>
                            {opt._label} - {opt.street}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.quotationDate && "text-muted-foreground"
                      )}
                      disabled={isReadOnly}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.quotationDate ? format(formData.quotationDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.quotationDate}
                      onSelect={(d) => handleDateChange("quotationDate", d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Valid Until</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.validUntil && "text-muted-foreground"
                      )}
                      disabled={isReadOnly}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.validUntil ? format(formData.validUntil, "PPP") : "Optional"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.validUntil}
                      onSelect={(d) => handleDateChange("validUntil", d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleSelectChange("status", v)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  Items <span className="text-red-500">*</span>
                </h3>
                {!isReadOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProductSearch(true)}
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                )}
              </div>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-28">Unit Price</TableHead>
                      <TableHead className="w-24">Discount</TableHead>
                      <TableHead className="w-24">Tax</TableHead>
                      <TableHead className="w-24 text-right">Total</TableHead>
                      {!isReadOnly && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isReadOnly ? 7 : 8} className="text-center text-muted-foreground py-6">
                          No items added yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, idx) => (
                        <TableRow key={item.id || idx}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.skuCode}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              min={0.01}
                              step={0.01}
                              disabled={isReadOnly}
                              onChange={(e) => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)}
                              className="h-7 text-sm w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unitPrice}
                              min={0}
                              step={0.01}
                              disabled={isReadOnly}
                              onChange={(e) => handleItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="h-7 text-sm w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.discount ?? 0}
                              min={0}
                              step={0.01}
                              disabled={isReadOnly}
                              onChange={(e) => handleItemChange(idx, "discount", parseFloat(e.target.value) || 0)}
                              className="h-7 text-sm w-24"
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatCurrency(item.tax ?? 0, currency)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.total ?? 0, currency)}
                          </TableCell>
                          {!isReadOnly && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(idx)}
                                className="h-7 w-7 text-red-500 hover:text-red-700"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end mt-4">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(formData.subtotal ?? 0, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>- {formatCurrency(formData.discountAmount ?? 0, currency)}</span>
                </div>
                <GstBreakupRows
                  taxAmount={formData.taxAmount ?? 0}
                  gstType={(formData.gstType as any) || "IGST"}
                  formatCurrency={(v) => formatCurrency(v, currency)}
                />
                <div className="flex justify-between font-semibold border-t pt-1 text-base">
                  <span>Total</span>
                  <span>{formatCurrency(formData.totalAmount ?? 0, currency)}</span>
                </div>
              </div>
            </div>

            {/* Notes & T&C */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={formData.notes || ""}
                  onChange={handleInputChange}
                  rows={3}
                  disabled={isReadOnly}
                  placeholder="Internal notes..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="termsConditions" className="text-sm font-medium text-gray-700">
                  Terms & Conditions
                </Label>
                <Textarea
                  id="termsConditions"
                  name="termsConditions"
                  value={formData.termsConditions || ""}
                  onChange={handleInputChange}
                  rows={3}
                  disabled={isReadOnly}
                  placeholder="Terms that apply to this quotation..."
                  className="mt-1"
                />
              </div>
            </div>
          </>
        )}

        {!isReadOnly && (
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || dataLoading}>
              {loading ? "Saving..." : quotation ? "Update Quotation" : "Create Quotation"}
            </Button>
          </DialogFooter>
        )}

        <ProductSearchDialog
          open={showProductSearch}
          onOpenChange={setShowProductSearch}
          onProductSelect={handleProductSelect}
          products={products}
        />

        <AlertDialog open={showFrequentItemsDialog} onOpenChange={setShowFrequentItemsDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auto-populate Frequent Items?</AlertDialogTitle>
              <AlertDialogDescription>
                We've found {frequentItems.length} products this customer frequently purchases. 
                Would you like to add them to this quotation automatically?
                <br /><br />
                <span className="text-amber-600 font-medium font-sm italic uppercase">
                  Note: This will replace any items currently in the list.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Skip</AlertDialogCancel>
              <AlertDialogAction onClick={applyFrequentItems}>
                Add Items
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </DialogContent>
    </Dialog>
  );
};
