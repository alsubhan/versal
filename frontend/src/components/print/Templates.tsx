import React, { useMemo } from 'react';
import type { SaleInvoice } from '@/types/sale-invoice';
import type { SalesOrder } from '@/types/sales-order';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { GoodsReceiveNote } from '@/types/grn';
import type { CreditNote } from '@/types/credit-note';
import { cn } from '@/lib/utils';

export type DocumentType = 'saleInvoice' | 'salesOrder' | 'purchaseOrder' | 'grn' | 'creditNote' | 'product';

export function getTitleByType(type: DocumentType) {
  switch (type) {
    case 'saleInvoice':
      return 'Invoice';
    case 'salesOrder':
      return 'Sales Order';
    case 'purchaseOrder':
      return 'Purchase Order';
    case 'grn':
      return 'Goods Receive Note';
    case 'creditNote':
      return 'Credit Note';
    case 'product':
      return 'Product Details';
    default:
      return 'Document';
  }
}

export function Header({ settings, title, decorated = false }: { settings: Record<string, any>; title: string; decorated?: boolean }) {
  const includeLogo = settings?.include_company_logo !== false;
  const companyName = settings?.company_name || 'Your Company Name';
  const logoUrl = settings?.company_logo_url || settings?.companyLogoUrl || settings?.logo_url || settings?.logoUrl || '/placeholder.svg';

  const addressParts = [
    settings?.company_address,
    settings?.company_city,
    settings?.company_state,
    settings?.company_zip,
    settings?.company_country,
  ].filter(Boolean);
  const companyAddress = addressParts.join(', ');
  const companyPhone = settings?.company_phone || '';
  const companyEmail = settings?.company_email || '';

  return (
    <div className="flex items-start justify-between gap-6 pb-3">
      <div className="flex items-center gap-4">
        {includeLogo && (
          <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
        )}
        <div>
          <div className="text-xl font-bold leading-tight">{companyName}</div>
          {companyAddress && <div className="text-xs text-muted-foreground">{companyAddress}</div>}
          {(companyPhone || companyEmail) && (
            <div className="text-xs text-muted-foreground">
              {companyPhone && <span>Voice: {companyPhone}</span>}
              {companyPhone && companyEmail && <span className="mx-1">•</span>}
              {companyEmail && <span>E-mail: {companyEmail}</span>}
            </div>
          )}
          {/* Accents removed from header as per spec */}
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl italic font-semibold tracking-wide">{title}</div>
      </div>
    </div>
  );
}

export function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex text-sm', className)}>
      <div className="w-36 text-muted-foreground">{label}</div>
      <div className="flex-1 font-medium">{value}</div>
    </div>
  );
}

export function Money({ value, currency }: { value: number | undefined; currency: string }) {
  const amt = typeof value === 'number' ? value : 0;
  try {
    return <>{new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amt)}</>;
  } catch {
    return <>{amt.toFixed(2)}</>;
  }
}

