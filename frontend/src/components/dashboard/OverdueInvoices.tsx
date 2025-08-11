import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOverdueInvoices } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { SaleInvoice } from "@/types/sale-invoice";

export const OverdueInvoices = () => {
  const { currency } = useCurrencyStore();
  const [overdueInvoices, setOverdueInvoices] = useState<SaleInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOverdueInvoices();
  }, []);

  const loadOverdueInvoices = async () => {
    try {
      setLoading(true);
      const data = await getOverdueInvoices();
      setOverdueInvoices(data || []);
    } catch (error) {
      console.error("Error loading overdue invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overdue Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueInvoices.length > 0 ? (
                overdueInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.customer?.name}</TableCell>
                    <TableCell>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ""}</TableCell>
                    <TableCell>{formatCurrency(invoice.amountDue || 0, currency)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No overdue invoices
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
