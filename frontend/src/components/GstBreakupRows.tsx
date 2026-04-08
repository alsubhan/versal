/**
 * GstBreakupRows
 *
 * Renders CGST+SGST or IGST rows wherever tax is displayed in the UI.
 * Keeps a single source of truth so the look never diverges between
 * dialogs, views, and print templates.
 */

import React from "react";
import type { GstType } from "@/lib/gst";
import { computeGstBreakup } from "@/lib/gst";

interface GstBreakupRowsProps {
  taxAmount: number;
  gstType: GstType;
  /** Total tax rate percentage (e.g. 18 for 18% GST).  Used for label only. */
  taxRatePct?: number;
  /** Function to format currency.  Defaults to toFixed(2). */
  formatCurrency?: (v: number) => string;
  /** Extra className applied to every row wrapper div */
  rowClassName?: string;
  /** If true renders in compact "print" style (no separate label wrapper) */
  compact?: boolean;
}

const defaultFmt = (v: number) => v.toFixed(2);

export function GstBreakupRows({
  taxAmount,
  gstType,
  taxRatePct,
  formatCurrency = defaultFmt,
  rowClassName = "",
  compact = false,
}: GstBreakupRowsProps) {
  const { cgstAmount, sgstAmount, igstAmount } = computeGstBreakup(taxAmount, gstType);

  const halfPct = taxRatePct !== undefined ? taxRatePct / 2 : undefined;
  const cgstLabel = halfPct !== undefined ? `CGST (${halfPct}%)` : "CGST";
  const sgstLabel = halfPct !== undefined ? `SGST (${halfPct}%)` : "SGST";
  const igstLabel = taxRatePct !== undefined ? `IGST (${taxRatePct}%)` : "IGST";

  if (compact) {
    if (gstType === "CGST_SGST") {
      return (
        <>
          <div className={`flex justify-between text-sm ${rowClassName}`}>
            <span>{cgstLabel}</span>
            <span className="font-mono">{formatCurrency(cgstAmount)}</span>
          </div>
          <div className={`flex justify-between text-sm ${rowClassName}`}>
            <span>{sgstLabel}</span>
            <span className="font-mono">{formatCurrency(sgstAmount)}</span>
          </div>
        </>
      );
    }
    return (
      <div className={`flex justify-between text-sm ${rowClassName}`}>
        <span>{igstLabel}</span>
        <span className="font-mono">{formatCurrency(igstAmount)}</span>
      </div>
    );
  }

  // Standard (dialog / view) style
  if (gstType === "CGST_SGST") {
    return (
      <>
        <div className={`flex items-center justify-between ${rowClassName}`}>
          <span className="text-sm text-muted-foreground">{cgstLabel}</span>
          <span className="font-mono font-medium">{formatCurrency(cgstAmount)}</span>
        </div>
        <div className={`flex items-center justify-between ${rowClassName}`}>
          <span className="text-sm text-muted-foreground">{sgstLabel}</span>
          <span className="font-mono font-medium">{formatCurrency(sgstAmount)}</span>
        </div>
      </>
    );
  }

  return (
    <div className={`flex items-center justify-between ${rowClassName}`}>
      <span className="text-sm text-muted-foreground">{igstLabel}</span>
      <span className="font-mono font-medium">{formatCurrency(igstAmount)}</span>
    </div>
  );
}
