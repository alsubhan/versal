
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      return "Invalid Date";
    }
    
    return format(dateObj, "MMM dd, yyyy");
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return "Invalid Date";
  }
}

// Rounding utility function that applies system settings
export function applyRounding(
  value: number, 
  roundingMethod: string = 'no_rounding', 
  roundingPrecision: string = '0.01'
): number {
  const precision = parseFloat(roundingPrecision);
  
  if (roundingMethod === 'no_rounding') {
    return value;
  }
  
  // Convert to precision units (e.g., if precision is 0.01, multiply by 100)
  const precisionUnits = 1 / precision;
  const valueInUnits = value * precisionUnits;
  
  let roundedUnits: number;
  
  switch (roundingMethod) {
    case 'nearest':
      roundedUnits = Math.round(valueInUnits);
      break;
    case 'up':
      roundedUnits = Math.ceil(valueInUnits);
      break;
    case 'down':
      roundedUnits = Math.floor(valueInUnits);
      break;
    default:
      return value; // No rounding
  }
  
  // Convert back to original scale
  return roundedUnits / precisionUnits;
}

// Currency formatter with improved support for INR
export function formatCurrency(amount: number, currency: string = "INR"): string {
  const currencyConfig = currencies.find(c => c.code === currency) || currencies[0];
  
  return new Intl.NumberFormat(currencyConfig.locale || 'en-IN', {
    style: 'currency',
    currency: currencyConfig.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Available currencies with INR as default
export const currencies = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-EU" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
];
