import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Search } from "lucide-react";
import { getInventoryTransactions } from "@/lib/api";
import { InventoryTransaction } from "@/types/inventory";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export const InventoryTransactionsTable = () => {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await getInventoryTransactions();
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching inventory transactions:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory transactions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(transaction => 
    (transaction.productName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (transaction.skuCode?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (transaction.transactionType?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (transaction.referenceType?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case "purchase":
        return <Badge className="bg-green-100 text-green-800">Purchase</Badge>;
      case "receipt":
        return <Badge className="bg-green-100 text-green-800">Receipt</Badge>;
      case "sale":
        return <Badge className="bg-red-100 text-red-800">Sale</Badge>;
      case "reservation":
        return <Badge className="bg-orange-100 text-orange-800">Reservation</Badge>;
      case "reservation_release":
        return <Badge className="bg-blue-100 text-blue-800">Reservation Release</Badge>;
      case "return":
        return <Badge className="bg-green-100 text-green-800">Return</Badge>;
      case "scrap":
        return <Badge className="bg-red-100 text-red-800">Scrap</Badge>;
      case "adjustment":
        return <Badge className="bg-blue-100 text-blue-800">Adjustment</Badge>;
      case "transfer":
        return <Badge className="bg-purple-100 text-purple-800">Transfer</Badge>;
      case "initial_stock":
        return <Badge className="bg-gray-100 text-gray-800">Initial Stock</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{type}</Badge>;
    }
  };

  const getQuantityChangeDisplay = (quantityChange: number) => {
    const isPositive = quantityChange > 0;
    return (
      <span className={isPositive ? "text-green-600" : "text-red-600"}>
        {isPositive ? "+" : ""}{quantityChange}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
            disabled
          />
        </div>
        
        <div className="flex items-center justify-center h-32">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity Change</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(new Date(transaction.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                  <TableCell className="font-medium">{transaction.productName || 'N/A'}</TableCell>
                  <TableCell>{transaction.skuCode || 'N/A'}</TableCell>
                  <TableCell>{getTransactionTypeBadge(transaction.transactionType)}</TableCell>
                  <TableCell>{getQuantityChangeDisplay(transaction.quantityChange)}</TableCell>
                  <TableCell>
                    {transaction.referenceType && transaction.referenceId ? (
                      <span className="text-sm text-gray-600">
                        {transaction.referenceType}: {transaction.referenceId.slice(0, 8)}...
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {transaction.notes ? (
                      <span className="text-sm text-gray-600">{transaction.notes}</span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  {searchTerm ? "No transactions found matching your search" : "No transactions found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}; 