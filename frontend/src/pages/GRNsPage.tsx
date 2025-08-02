
import { useState } from "react";
import { GRNTable } from "@/components/grn/GRNTable";
import { GRNDialog } from "@/components/grn/GRNDialog";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type GoodsReceiveNote } from "@/types/grn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionGuard } from "@/components/ui/permission-guard";

// Sample data for demonstration
const sampleGrns: GoodsReceiveNote[] = [
  {
    id: "1",
    grnNumber: "GRN-0001",
    purchaseOrderId: "1",
    purchaseOrder: {
      id: "1",
      orderNumber: "PO-0001",
      supplierId: "1",
      supplier: {
        id: "1",
        name: "Supplier One",
        contactName: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Street",
        taxId: "TX1234",
        paymentTerms: "Net 30",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      orderDate: new Date(),
      expectedDeliveryDate: new Date(),
      status: "approved",
      subtotal: 1000,
      taxAmount: 100,
      discountAmount: 0,
      totalAmount: 1100,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    receivedDate: new Date(),
    status: "completed",
    receivedBy: "Store Manager",
    subtotal: 1000,
    taxAmount: 100,
    totalAmount: 1100,
    notes: "All items received in good condition",
    items: [
      {
        id: "1",
        grnId: "1",
        purchaseOrderItemId: "1",
        productId: "1",
        productName: "Product One",
        skuCode: "PRD-001",
        quantityOrdered: 10,
        quantityReceived: 10,
        unitCost: 100,
        total: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    grnNumber: "GRN-0002",
    purchaseOrderId: "2",
    purchaseOrder: {
      id: "2",
      orderNumber: "PO-0002",
      supplierId: "1",
      supplier: {
        id: "1",
        name: "Supplier One",
        contactName: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Street",
        taxId: "TX1234",
        paymentTerms: "Net 30",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      orderDate: new Date(),
      expectedDeliveryDate: new Date(),
      status: "pending",
      subtotal: 500,
      taxAmount: 50,
      discountAmount: 0,
      totalAmount: 550,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    receivedDate: new Date(),
    status: "partial",
    receivedBy: "Warehouse Manager",
    subtotal: 300,
    taxAmount: 30,
    totalAmount: 330,
    notes: "Partial delivery, waiting for remaining items",
    items: [
      {
        id: "2",
        grnId: "2",
        purchaseOrderItemId: "2",
        productId: "2",
        productName: "Product Two",
        skuCode: "PRD-002",
        quantityOrdered: 5,
        quantityReceived: 3,
        unitCost: 100,
        total: 300,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export default function GRNsPage() {
  const [data, setData] = useState<GoodsReceiveNote[]>(sampleGrns);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GoodsReceiveNote | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const canCreateGRN = hasPermission('grn_create');
  const canEditGRN = hasPermission('grn_edit');
  const canDeleteGRN = hasPermission('grn_delete');

  const handleAddNew = () => {
    setSelectedGrn(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (grn: GoodsReceiveNote) => {
    setSelectedGrn(grn);
    setDialogOpen(true);
  };

  const handleView = (grn: GoodsReceiveNote) => {
    // For now, view is the same as edit but we could make it read-only
    setSelectedGrn(grn);
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDeleteId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (itemToDeleteId) {
      setData(data.filter((item) => item.id !== itemToDeleteId));
      toast({
        title: "Success",
        description: "Goods receive note deleted successfully",
      });
      setDeleteDialogOpen(false);
      setItemToDeleteId(null);
    }
  };

  const handleSave = (grn: Partial<GoodsReceiveNote>) => {
    if (selectedGrn) {
      // Update existing GRN
      setData(data.map((item) => (item.id === selectedGrn.id ? { ...item, ...grn } : item)));
      toast({
        title: "Success",
        description: "Goods receive note updated successfully",
      });
    } else {
      // Create new GRN
      const newGrn: GoodsReceiveNote = {
        id: Date.now().toString(),
        grnNumber: grn.grnNumber || "",
        receivedDate: grn.receivedDate || new Date(),
        status: grn.status || "pending",
        receivedBy: grn.receivedBy || "",
        subtotal: grn.subtotal || 0,
        taxAmount: grn.taxAmount || 0,
        totalAmount: grn.totalAmount || 0,
        notes: grn.notes,
        items: grn.items || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setData([...data, newGrn]);
      toast({
        title: "Success",
        description: "Goods receive note created successfully",
      });
    }
  };

  return (
    <PermissionGuard 
      requiredPermission="grn_view"
      fallbackMessage="You do not have permission to view goods receive notes. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Goods Receive Notes</h1>
          {canCreateGRN ? (
            <Button onClick={handleAddNew} className="flex items-center gap-2">
              <PlusCircle size={18} />
              New GRN
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button disabled className="flex items-center gap-2">
                      <PlusCircle size={18} />
                      New GRN
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  You do not have permission to create GRNs
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <GRNTable
          grns={data}
          onView={handleView}
          onEdit={canEditGRN ? handleEdit : undefined}
          onDelete={canDeleteGRN ? handleDeleteClick : undefined}
          canEdit={canEditGRN}
          canDelete={canDeleteGRN}
        />

        <GRNDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          grn={selectedGrn}
          onSave={handleSave}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                goods receive note and all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
