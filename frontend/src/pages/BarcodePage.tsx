import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Barcode, Download, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BarcodePage = () => {
  // Move all hooks to the top - always call them in the same order
  const [barcodes, setBarcodes] = useState<{ id: string; code: string; label: string; quantity: number }[]>([
    { id: "1", code: "PRD-001", label: "Product One", quantity: 1 },
    { id: "2", code: "PRD-002", label: "Product Two", quantity: 1 },
    { id: "3", code: "PRD-003", label: "Product Three", quantity: 1 },
  ]);

  const [newBarcode, setNewBarcode] = useState({
    code: "",
    label: "",
    quantity: 1,
  });

  const barcodeRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuth();
  const canViewBarcode = hasPermission('barcode_view');
  const canCreateBarcode = hasPermission('barcode_create');
  const canPrintBarcode = hasPermission('barcode_print');

  const handlePrint = useReactToPrint({
    documentTitle: "Barcodes",
    contentRef: barcodeRef,
  });

  // Now do the conditional render after all hooks are called
  if (!canViewBarcode) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Barcode Printing</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view barcode printing. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleAddBarcode = () => {
    if (newBarcode.code && newBarcode.label) {
      setBarcodes([
        ...barcodes,
        {
          id: Date.now().toString(),
          code: newBarcode.code,
          label: newBarcode.label,
          quantity: newBarcode.quantity,
        },
      ]);
      setNewBarcode({ code: "", label: "", quantity: 1 });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Barcode Printing</h1>
        <div className="flex space-x-2">
          {canPrintBarcode ? (
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer size={18} />
            Print Barcodes
          </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-2">
                      <Printer size={18} />
                      Print Barcodes
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to print barcodes
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button variant="outline" className="flex items-center gap-2">
            <Download size={18} />
            Export PDF
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add New Barcode</CardTitle>
            <CardDescription>
              Enter product details to generate a new barcode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form 
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddBarcode();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="code">Product Code</Label>
                <Input
                  id="code"
                  placeholder="Enter product code"
                  value={newBarcode.code}
                  onChange={(e) => setNewBarcode({ ...newBarcode, code: e.target.value })}
                  disabled={!canCreateBarcode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Product Label</Label>
                <Input
                  id="label"
                  placeholder="Enter product label"
                  value={newBarcode.label}
                  onChange={(e) => setNewBarcode({ ...newBarcode, label: e.target.value })}
                  disabled={!canCreateBarcode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newBarcode.quantity}
                  onChange={(e) => setNewBarcode({ ...newBarcode, quantity: parseInt(e.target.value) || 1 })}
                  disabled={!canCreateBarcode}
                />
              </div>
              {canCreateBarcode ? (
                <Button type="submit" className="w-full">
                  <Barcode className="mr-2 h-4 w-4" />
                  Generate Barcode
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="submit" className="w-full" disabled>
                          <Barcode className="mr-2 h-4 w-4" />
                          Generate Barcode
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You do not have permission to create barcodes
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </form>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Barcode Preview</CardTitle>
            <CardDescription>
              Preview and manage barcodes before printing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="max-h-[400px] overflow-auto p-2" ref={barcodeRef}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {barcodes.map((barcode) => (
                    <div 
                      key={barcode.id} 
                      className="flex flex-col items-center border rounded p-4"
                    >
                      <div className="flex items-center justify-center h-16">
                        <Barcode className="h-12 w-full" />
                      </div>
                      <div className="text-center mt-2">
                        <p className="font-mono text-sm">{barcode.code}</p>
                        <p className="text-xs text-gray-500">{barcode.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {barcodes.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setBarcodes([])}
                  className="w-full"
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BarcodePage;
