/**
 * Utility functions for handling number formatting and precision issues
 */

/**
 * Format a tax rate with proper precision, removing floating-point artifacts
 * @param rate - The tax rate as a number
 * @returns Formatted rate string without trailing zeros
 */
export const formatTaxRate = (rate: number): string => {
  // Round to 2 decimal places to avoid floating point precision issues
  const rounded = Math.round(rate * 100) / 100;
  // Format and remove trailing zeros
  return rounded.toFixed(2).replace(/\.?0+$/, '');
};

/**
 * Format a percentage with proper precision
 * @param value - The percentage value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return rounded.toFixed(decimals).replace(/\.?0+$/, '');
};

/**
 * Round a number to specified decimal places, avoiding floating-point issues
 * @param value - The number to round
 * @param decimals - Number of decimal places (default: 2)
 * @returns Rounded number
 */
export const roundToDecimals = (value: number, decimals: number = 2): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Format currency with proper precision
 * @param amount - The amount to format
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number, 
  currency: string = 'USD', 
  locale: string = 'en-US'
): string => {
  const rounded = roundToDecimals(amount, 2);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(rounded);
};
