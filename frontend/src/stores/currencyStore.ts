
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CurrencyState {
  currency: string;
  setCurrency: (currency: string) => void;
  getCurrencySymbol: () => string;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: "INR", // Default currency set to INR as per requirements
      setCurrency: (currency) => set({ currency }),
      getCurrencySymbol: () => {
        const currencyMap: Record<string, string> = {
          "INR": "₹",
          "USD": "$",
          "EUR": "€",
          "GBP": "£",
          "JPY": "¥",
          "AUD": "A$",
          "CAD": "C$",
          "CHF": "CHF",
          "CNY": "¥",
          "SGD": "S$",
        };
        return currencyMap[get().currency] || "₹";
      }
    }),
    {
      name: 'currency-settings',
    }
  )
);
