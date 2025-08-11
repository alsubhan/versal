import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Trash, Edit, CalendarIcon } from "lucide-react";
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
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { type CustomerPayment, type CustomerPaymentWithRelations } from "@/types/customer-payment";
import { type SaleInvoice } from "@/types/sale-invoice";
import { useCurrencyStore } from "@/stores/currencyStore";
import { 
  getInvoicePayments, 
  createCustomerPayment, 
  updateCustomerPayment, 
  deleteCustomerPayment 
} from "@/lib/api";

interface CustomerPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleInvoice: SaleInvoice;
  onPaymentUpdate?: () => void;
  onInvoiceUpdate?: () => void;
}

export const CustomerPaymentsDialog = ({ 
  open, 
  onOpenChange, 
  saleInvoice, 
  onPaymentUpdate,
  onInvoiceUpdate
}: CustomerPaymentsDialogProps) => {
  const { currency } = useCurrencyStore();
  
  const [payments, setPayments] = useState<CustomerPaymentWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  
  const [formData, setFormData] = useState<Partial<CustomerPayment>>({
    paymentAmount: 0,
    paymentDate: new Date(),
    paymentMethod: "cash",
    paymentReference: "",
    notes: ""
  });
  
  // Load payments when dialog opens
  useEffect(() => {
    if (open) {
      loadPayments();
    }
  }, [open, saleInvoice.id]);
  
  const loadPayments = async () => {
    try {
      setDataLoading(true);
      const data = await getInvoicePayments(saleInvoice.id);
      
      // Debug: Log the data structure we receive
      console.log('Payments API response:', data);
      console.log('Data type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      
      // Ensure we always have an array, even if the API returns unexpected data
      if (Array.isArray(data)) {
        setPayments(data);
      } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
        // Handle case where API returns { data: [...] }
        setPayments(data.data);
      } else {
        // Fallback to empty array for any other case
        console.warn('Unexpected payments data format:', data);
        setPayments([]);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error("Failed to load payments");
      setPayments([]); // Ensure payments is always an array on error
    } finally {
      setDataLoading(false);
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDateChange = (name: string, date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, [name]: date }));
    }
  };
  
  const handleNumberChange = (name: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({ ...prev, [name]: numValue }));
  };
  
  const resetForm = () => {
    setFormData({
      paymentAmount: 0,
      paymentDate: new Date(),
      paymentMethod: "cash",
      paymentReference: "",
      notes: ""
    });
    setEditingPayment(null);
    setShowAddForm(false);
  };
  
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Validate form
      if (!formData.paymentAmount || formData.paymentAmount <= 0) {
        toast.error("Payment amount must be greater than 0");
        return;
      }
      
      if (!formData.paymentMethod) {
        toast.error("Payment method is required");
        return;
      }
      
      // Check if payment would exceed amount due
      if (formData.paymentAmount > amountDue) {
        toast.error(`Payment amount cannot exceed amount due (${formatCurrency(amountDue, currency)})`);
        return;
      }
      
      const paymentData = {
        ...formData,
        invoiceId: saleInvoice.id,
        customerId: saleInvoice.customerId
      };
      
      if (editingPayment) {
        // Update existing payment
        await updateCustomerPayment(editingPayment.id, paymentData);
        toast.success("Payment updated successfully");
      } else {
        // Create new payment
        await createCustomerPayment(paymentData);
        toast.success("Payment added successfully");
      }
      
      // Reload payments and notify parent
      await loadPayments();
      onPaymentUpdate?.();
      onInvoiceUpdate?.(); // Refresh the parent table
      
      // Check if invoice is now fully paid
      const newAmountDue = saleInvoice.totalAmount - (totalPaid + formData.paymentAmount);
      if (newAmountDue <= 0) {
        toast.success("Invoice is now fully paid!");
      }
      
      resetForm();
      
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error("Failed to save payment");
    } finally {
      setLoading(false);
    }
  };
  
  const handleEdit = (payment: CustomerPaymentWithRelations) => {
    setEditingPayment(payment);
    setFormData({
      paymentAmount: payment.paymentAmount,
      paymentDate: new Date(payment.paymentDate),
      paymentMethod: payment.paymentMethod,
      paymentReference: payment.paymentReference || "",
      notes: payment.notes || ""
    });
    setShowAddForm(true);
  };
  
  const handleDelete = async (paymentId: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) {
      return;
    }
    
    try {
      setLoading(true);
      await deleteCustomerPayment(paymentId);
      toast.success("Payment deleted successfully");
      await loadPayments();
      onPaymentUpdate?.();
      onInvoiceUpdate?.(); // Refresh the parent table
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error("Failed to delete payment");
    } finally {
      setLoading(false);
    }
  };
  
  // Ensure payments is always an array before using reduce
  const totalPaid = Array.isArray(payments) 
    ? payments.reduce((sum, payment) => sum + (payment?.paymentAmount || 0), 0)
    : 0;
  const amountDue = saleInvoice.totalAmount - totalPaid;
  const isFullyPaid = amountDue <= 0;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer Payments - Invoice {saleInvoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        
        {/* Payment Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">Invoice Total</Label>
              <div className="text-lg font-bold text-gray-900">
                {formatCurrency(saleInvoice.totalAmount, currency)}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Total Paid</Label>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(totalPaid, currency)}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Amount Due</Label>
              <div className={`text-lg font-bold ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(amountDue, currency)}
                {isFullyPaid && " (Fully Paid)"}
              </div>
            </div>
          </div>
        </div>
        
        {/* Add/Edit Payment Form */}
        {showAddForm && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            {isFullyPaid && (
              <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
                <p className="text-green-800 text-sm">
                  ✅ This invoice is fully paid. You can still edit existing payments if needed.
                </p>
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingPayment ? "Edit Payment" : "Add Payment"}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="paymentAmount" className="text-sm font-medium text-gray-700">
                  Amount <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="paymentAmount"
                  name="paymentAmount"
                  type="number"
                  min="0"
                  max={amountDue}
                  step="0.01"
                  value={formData.paymentAmount}
                  onChange={(e) => handleNumberChange("paymentAmount", e.target.value)}
                  className="mt-1"
                  placeholder={`Max: ${formatCurrency(amountDue, currency)}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum payment: {formatCurrency(amountDue, currency)}
                </p>
              </div>
              
              <div>
                <Label htmlFor="paymentDate" className="text-sm font-medium text-gray-700">
                  Payment Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full mt-1 justify-start text-left font-normal",
                        !formData.paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.paymentDate ? format(formData.paymentDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.paymentDate}
                      onSelect={(date) => handleDateChange("paymentDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700">
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => handleSelectChange("paymentMethod", value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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
              
              <div>
                <Label htmlFor="paymentReference" className="text-sm font-medium text-gray-700">
                  Reference
                </Label>
                <Input
                  id="paymentReference"
                  name="paymentReference"
                  value={formData.paymentReference}
                  onChange={handleInputChange}
                  className="mt-1"
                  placeholder="Cheque #, Transaction ID, etc."
                />
              </div>
            </div>
            
            <div className="mt-4">
              <Label htmlFor="notes" className="text-sm font-medium text-gray-700">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="mt-1"
                placeholder="Additional payment notes..."
                rows={2}
              />
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? "Saving..." : (editingPayment ? "Update Payment" : "Add Payment")}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {/* Payments Table */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Payment History</h3>
            {!showAddForm && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1"
                disabled={isFullyPaid}
                title={isFullyPaid ? "Invoice is fully paid" : "Add new payment"}
              >
                <Plus className="h-4 w-4" /> Add Payment
              </Button>
            )}
          </div>
          
          {dataLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading payments...</p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-medium text-gray-700">Date</TableHead>
                    <TableHead className="font-medium text-gray-700">Amount</TableHead>
                    <TableHead className="font-medium text-gray-700">Method</TableHead>
                    <TableHead className="font-medium text-gray-700">Reference</TableHead>
                    <TableHead className="font-medium text-gray-700">Notes</TableHead>
                    <TableHead className="font-medium text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(payments) && payments.length > 0 ? (
                    payments.map((payment) => (
                      <TableRow key={payment.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          {format(new Date(payment.paymentDate), "PPP")}
                        </TableCell>
                        <TableCell className="font-mono font-medium text-green-600">
                          {formatCurrency(payment.paymentAmount, currency)}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">{payment.paymentMethod.replace('_', ' ')}</span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.paymentReference || "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {payment.notes || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(payment)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(payment.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !dataLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No payments recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
