
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { SalesReport } from "@/components/reports/SalesReport";
import { InventoryReport } from "@/components/reports/InventoryReport";
import { PurchaseReport } from "@/components/reports/PurchaseReport";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState("sales");
  const [dateRange, setDateRange] = useState<DateRange>({ 
    from: new Date(), 
    to: new Date() 
  });
  const [reportFormat, setReportFormat] = useState("table");
  const { hasPermission } = useAuth();
  const canViewReports = hasPermission('reports_view');
  const canExportReports = hasPermission('reports_export');
  
  // If user doesn't have permission to view reports, show access denied
  if (!canViewReports) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view reports. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };
  
  const handleExport = () => {
    if (!canExportReports) {
      console.log("User does not have permission to export reports");
      return;
    }
    console.log(`Exporting ${activeTab} report in ${reportFormat} format for date range:`, dateRange);
    // Implementation would connect to API to generate and download report
  };
  
  return (
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
              <SalesReport dateRange={dateRange} />
            </TabsContent>
            
            <TabsContent value="inventory" className="space-y-4">
              <InventoryReport dateRange={dateRange} />
            </TabsContent>
            
            <TabsContent value="purchases" className="space-y-4">
              <PurchaseReport dateRange={dateRange} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
