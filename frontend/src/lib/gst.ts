/**
 * Indian GST Utilities
 *
 * Intra-state (company state == party state): CGST + SGST (each = 50% of tax)
 * Inter-state (company state != party state): IGST (= 100% of tax)
 */

export type GstType = "CGST_SGST" | "IGST";

/**
 * Normalise a state string for comparison — lower-case, trimmed.
 */
function normaliseState(s?: string | null): string {
  return (s || "").trim().toLowerCase();
}

/**
 * Determine whether a transaction is intra-state or inter-state.
 *
 * @param companyState   - company_state from system settings
 * @param billingState   - party billing address state (customer or supplier)
 * @param shippingState  - party shipping/delivery address state (fallback)
 */
export function determineGstType(
  companyState?: string | null,
  billingState?: string | null,
  shippingState?: string | null
): GstType {
  const cs = normaliseState(companyState);
  // billing takes priority, fall back to shipping
  const partyState = normaliseState(billingState) || normaliseState(shippingState);

  // If company state is not configured, default to IGST to be safe
  if (!cs || !partyState) return "IGST";

  return cs === partyState ? "CGST_SGST" : "IGST";
}

export interface GstBreakup {
  gstType: GstType;
  /** CGST amount (half of taxAmount when intra-state, else 0) */
  cgstAmount: number;
  /** SGST amount (half of taxAmount when intra-state, else 0) */
  sgstAmount: number;
  /** IGST amount (full taxAmount when inter-state, else 0) */
  igstAmount: number;
}

/**
 * Compute CGST / SGST / IGST amounts from the total taxAmount.
 */
export function computeGstBreakup(taxAmount: number, gstType: GstType): GstBreakup {
  const tax = Number(taxAmount) || 0;
  if (gstType === "CGST_SGST") {
    const half = Math.round((tax / 2) * 100) / 100;
    // Handle odd paise: SGST gets the remainder
    const cgst = half;
    const sgst = Math.round((tax - half) * 100) / 100;
    return { gstType, cgstAmount: cgst, sgstAmount: sgst, igstAmount: 0 };
  }
  return { gstType, cgstAmount: 0, sgstAmount: 0, igstAmount: tax };
}

/**
 * Helper: derive GST type for a **customer** document (sale flow).
 */
export function customerGstType(
  companyState: string | undefined,
  customer: { billingAddress?: { state?: string } | null; shippingAddress?: { state?: string } | null } | null | undefined
): GstType {
  return determineGstType(
    companyState,
    customer?.billingAddress?.state,
    customer?.shippingAddress?.state
  );
}

/**
 * Helper: derive GST type for a **supplier** document (purchase flow).
 */
export function supplierGstType(
  companyState: string | undefined,
  supplier: { billingAddress?: { state?: string } | null; shippingAddress?: { state?: string } | null } | null | undefined
): GstType {
  return determineGstType(
    companyState,
    supplier?.billingAddress?.state,
    supplier?.shippingAddress?.state
  );
}

/**
 * Convenience: get the effective tax rate label for a given GST type.
 * @param totalRatePct  - e.g. 18 for 18% GST
 */
export function gstRateLabel(totalRatePct: number, gstType: GstType): string {
  if (gstType === "CGST_SGST") {
    const half = totalRatePct / 2;
    return `CGST ${half}% + SGST ${half}%`;
  }
  return `IGST ${totalRatePct}%`;
}
