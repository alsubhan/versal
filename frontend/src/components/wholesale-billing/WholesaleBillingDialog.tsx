import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type WholesaleBill, type WholesaleBillingItem } from "@/types/wholesale-billing";
import { type WholesaleOrder } from "@/types/wholesale-order";
import { PlusCircle, Trash2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { type Customer } from "@/types/customer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { type CreditNote } from "@/types/credit-note";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface WholesaleBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: WholesaleBill;
  onSave: (bill: Partial<WholesaleBill>) => void;
  customers: Customer[];
  products: {
    id: string;
    name: string;
    skuCode: string;
    price: number;
    taxRate: number;
  }[];
  orders?: WholesaleOrder[];
  creditNotes?: CreditNote[];
}
export function WholesaleBillingDialog({
  open,
  onOpenChange,
  bill,
  onSave,
  customers,
  products,
  orders = [],
  creditNotes = []
}: WholesaleBillingDialogProps) {
  const {
    currency,
    getCurrencySymbol
  } = useCurrencyStore();
  const [formData, setFormData] = useState<Partial<WholesaleBill>>({
    billNumber: "",
    customerId: "",
    billingDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    // 30 days from now
    status: "draft",
    notes: "",
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    amountPaid: 0,
    amountDue: 0,
    paymentMethod: "credit" // Set default payment method to credit
  });
  const [items, setItems] = useState<Partial<WholesaleBillingItem>[]>([{
    productId: "",
    productName: "",
    skuCode: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    tax: 0,
    total: 0
  }]);
  const [useExistingOrder, setUseExistingOrder] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  // For payment methods
  const [selectedCreditNote, setSelectedCreditNote] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [partialPayment, setPartialPayment] = useState<boolean>(false);
  const [productSearches, setProductSearches] = useState<string[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState<boolean[]>([]);

  // Update the product search state when items change
  useEffect(() => {
    setProductSearches(items.map(() => ""));
    setProductSearchOpen(items.map(() => false));
  }, [items.length]);

  // Filter products based on search query
  const filterProducts = (query: string) => {
    if (!query) return products;
    
    query = query.toLowerCase();
    return products.filter(
      product => 
        product.name.toLowerCase().includes(query) || 
        product.skuCode.toLowerCase().includes(query)
    );
  };

  useEffect(() => {
    if (bill) {
      setFormData({
        ...bill
      });
      setItems(bill.items);
      setUseExistingOrder(!!bill.wholesaleOrderId);
      setSelectedOrderId(bill.wholesaleOrderId || "");
      setReferenceNumber(bill.paymentReference || "");
      setPaymentDate(bill.paymentDate ? bill.paymentDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setPartialPayment(bill.amountPaid !== undefined && bill.amountPaid > 0 && bill.amountPaid < bill.totalAmount);
    } else {
      // Reset form for new bill
      resetForm();
    }
  }, [bill, open]);
  const resetForm = () => {
    setFormData({
      billNumber: `BILL-${Date.now().toString().substring(6)}`,
      customerId: "",
      billingDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      // 30 days from now
      status: "draft",
      notes: "",
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      amountPaid: 0,
      amountDue: 0,
      paymentMethod: "credit" // Default payment method is credit
    });
    setItems([{
      productId: "",
      productName: "",
      skuCode: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      tax: 0,
      total: 0
    }]);
    setUseExistingOrder(false);
    setSelectedOrderId("");
    setSelectedCreditNote("");
    setReferenceNumber("");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPartialPayment(false);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    if (name === "amountPaid") {
      const amountPaid = parseFloat(value) || 0;
      setFormData(prev => {
        const amountDue = Math.max(0, (prev.totalAmount || 0) - amountPaid);
        return {
          ...prev,
          amountPaid,
          amountDue
        };
      });

      // If amount paid equals total amount, set status to paid
      if (amountPaid > 0 && formData.totalAmount && amountPaid >= formData.totalAmount) {
        setFormData(prev => ({
          ...prev,
          status: "paid"
        }));
      } else if (amountPaid > 0) {
        setFormData(prev => ({
          ...prev,
          status: "pending"
        }));
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  const handleSelectChange = (value: string, name: string) => {
    if (name === 'customerId') {
      const selectedCustomer = customers.find(c => c.id === value);
      setFormData({
        ...formData,
        [name]: value,
        customer: selectedCustomer
      });
    } else if (name === 'wholesaleOrderId' && value) {
      const selectedOrder = orders.find(o => o.id === value);
      if (selectedOrder) {
        // Populate bill with order data
        const orderItems: Partial<WholesaleBillingItem>[] = selectedOrder.items.map(item => ({
          orderItemId: item.id,
          productId: item.productId,
          productName: item.productName,
          skuCode: item.skuCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          tax: item.tax,
          total: item.total
        }));
        setItems(orderItems);
        setFormData({
          ...formData,
          wholesaleOrderId: value,
          wholesaleOrder: selectedOrder,
          customerId: selectedOrder.customerId,
          customer: selectedOrder.customer,
          subtotal: selectedOrder.subtotal,
          taxAmount: selectedOrder.taxAmount,
          discountAmount: selectedOrder.discountAmount,
          totalAmount: selectedOrder.totalAmount,
          amountDue: selectedOrder.totalAmount
        });
      }
    } else if (name === 'paymentMethod') {
      // Fix: Cast the value to the proper type
      const paymentMethodValue = value as "cash" | "bank_transfer" | "cheque" | "credit_card" | "online" | "credit" | "credit_note";
      setFormData({
        ...formData,
        paymentMethod: paymentMethodValue
      });

      // Reset credit note selection if not using credit note payment
      if (paymentMethodValue !== 'credit_note') {
        setSelectedCreditNote("");
      }
    } else if (name === 'creditNoteId') {
      setSelectedCreditNote(value);

      // If a credit note is selected, apply its amount to the payment
      const selected = creditNotes.find(cn => cn.id === value);
      if (selected) {
        const amountPaid = Math.min(selected.totalAmount, formData.totalAmount || 0);
        const amountDue = (formData.totalAmount || 0) - amountPaid;
        setFormData(prev => ({
          ...prev,
          amountPaid,
          amountDue,
          paymentReference: `Credit Note #${selected.creditNoteNumber}`
        }));
        setReferenceNumber(`Credit Note #${selected.creditNoteNumber}`);

        // Update status based on payment
        if (amountDue === 0) {
          setFormData(prev => ({
            ...prev,
            status: "paid"
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            status: "pending"
          }));
        }
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  const handleProductSearch = (index: number, value: string) => {
    const newSearches = [...productSearches];
    newSearches[index] = value;
    setProductSearches(newSearches);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        productId: product.id,
        productName: product.name,
        skuCode: product.skuCode,
        unitPrice: product.price,
        tax: product.taxRate
      };

      // Close the popover
      const newSearchOpen = [...productSearchOpen];
      newSearchOpen[index] = false;
      setProductSearchOpen(newSearchOpen);
      
      // Reset the search
      const newSearches = [...productSearches];
      newSearches[index] = "";
      setProductSearches(newSearches);

      // Recalculate totals
      const quantity = newItems[index].quantity || 1;
      const unitPrice = product.price;
      const discount = newItems[index].discount || 0;
      const tax = product.taxRate;
      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discount / 100);
      const taxableAmount = subtotal - discountAmount;
      const taxAmount = taxableAmount * (tax / 100);
      newItems[index].total = taxableAmount + taxAmount;
      setItems(newItems);
      recalculateTotals(newItems);
    }
  };
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;

    // Recalculate total for this item
    if (field === 'unitPrice' || field === 'quantity' || field === 'discount' || field === 'tax') {
      const item = newItems[index];
      const subtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const discountAmount = subtotal * (item.discount || 0) / 100;
      const taxAmount = (subtotal - discountAmount) * (item.tax || 0) / 100;
      newItems[index].total = subtotal - discountAmount + taxAmount;
    }
    setItems(newItems);
    recalculateTotals(newItems);
  };
  const addItem = () => {
    setItems([...items, {
      productId: "",
      productName: "",
      skuCode: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      tax: 0,
      total: 0
    }]);
  };
  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
      recalculateTotals(newItems);
    }
  };
  const recalculateTotals = (newItems: Partial<WholesaleBillingItem>[]) => {
    const subtotal = newItems.reduce((sum, item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      return sum + itemSubtotal;
    }, 0);
    const discountAmount = newItems.reduce((sum, item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscount = itemSubtotal * (item.discount || 0) / 100;
      return sum + itemDiscount;
    }, 0);
    const taxAmount = newItems.reduce((sum, item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscountAmount = itemSubtotal * (item.discount || 0) / 100;
      const itemTaxAmount = (itemSubtotal - itemDiscountAmount) * (item.tax || 0) / 100;
      return sum + itemTaxAmount;
    }, 0);
    const totalAmount = subtotal - discountAmount + taxAmount;
    const amountPaid = formData.amountPaid || 0;
    const amountDue = Math.max(0, totalAmount - amountPaid);
    setFormData(prev => ({
      ...prev,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      amountDue
    }));
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.billNumber) {
      toast({
        title: "Error",
        description: "Bill number is required",
        variant: "destructive"
      });
      return;
    }
    if (!formData.customerId) {
      toast({
        title: "Error",
        description: "Customer is required",
        variant: "destructive"
      });
      return;
    }

    // Validate items
    const validItems = items.filter(item => item.productId && item.quantity && item.unitPrice);
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "At least one valid item is required",
        variant: "destructive"
      });
      return;
    }

    // Update payment information
    const updatedFormData = {
      ...formData,
      paymentReference: referenceNumber,
      paymentDate: formData.status === "paid" ? new Date(paymentDate) : undefined,
      creditNoteId: formData.paymentMethod === 'credit_note' ? selectedCreditNote : undefined
    };
    onSave({
      ...updatedFormData,
      items: validItems as WholesaleBillingItem[]
    });
    onOpenChange(false);
  };
  const filterOrdersByCustomer = () => {
    if (!formData.customerId) return [];
    return orders.filter(order => order.customerId === formData.customerId);
  };
  const filterCreditNotesByCustomer = () => {
    if (!formData.customerId) return [];
    return creditNotes.filter(note => note.customerId === formData.customerId && note.status === "approved");
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{bill ? "Edit Wholesale Bill" : "Create Wholesale Bill"}</DialogTitle>
            <DialogDescription>
              {bill ? "Update the details of this wholesale bill." : "Enter the details to create a new wholesale bill."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billNumber">Invoice Number</Label>
                <Input id="billNumber" name="billNumber" value={formData.billNumber} onChange={handleInputChange} required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customerId">Customer</Label>
                <Select name="customerId" value={formData.customerId} onValueChange={value => handleSelectChange(value, 'customerId')} disabled={useExistingOrder && !!selectedOrderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {formData.customerId && !bill?.id && <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="useExistingOrder" checked={useExistingOrder} onChange={() => setUseExistingOrder(!useExistingOrder)} className="rounded border-gray-300" />
                  <Label htmlFor="useExistingOrder">Create from existing order</Label>
                </div>
                
                {useExistingOrder && <div>
                    <Select name="wholesaleOrderId" value={selectedOrderId} onValueChange={value => handleSelectChange(value, 'wholesaleOrderId')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterOrdersByCustomer().map(order => <SelectItem key={order.id} value={order.id}>
                            {order.orderNumber} ({formatDate(order.orderDate)})
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>}
              </div>}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingDate">Invoice Date</Label>
                <Input id="billingDate" name="billingDate" type="date" value={formData.billingDate instanceof Date ? formData.billingDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]} onChange={handleInputChange} required />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" name="dueDate" type="date" value={formData.dueDate instanceof Date ? formData.dueDate.toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} onChange={handleInputChange} required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status" value={formData.status} onValueChange={value => handleSelectChange(value, 'status')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Amount Paid</Label>
                <Input id="amountPaid" name="amountPaid" type="number" step="0.01" value={formData.amountPaid || ""} onChange={handleInputChange} />
              </div>
            </div>
            
            {formData.status === "paid" || formData.amountPaid !== undefined && formData.amountPaid > 0 ? <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select name="paymentMethod" value={formData.paymentMethod || "credit"} onValueChange={value => handleSelectChange(value, 'paymentMethod')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="online">Online Payment</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                        <SelectItem value="credit_note">Credit Note</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="paymentDate">Payment Date</Label>
                    <Input id="paymentDate" name="paymentDate" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                  </div>
                </div>
                
                {formData.paymentMethod === 'credit_note' ? <div className="space-y-2">
                    <Label htmlFor="creditNoteId">Select Credit Note</Label>
                    <Select name="creditNoteId" value={selectedCreditNote} onValueChange={value => handleSelectChange(value, 'creditNoteId')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a credit note" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterCreditNotesByCustomer().map(note => <SelectItem key={note.id} value={note.id}>
                            {note.creditNoteNumber} ({formatCurrency(note.totalAmount, currency)})
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div> : <div className="space-y-2">
                    <Label htmlFor="paymentReference">Payment Reference</Label>
                    <Input id="paymentReference" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="Receipt number, transaction ID, etc." />
                  </div>}
              </> : null}
            
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" value={formData.notes || ""} onChange={handleInputChange} rows={2} />
            </div>
          </div>
          
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="items">
              <AccordionTrigger>
                Bill Items
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Bill Items</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={useExistingOrder && !!selectedOrderId}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                  
                  <div className="border rounded-md p-2">
                    {items.map((item, index) => <div key={index} className="grid grid-cols-7 gap-2 mb-2 pb-2 border-b last:border-0">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs" htmlFor={`item-${index}-product`}>Product</Label>
                          <Popover 
                            open={productSearchOpen[index]} 
                            onOpenChange={(open) => {
                              const newOpen = [...productSearchOpen];
                              newOpen[index] = open;
                              setProductSearchOpen(newOpen);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={productSearchOpen[index]}
                                className="w-full justify-between"
                                disabled={useExistingOrder && !!selectedOrderId}
                              >
                                {item.productId ? `${item.productName} (${item.skuCode})` : "Select product..."}
                                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                              <Command>
                                <CommandInput 
                                  placeholder="Search products..." 
                                  value={productSearches[index]}
                                  onValueChange={(value) => handleProductSearch(index, value)}
                                  className="h-9"
                                />
                                <CommandEmpty>No product found.</CommandEmpty>
                                <CommandGroup className="max-h-[200px] overflow-y-auto">
                                  {filterProducts(productSearches[index]).map((product) => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.id}
                                      onSelect={() => handleProductSelect(index, product.id)}
                                    >
                                      {product.name} ({product.skuCode})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`item-${index}-qty`}>Quantity</Label>
                          <Input id={`item-${index}-qty`} type="number" min="1" value={item.quantity || ""} onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} disabled={useExistingOrder && !!selectedOrderId} />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`item-${index}-price`}>Unit Price</Label>
                          <Input id={`item-${index}-price`} type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)} disabled={useExistingOrder && !!selectedOrderId} />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`item-${index}-discount`}>Discount %</Label>
                          <Input id={`item-${index}-discount`} type="number" min="0" max="100" value={item.discount || ""} onChange={e => updateItem(index, 'discount', parseFloat(e.target.value) || 0)} disabled={useExistingOrder && !!selectedOrderId} />
                        </div>
                        
                        <div className="space-y-1">
                          <Label className="text-xs" htmlFor={`item-${index}-tax`}>Tax %</Label>
                          <Input id={`item-${index}-tax`} type="number" min="0" value={item.tax || ""} onChange={e => updateItem(index, 'tax', parseFloat(e.target.value) || 0)} disabled={useExistingOrder && !!selectedOrderId} />
                        </div>
                        
                        <div className="flex items-end">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length === 1 || useExistingOrder && !!selectedOrderId}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>)}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          <div className="flex justify-end space-x-4 border-t pt-4 mt-4">
            <div className="text-right space-y-1">
              <div className="text-sm">Subtotal: {formatCurrency(formData.subtotal || 0, currency)}</div>
              <div className="text-sm">Discount: {formatCurrency(formData.discountAmount || 0, currency)}</div>
              <div className="text-sm">Tax: {formatCurrency(formData.taxAmount || 0, currency)}</div>
              <div className="text-lg font-bold">Total: {formatCurrency(formData.totalAmount || 0, currency)}</div>
              <div className="text-sm">Amount Paid: {formatCurrency(formData.amountPaid || 0, currency)}</div>
              <div className="text-sm font-semibold">Amount Due: {formatCurrency(formData.amountDue || 0, currency)}</div>
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>;
}
