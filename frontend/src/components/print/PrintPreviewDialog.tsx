import React, { useMemo, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import type { SaleInvoice } from '@/types/sale-invoice';
import type { SalesOrder } from '@/types/sales-order';
import type { PurchaseOrder } from '@/types/purchase-order';
import type { GoodsReceiveNote } from '@/types/grn';
import type { CreditNote } from '@/types/credit-note';
import { CustomTemplate, StandardTemplate, SaleInvoiceStandardTemplate, getTitleByType } from './Templates';

type DocumentType = 'saleInvoice' | 'salesOrder' | 'purchaseOrder' | 'grn' | 'creditNote' | 'product';

type PrintPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
};

export function PrintPreviewDialog({ open, onOpenChange, documentType, data }: PrintPreviewDialogProps) {
  const { settings } = useSystemSettings();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const documentTitle = useMemo(() => {
    const suffix = (() => {
      try {
        switch (documentType) {
          case 'saleInvoice':
            return (data as SaleInvoice)?.invoiceNumber || '';
          case 'salesOrder':
            return (data as SalesOrder)?.orderNumber || '';
          case 'purchaseOrder':
            return (data as PurchaseOrder)?.orderNumber || '';
          case 'grn':
            return (data as GoodsReceiveNote)?.grnNumber || '';
          case 'creditNote':
            return (data as CreditNote)?.creditNoteNumber || '';
          case 'product':
            return data?.name || '';
          default:
            return '';
        }
      } catch {
        return '';
      }
    })();
    return `${getTitleByType(documentType)}${suffix ? ` - ${suffix}` : ''}`;
  }, [documentType, data]);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
  });

  // Only Sale Invoice honors the system Default Invoice Format; other modules always use StandardTemplate (generic)
  const templateKey = String(settings?.invoice_format_template || 'standard');
  const TemplateComponent = (() => {
    if (documentType === 'saleInvoice') {
      if (templateKey === 'standard') return (props: any) => <SaleInvoiceStandardTemplate data={props.data} settings={settings as any} />;
      return CustomTemplate;
    }
    return StandardTemplate;
  })();

  // Immediately invoke browser print dialog when opened
  useEffect(() => {
    if (open) {
      // wait a tick for content render
      const id = setTimeout(() => handlePrint?.(), 50);
      return () => clearTimeout(id);
    }
  }, [open, handlePrint]);

  return (
    <div style={{ position: 'fixed', top: -9999, left: -9999 }}>
      <div
        ref={contentRef}
        className="bg-white text-black w-[210mm] min-h-[297mm] p-8"
      >
        {documentType === 'saleInvoice' && templateKey === 'standard' ? (
          <SaleInvoiceStandardTemplate data={data as any} settings={settings as any} />
        ) : (
          // @ts-ignore
          <TemplateComponent documentType={documentType} data={data} settings={settings as any} />
        )}
      </div>
    </div>
  );
}

export default PrintPreviewDialog;


