import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRightCircle, Printer } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { type SaleQuotation } from "@/types/sale-quotation";
import { useCurrencyStore } from "@/stores/currencyStore";

interface SaleQuotationViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: SaleQuotation | null;
  onConvert?: (q: SaleQuotation) => void;
  onPrint?: (q: SaleQuotation) => void;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export const SaleQuotationView = ({
  open,
  onOpenChange,
  quotation,
  onConvert,
  onPrint,
}: SaleQuotationViewProps) => {
  const { currency } = useCurrencyStore();

  if (!quotation) return null;

  const isExpired =
    quotation.status === "sent" &&
    quotation.validUntil &&
    new Date(quotation.validUntil) < new Date(new Date().toDateString());

  const displayStatus = isExpired ? "expired" : quotation.status;
  const canConvert = quotation.status === "sent" || quotation.status === "accepted";
  const alreadyConverted = !!quotation.salesOrderId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              Quotation — {quotation.quotationNumber}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onPrint && quotation.status !== "draft" && (
                <Button variant="outline" size="sm" onClick={() => onPrint(quotation)}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              )}
              {onConvert && canConvert && !alreadyConverted && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => onConvert(quotation)}
                >
                  <ArrowRightCircle className="h-4 w-4 mr-1" /> Convert to Sale Order
                </Button>
              )}
              {alreadyConverted && (
                <Badge className="bg-green-100 text-green-800 border-0">
                  ✓ Converted to Sale Order
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Meta info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground font-medium">Customer</p>
              <p className="font-semibold">{quotation.customer?.name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Date</p>
              <p>{quotation.quotationDate ? formatDate(quotation.quotationDate) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Valid Until</p>
              <p className={isExpired ? "text-orange-600 font-semibold" : ""}>
                {quotation.validUntil ? formatDate(quotation.validUntil) : "—"}
                {isExpired && " (Expired)"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground font-medium">Status</p>
              <span
                className={`inline-block capitalize px-2 py-1 rounded-full text-xs font-medium ${
                  statusColors[displayStatus] || "bg-gray-100 text-gray-800"
                }`}
              >
                {displayStatus}
              </span>
            </div>
          </div>

          <Separator />

          {/* Items table */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Items</h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(quotation.items || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                        No items.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (quotation.items || []).map((item, idx) => (
                      <TableRow key={item.id || idx}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.skuCode}</TableCell>
                        <TableCell className="text-right">
                          {item.quantity} {item.unitAbbreviation}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice, currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.discount, currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.tax, currency)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.total, currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(quotation.subtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span>- {formatCurrency(quotation.discountAmount, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(quotation.taxAmount, currency)}</span>
              </div>
              {quotation.roundingAdjustment !== 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rounding</span>
                  <span>{formatCurrency(quotation.roundingAdjustment ?? 0, currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(quotation.totalAmount, currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes & T&C */}
          {(quotation.notes || quotation.termsConditions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {quotation.notes && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}
              {quotation.termsConditions && (
                <div>
                  <p className="text-muted-foreground font-medium mb-1">Terms & Conditions</p>
                  <p className="whitespace-pre-wrap">{quotation.termsConditions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