export function StandardTemplate({
  documentType,
  data,
  settings,
}: {
  documentType: DocumentType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  settings: Record<string, any>;
}) {
  const currency = settings?.default_currency || 'INR';
  const title = getTitleByType(documentType);

  const partyBlock = useMemo(() => {
    const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString() : '');
    switch (documentType) {
      case 'saleInvoice': {
        const inv = (data ?? {}) as Partial<SaleInvoice>;
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Row label="Invoice #" value={inv?.invoiceNumber || ''} />
              <Row label="Invoice Date" value={fmtDate(inv?.invoiceDate)} />
              {inv?.dueDate && <Row label="Due Date" value={fmtDate(inv?.dueDate)} />}
            </div>
            <div className="space-y-1">
              <Row label="Customer" value={inv?.customer?.name || (inv?.customerId as any) || ''} />
              <Row label="Status" value={inv?.status || ''} />
            </div>
          </div>
        );
      }
      case 'salesOrder': {
        const order = (data ?? {}) as Partial<SalesOrder>;
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Row label="Order #" value={order?.orderNumber || ''} />
              <Row label="Order Date" value={fmtDate(order?.orderDate)} />
            </div>
            <div className="space-y-1">
              <Row label="Customer" value={order?.customer?.name || (order?.customerId as any) || ''} />
              <Row label="Status" value={order?.status || ''} />
            </div>
          </div>
        );
      }
      case 'purchaseOrder': {
        const po = (data ?? {}) as Partial<PurchaseOrder>;
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Row label="PO #" value={po?.orderNumber || ''} />
              <Row label="Order Date" value={fmtDate(po?.orderDate)} />
              {po?.expectedDeliveryDate && (
                <Row label="Expected" value={fmtDate(po?.expectedDeliveryDate)} />
              )}
            </div>
            <div className="space-y-1">
              <Row label="Supplier" value={po?.supplier?.name || (po?.supplierId as any) || ''} />
              <Row label="Status" value={po?.status || ''} />
            </div>
          </div>
        );
      }
      case 'grn': {
        const grn = (data ?? {}) as Partial<GoodsReceiveNote>;
        const supplierName = (grn?.supplier && (grn.supplier as any).name)
          || (grn?.purchaseOrder && (grn.purchaseOrder as any)?.supplier?.name)
          || '';
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Row label="GRN #" value={grn?.grnNumber || ''} />
              <Row label="Received Date" value={fmtDate(grn?.receivedDate)} />
              {grn?.vendorInvoiceNumber && <Row label="Vendor Invoice" value={grn?.vendorInvoiceNumber} />}
            </div>
            <div className="space-y-1">
              <Row label="Supplier" value={supplierName} />
              <Row label="PO #" value={grn?.purchaseOrder?.orderNumber || (grn?.purchaseOrderId as any) || ''} />
              <Row label="Status" value={grn?.status || ''} />
            </div>
          </div>
        );
      }
      case 'creditNote': {
        const cn = (data ?? {}) as Partial<CreditNote>;
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Row label="Credit Note #" value={cn?.creditNoteNumber || ''} />
              <Row label="Date" value={fmtDate(cn?.creditDate)} />
            </div>
            <div className="space-y-1">
              <Row label="Customer" value={cn?.customer?.name || (cn?.customerId as any) || ''} />
              <Row label="Status" value={cn?.status || ''} />
            </div>
          </div>
        );
      }
      case 'product': {
        const p = (data ?? {}) as { name?: string; sku_code?: string; hsn_code?: string; description?: string; sale_price?: number; cost_price?: number; mrp?: number; categories?: { name: string } };
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <Row label="Product" value={p?.name || ''} />
              {p.sku_code && <Row label="SKU" value={p.sku_code} />}
              {p.hsn_code && <Row label="HSN" value={p.hsn_code} />}
            </div>
            <div className="space-y-1">
              <Row label="Category" value={p?.categories?.name || '-'} />
              <Row label="MRP" value={<Money value={p?.mrp} currency={settings?.default_currency || 'INR'} />} />
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  }, [documentType, data, settings]);

  const itemsSection = useMemo(() => {
    const currency = settings?.default_currency || 'INR';
    const header = (
      <div className="grid grid-cols-12 border-b py-2 text-xs font-semibold">
        <div className="col-span-6">Item</div>
        <div className="col-span-2 text-right">Qty</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">Total</div>
      </div>
    );

    const Line = ({ name, qty, price, total }: { name: string; qty: number; price: number; total: number }) => (
      <div className="grid grid-cols-12 py-1 text-sm">
        <div className="col-span-6 pr-2 break-words">{name}</div>
        <div className="col-span-2 text-right">{qty}</div>
        <div className="col-span-2 text-right"><Money value={price} currency={currency} /></div>
        <div className="col-span-2 text-right"><Money value={total} currency={currency} /></div>
      </div>
    );

    switch (documentType) {
      case 'saleInvoice': {
        const inv = (data ?? {}) as Partial<SaleInvoice>;
        return (
          <div className="space-y-2">
            {header}
            {(inv.items || []).map((it: any, idx: number) => (
              <Line key={it?.id || idx} name={it?.productName || ''} qty={it?.quantity ?? 0} price={it?.unitPrice ?? 0} total={it?.total ?? 0} />
            ))}
          </div>
        );
      }
      case 'salesOrder': {
        const order = (data ?? {}) as Partial<SalesOrder>;
        return (
          <div className="space-y-2">
            {header}
            {(order.items || []).map((it: any, idx: number) => (
              <Line key={it?.id || idx} name={it?.productName || ''} qty={it?.quantity ?? 0} price={it?.unitPrice ?? 0} total={it?.total ?? 0} />
            ))}
          </div>
        );
      }
      case 'purchaseOrder': {
        const po = (data ?? {}) as Partial<PurchaseOrder>;
        return (
          <div className="space-y-2">
            {header}
            {(po.items || []).map((it: any, idx: number) => (
              <Line key={it?.id || idx} name={it?.productName || ''} qty={it?.quantity ?? 0} price={it?.costPrice ?? 0} total={it?.total ?? 0} />
            ))}
          </div>
        );
      }
      case 'grn': {
        const grn = (data ?? {}) as Partial<GoodsReceiveNote>;
        return (
          <div className="space-y-2">
            {header}
            {(grn.items || []).map((it: any, idx: number) => (
              <Line key={it?.id || idx} name={it?.productName || ''} qty={it?.receivedQuantity ?? it?.orderedQuantity ?? 0} price={it?.unitCost ?? 0} total={it?.total ?? 0} />
            ))}
          </div>
        );
      }
      case 'creditNote': {
        const cn = (data ?? {}) as Partial<CreditNote>;
        return (
          <div className="space-y-2">
            {header}
            {(cn.items || []).map((it: any, idx: number) => (
              <Line key={it?.id || idx} name={it?.productName || ''} qty={it?.creditQuantity ?? it?.quantity ?? 0} price={it?.unitPrice ?? 0} total={it?.total ?? 0} />
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  }, [documentType, data, settings]);

  const totalsSection = useMemo(() => {
    const currency = settings?.default_currency || 'INR';
    const row = (label: string, value: number | undefined, bold?: boolean) => (
      <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
        <div>{label}</div>
        <div>
          <Money value={value} currency={currency} />
        </div>
      </div>
    );

    switch (documentType) {
      case 'saleInvoice': {
        const inv = (data ?? {}) as Partial<SaleInvoice>;
        return (
          <div className="space-y-1 w-72 ml-auto">
            {row('Subtotal', inv.subtotal)}
            {row('Discount', inv.discountAmount)}
            {row('Tax', inv.taxAmount)}
            {row('Rounding', inv.roundingAdjustment)}
            {row('Total', inv.totalAmount, true)}
            {row('Amount Due', inv.amountDue, true)}
          </div>
        );
      }
      case 'salesOrder': {
        const order = (data ?? {}) as Partial<SalesOrder>;
        return (
          <div className="space-y-1 w-72 ml-auto">
            {row('Subtotal', order.subtotal)}
            {row('Discount', order.discountAmount)}
            {row('Tax', order.taxAmount)}
            {row('Rounding', order.roundingAdjustment)}
            {row('Total', order.totalAmount, true)}
          </div>
        );
      }
      case 'purchaseOrder': {
        const po = (data ?? {}) as Partial<PurchaseOrder>;
        return (
          <div className="space-y-1 w-72 ml-auto">
            {row('Subtotal', po.subtotal)}
            {row('Discount', po.discountAmount)}
            {row('Tax', po.taxAmount)}
            {row('Rounding', po.roundingAdjustment)}
            {row('Total', po.totalAmount, true)}
          </div>
        );
      }
      case 'grn': {
        const grn = (data ?? {}) as Partial<GoodsReceiveNote>;
        return (
          <div className="space-y-1 w-72 ml-auto">
            {row('Subtotal', grn.subtotal)}
            {row('Discount', grn.discountAmount)}
            {row('Tax', grn.taxAmount)}
            {row('Rounding', grn.roundingAdjustment)}
            {row('Total', grn.totalAmount, true)}
          </div>
        );
      }
      case 'creditNote': {
        const cn = (data ?? {}) as Partial<CreditNote>;
        return (
          <div className="space-y-1 w-72 ml-auto">
            {row('Subtotal', cn.subtotal)}
            {row('Discount', cn.discountAmount)}
            {row('Tax', cn.taxAmount)}
            {row('Rounding', cn.roundingAdjustment)}
            {row('Total', cn.totalAmount, true)}
          </div>
        );
      }
      default:
        return null;
    }
  }, [documentType, data, settings]);

  return (
    <div className="space-y-6">
      <Header settings={settings} title={getTitleByType(documentType)} />
      <div className="space-y-4">
        {partyBlock}
        {itemsSection}
        {totalsSection}
        {'notes' in (data || {}) && data?.notes && (
          <div className="pt-4 text-sm">
            <div className="font-semibold mb-1">Notes</div>
            <div className="whitespace-pre-wrap text-muted-foreground">{data.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sale Invoice Standard template (screenshot-like clean layout)
export function SaleInvoiceStandardTemplate({ data, settings }: { data: Partial<SaleInvoice>; settings: Record<string, any> }) {
  const inv = (data ?? {}) as Partial<SaleInvoice>;
  const currency = settings?.default_currency || 'INR';
  const fmt = (n?: number) => (typeof n === 'number' ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n) : '');
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <div className="text-2xl font-bold">Sale Invoice</div>
          <div className="mt-2 text-sm space-y-1">
            <div>Invoice #: {inv.invoiceNumber || '-'}</div>
            <div>Invoice Date: {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</div>
            <div>Due Date: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</div>
            <div>Status: {inv.status || '-'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">{settings?.company_name || 'Your Company Name'}</div>
          {settings?.company_address && (
            <div className="text-sm text-muted-foreground">{settings.company_address}</div>
          )}
          {(settings?.company_phone || settings?.company_email) && (
            <div className="text-sm text-muted-foreground">
              {settings?.company_phone && <span>{settings.company_phone}</span>}
              {settings?.company_phone && settings?.company_email && <span className="mx-1">•</span>}
              {settings?.company_email && <span>{settings.company_email}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="h-px bg-gray-300" />
      <div>
        <div className="font-semibold mb-2">Customer Information</div>
        <div className="text-sm space-y-1">
          <div>Name: {inv.customer?.name || '-'}</div>
          <div>Email: {(inv as any)?.customer?.email || '-'}</div>
          <div>Phone: {(inv as any)?.customer?.phone || '-'}</div>
          <div className="mt-2 font-medium">Billing Address:</div>
          <div className="whitespace-pre-wrap">
            {(inv as any)?.customer?.billingAddress?.street || ''}
            {((inv as any)?.customer?.billingAddress?.city || (inv as any)?.customer?.billingAddress?.state || (inv as any)?.customer?.billingAddress?.zipCode) && (
              <>
                <br />
                {[(inv as any)?.customer?.billingAddress?.city, (inv as any)?.customer?.billingAddress?.state, (inv as any)?.customer?.billingAddress?.zipCode]
                  .filter(Boolean)
                  .join(', ')}
              </>
            )}
            {(inv as any)?.customer?.billingAddress?.country && <><br />{(inv as any)?.customer?.billingAddress?.country}</>}
          </div>
        </div>
      </div>
      <div>
        <div className="font-semibold mb-2">Invoice Items</div>
        <div className="rounded-md border">
          <div className="grid grid-cols-12 text-sm bg-muted/30">
            <div className="col-span-4 px-3 py-2 border-r">Product Name</div>
            <div className="col-span-2 px-3 py-2 border-r">SKU</div>
            <div className="col-span-2 px-3 py-2 border-r">Quantity</div>
            <div className="col-span-2 px-3 py-2 border-r">Unit Price</div>
            <div className="col-span-2 px-3 py-2">Total</div>
          </div>
          {(inv.items || []).map((it: any, idx: number) => (
            <div className="grid grid-cols-12 text-sm border-t" key={it?.id || idx}>
              <div className="col-span-4 px-3 py-2">{it?.productName || ''}</div>
              <div className="col-span-2 px-3 py-2">{it?.skuCode || ''}</div>
              <div className="col-span-2 px-3 py-2">{it?.quantity ?? 0}</div>
              <div className="col-span-2 px-3 py-2">{fmt(it?.unitPrice)}</div>
              <div className="col-span-2 px-3 py-2">{fmt(it?.total)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-8 justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal:</span><span>{fmt(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span>Discount:</span><span>{fmt(inv.discountAmount)}</span></div>
          <div className="flex justify-between"><span>Tax:</span><span>{fmt(inv.taxAmount)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total:</span><span>{fmt(inv.totalAmount)}</span></div>
          <div className="flex justify-between font-semibold"><span>Amount Due:</span><span>{fmt(inv.amountDue)}</span></div>
        </div>
      </div>
      {inv.notes && (
        <div>
          <div className="font-semibold mb-1">Notes</div>
          <div className="text-sm text-muted-foreground">{inv.notes}</div>
        </div>
      )}
      {settings?.default_invoice_notes && (
        <div className="text-center text-xs text-muted-foreground mt-8">{settings.default_invoice_notes}</div>
      )}
    </div>
  );
}

// Custom template styled to resemble the provided example (rounded blue panels, thin blue borders)
export function CustomTemplate({
  documentType,
  data,
  settings,
}: {
  documentType: DocumentType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  settings: Record<string, any>;
}) {
  const currency = settings?.default_currency || 'INR';
  const gstin = settings?.company_gstin || settings?.gstin || '';

  const BlueBox = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn('rounded-[14px] border border-[#2A42FF] p-3', className)}>{children}</div>
  );

  const ThinBlueLine = () => <div className="h-[2px] bg-[#2A42FF] w-full" />;

  const row = (label: string, value?: React.ReactNode) => (
    <div className="flex text-[11px] leading-4">
      <div className="w-24 text-black font-semibold">{label}</div>
      <div className="flex-1 text-black">{value}</div>
    </div>
  );

  const companyName = settings?.company_name || 'Your Company Name';
  const companyAddress = [
    settings?.company_address,
    settings?.company_city,
    settings?.company_state,
    settings?.company_zip,
    settings?.company_country,
  ].filter(Boolean).join(', ');

  // Bill to/Ship to blocks (merge where not available)
  const billToName = (data?.customer?.name || data?.supplier?.name || data?.customerId || data?.supplierId || '') as string;
  const shipToName = billToName;

  // Item rows
  const items = (() => {
    if (documentType === 'saleInvoice') return (data as SaleInvoice)?.items || [];
    if (documentType === 'salesOrder') return (data as SalesOrder)?.items || [];
    if (documentType === 'purchaseOrder') return (data as PurchaseOrder)?.items || [];
    if (documentType === 'grn') return (data as GoodsReceiveNote)?.items || [];
    if (documentType === 'creditNote') return (data as CreditNote)?.items || [];
    return [];
  })();

  const getQty = (it: any) => it.quantity ?? it.receivedQuantity ?? it.acceptedQuantity ?? 0;
  const getPrice = (it: any) => it.unitPrice ?? it.costPrice ?? it.unitCost ?? 0;
  const getTotal = (it: any) => it.total ?? (getQty(it) * getPrice(it));

  const SubtotalTotal = () => {
    const subtotal = items.reduce((s: number, it: any) => s + (getQty(it) * getPrice(it)), 0);
    const taxAmount = Number(data?.taxAmount || 0);
    const discountAmount = Number(data?.discountAmount || 0);
    const total = Number(data?.totalAmount ?? subtotal - discountAmount + taxAmount);
    const sgst = settings?.sgst_rate ? subtotal * Number(settings.sgst_rate) : undefined;
    const cgst = settings?.cgst_rate ? subtotal * Number(settings.cgst_rate) : undefined;
    const rowSum = (label: string, val?: number) => (
      <div className="grid grid-cols-2 text-[11px]">
        <div className="text-right pr-2 font-semibold">{label}</div>
        <div className="text-right"><Money value={val} currency={currency} /></div>
      </div>
    );
    return (
      <div className="w-64 ml-auto border border-[#2A42FF]">
        <div className="bg-[#7FEFF3] p-1">
          {rowSum('Subtotal', subtotal)}
        </div>
        {sgst !== undefined && <div className="p-1">{rowSum('SGST', sgst)}</div>}
        {cgst !== undefined && <div className="p-1">{rowSum('CGST', cgst)}</div>}
        <div className="p-1">{rowSum('Tax', taxAmount)}</div>
        <div className="p-1">{rowSum('Discount', discountAmount)}</div>
        <div className="bg-[#7FEFF3] p-1 font-bold">
          {rowSum('Total', total)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Top heading and company */}
      <Header settings={settings} title="" />

      {gstin && (
        <div className="text-[11px] font-semibold mt-1">GSTIN : {gstin}</div>
      )}

      {/* Accents above the two boxes with TAX INVOICE inset, 70% to the right */}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-[5.5]">
          <div className="h-[3px] bg-[#2A42FF]" />
          <div className="h-[2px] bg-[#112A8F] mt-[3px]" />
        </div>
        <div className="px-3 text-3xl italic font-extrabold text-gray-700 whitespace-nowrap select-none">TAX INVOICE</div>
        <div className="flex-1">
          <div className="h-[3px] bg-[#2A42FF]" />
          <div className="h-[2px] bg-[#112A8F] mt-[3px]" />
        </div>
      </div>

      {/* Bill to / Meta */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <BlueBox>
          <div className="text-[12px] font-bold mb-1">Bill To</div>
          {row('Name', billToName)}
          {row('Address', companyAddress)}
          {row('City', settings?.company_city)}
          {row('GSTIN', gstin)}
          <div className="mt-2 text-[12px] font-bold">Ship To</div>
          {row('Name', shipToName)}
          {row('Address', settings?.company_address)}
        </BlueBox>
        <BlueBox>
          {row('Date', (data?.invoiceDate || data?.orderDate || data?.receivedDate) ? new Date(data.invoiceDate || data.orderDate || data.receivedDate).toLocaleDateString() : '')}
          {row('PO No.', data?.purchaseOrder?.orderNumber || data?.purchaseOrderId || '')}
          {row('Invoice No.', data?.invoiceNumber || data?.orderNumber || data?.grnNumber || data?.creditNoteNumber || '')}
          {row('Terms of Payment', '')}
        </BlueBox>
      </div>

      {/* Items table */}
      <div className="border border-[#2A42FF]">
        <div className="grid grid-cols-12 text-[12px] font-semibold border-b border-black">
          <div className="col-span-2 px-2 py-1 border-r border-black">HSN</div>
          <div className="col-span-6 px-2 py-1 border-r border-black">Description</div>
          <div className="col-span-1 px-2 py-1 text-right border-r border-black">Qty</div>
          <div className="col-span-1 px-2 py-1 text-right border-r border-black">Rate</div>
          <div className="col-span-2 px-2 py-1 text-right">Amount</div>
        </div>
        {items.map((it: any, idx: number) => (
          <div className="grid grid-cols-12 text-[12px]" key={it?.id || idx}>
            <div className="col-span-2 px-2 py-1 border-r border-black">{it?.hsnCode || it?.hsn_code || ''}</div>
            <div className="col-span-6 px-2 py-1 border-r border-black">{it?.productName || ''}</div>
            <div className="col-span-1 px-2 py-1 text-right border-r border-black">{getQty(it)}</div>
            <div className="col-span-1 px-2 py-1 text-right border-r border-black">{getPrice(it).toFixed(2)}</div>
            <div className="col-span-2 px-2 py-1 text-right">{getTotal(it).toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Amount in words and totals */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <BlueBox>
          <div className="text-[12px] font-bold mb-1">Amount in words</div>
          <div className="text-[12px]">{amountInWordsLine(settings, data, documentType)}</div>
        </BlueBox>
        <SubtotalTotal />
      </div>

      <div className="text-[12px] text-right mt-8">
        <div>For {companyName}</div>
        <br />
        <br />
        <div>Authorised Signatory</div>
      </div>
      <div className="mt-4">
        <div className="h-[3px] bg-[#2A42FF]" />
        <div className="h-[2px] bg-[#112A8F] mt-[3px]" />
      </div>
      <div className="text-center text-[12px] text-red-600 font-semibold mt-1">{String(settings?.default_invoice_notes || 'Subject to Bangalore Jurisdiction Only')}</div>
    </div>
  );
}

// Helpers
function amountInWordsLine(settings: any, data: any, documentType: DocumentType) {
  const currency = settings?.default_currency || 'INR';
  const label = currency === 'INR' ? 'Rupees' : currency;
  const amount = (() => {
    if (documentType === 'saleInvoice') return data?.totalAmount;
    if (documentType === 'salesOrder') return data?.totalAmount;
    if (documentType === 'purchaseOrder') return data?.totalAmount;
    if (documentType === 'grn') return data?.totalAmount;
    if (documentType === 'creditNote') return data?.totalAmount;
    return undefined;
  })();
  return `${label} : ${amount ? numberToWords(amount, currency) : ''}`;
}

function numberToWords(amount: number, currency: string) {
  // Robust integer-to-words converter with decimals for INR and general currencies
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]; 
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]; 

  const toWords999 = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`;
    const h = Math.floor(n / 100);
    const r = n % 100;
    return `${ones[h]} Hundred${r ? ' ' + toWords999(r) : ''}`;
  };

  // Indian numbering system groups
  const indianGroups = (n: number): string => {
    if (n === 0) return 'Zero';
    let words: string[] = [];
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const rest = n;
    if (crore) words.push(`${toWords999(crore)} Crore`);
    if (lakh) words.push(`${toWords999(lakh)} Lakh`);
    if (thousand) words.push(`${toWords999(thousand)} Thousand`);
    if (rest) words.push(`${toWords999(rest)}`);
    return words.join(' ');
  };

  const westernGroups = (n: number): string => {
    if (n === 0) return 'Zero';
    let words: string[] = [];
    const billion = Math.floor(n / 1_000_000_000); n %= 1_000_000_000;
    const million = Math.floor(n / 1_000_000); n %= 1_000_000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    const rest = n;
    if (billion) words.push(`${toWords999(billion)} Billion`);
    if (million) words.push(`${toWords999(million)} Million`);
    if (thousand) words.push(`${toWords999(thousand)} Thousand`);
    if (rest) words.push(`${toWords999(rest)}`);
    return words.join(' ');
  };

  const useIndian = currency === 'INR';
  const integer = Math.floor(amount);
  const decimals = Math.round((amount - integer) * 100);
  const integerWords = useIndian ? indianGroups(integer) : westernGroups(integer);
  const decimalLabel = useIndian ? 'Paise' : 'Cents';
  const currencyLabel = useIndian ? 'Rupees' : currency;
  if (decimals > 0) {
    return `${integerWords} ${currencyLabel} and ${toWords999(decimals)} ${decimalLabel} only`;
  }
  return `${integerWords} ${currencyLabel} only`;
}


