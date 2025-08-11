
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { SalesReport } from "@/components/reports/SalesReport";
import { InventoryReport } from "@/components/reports/InventoryReport";
import { PurchaseReport } from "@/components/reports/PurchaseReport";
import { useAuth } from "@/hooks/useAuth";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { toast } from "sonner";

interface DateRange {
  from: Date;
  to: Date;
}

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState("sales");
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to: today };
  });
  const [reportFormat, setReportFormat] = useState("table");
  const { hasPermission } = useAuth();
  const canExportReports = hasPermission('reports_export');
  const dataProviderRef = useRef<null | (() => { title: string; columns: { key: string; label: string }[]; rows: any[] })>(null);
  
  const registerDataProvider = (provider: () => { title: string; columns: { key: string; label: string }[]; rows: any[] }) => {
    dataProviderRef.current = provider;
  };
  
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };
  
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const generateCSV = (title: string, columns: { key: string; label: string }[], rows: any[]) => {
    const header = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const lines = rows.map(r => columns.map(c => {
      const v = r[c.key];
      const s = v == null ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [header, ...lines].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  };

  const generatePDF = (title: string, columns: { key: string; label: string }[], rows: any[]) => {
    // Client-side printable window; user can save as PDF from print dialog
    const w = window.open('', '_blank');
    if (!w) return;
    const dateRangeText = dateRange.from && dateRange.to ? `${dateRange.from.toDateString()} - ${dateRange.to.toDateString()}` : 'All time';
    const tableHead = `<tr>${columns.map(c => `<th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">${c.label}</th>`).join('')}</tr>`;
    const tableRows = rows.map(r => `<tr>${columns.map(c => `<td style="padding:8px;border-bottom:1px solid #eee">${r[c.key] ?? ''}</td>`).join('')}</tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px} .muted{color:#666;margin:0 0 16px;font-size:12px}
      table{border-collapse:collapse;width:100%;font-size:12px}</style></head>
      <body><h1>${title}</h1><p class="muted">${dateRangeText}</p>
      <table><thead>${tableHead}</thead><tbody>${tableRows}</tbody></table></body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  const handleExport = () => {
    if (reportFormat === 'table') return; // view only
    if (!canExportReports) {
      toast.error('You do not have permission to export reports');
      return;
    }
    const provider = dataProviderRef.current;
    if (!provider) {
      toast.error('No report data available to export');
      return;
    }
    const { title, columns, rows } = provider();
    if (!rows || rows.length === 0) {
      toast.error('Nothing to export');
      return;
    }
    if (reportFormat === 'csv') {
      const blob = generateCSV(title, columns, rows);
      const filename = `${title.replace(/\s+/g, '_').toLowerCase()}_${activeTab}.csv`;
      downloadBlob(blob, filename);
      toast.success('CSV exported');
    } else if (reportFormat === 'pdf') {
      generatePDF(title, columns, rows);
      toast.success('PDF generated');
    }
  };
  
  return (
    <PermissionGuard 
      requiredPermission="reports_view"
      fallbackMessage="You do not have permission to view reports. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker 
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
            
            <Select value={reportFormat} onValueChange={setReportFormat}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">Table View</SelectItem>
                {canExportReports && (
                  <>
                <SelectItem value="pdf">Export PDF</SelectItem>
                <SelectItem value="csv">Export CSV</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            
            <Button onClick={handleExport} disabled={!canExportReports && reportFormat !== "table"}>
              {canExportReports ? "Generate" : "View"}
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Report Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
                <TabsTrigger value="purchases">Purchases</TabsTrigger>
              </TabsList>
              
              <TabsContent value="sales" className="space-y-4">
                <SalesReport dateRange={dateRange} isActive={activeTab === 'sales'} registerDataProvider={registerDataProvider} />
              </TabsContent>
              
              <TabsContent value="inventory" className="space-y-4">
                <InventoryReport dateRange={dateRange} isActive={activeTab === 'inventory'} registerDataProvider={registerDataProvider} />
              </TabsContent>
              
              <TabsContent value="purchases" className="space-y-4">
                <PurchaseReport dateRange={dateRange} isActive={activeTab === 'purchases'} registerDataProvider={registerDataProvider} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
};

export default ReportsPage;
