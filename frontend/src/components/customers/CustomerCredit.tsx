import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerCreditBalance } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";

interface CustomerCreditProps {
  customerId: string;
}

export const CustomerCredit = ({ customerId }: CustomerCreditProps) => {
  const { currency } = useCurrencyStore();
  const [creditBalance, setCreditBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerId) {
      loadCreditBalance();
    }
  }, [customerId]);

  const loadCreditBalance = async () => {
    try {
      setLoading(true);
      const data = await getCustomerCreditBalance(customerId);
      setCreditBalance(data.creditBalance || 0);
    } catch (error) {
      console.error("Error loading credit balance:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit Balance</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="text-2xl font-bold">
            {formatCurrency(creditBalance, currency)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
