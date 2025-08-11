
import { useState, useRef } from "react";
import { CategoryTable } from "@/components/categories/CategoryTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { CategoryDialog } from "@/components/categories/CategoryDialog";
import { type Category } from "@/types/category";
import { createCategory, updateCategory } from '@/lib/api';
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PermissionGuard } from "@/components/ui/permission-guard";
import { toast } from "sonner";

const CategoriesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const tableRef = useRef<{ refetch: () => void }>(null);
  const { hasPermission } = useAuth();
  const canCreateCategories = hasPermission('categories_create');

  const handleAddCategory = () => {
    setEditingCategory(null);
    setIsDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  const handleSaveCategory = async (category: Partial<Category>) => {
    try {
      console.log("CategoriesPage - handleSaveCategory called with:", category);
      if (editingCategory) {
        console.log("Updating category with ID:", editingCategory.id);
        await updateCategory(editingCategory.id, category);
        toast.success(`Category "${category.name}" updated successfully`);
      } else {
        console.log("Creating new category");
        await createCategory(category);
        toast.success(`Category "${category.name}" created successfully`);
      }
      setIsDialogOpen(false);
      tableRef.current?.refetch();
    } catch (error: any) {
      console.error('Error saving category:', error);
      if (error.status === 409) {
        toast.error(error.message || 'A category with this name already exists in the same parent category');
      } else {
        toast.error(`Failed to ${editingCategory ? 'update' : 'create'} category`);
      }
      // Don't close dialog or refresh on error
      return;
    }
  };

  return (
    <PermissionGuard 
      requiredPermission="categories_view"
      fallbackMessage="You do not have permission to view categories. Please contact an administrator."
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          {canCreateCategories ? (
        <Button 
          onClick={handleAddCategory}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> Add Category
        </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button 
                    disabled
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Category
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You do not have permission to create categories
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>
      
      <CategoryTable onEdit={handleEditCategory} ref={tableRef} searchTerm={searchTerm} />
      <CategoryDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        category={editingCategory}
        onSave={handleSaveCategory}
      />
      </div>
    </PermissionGuard>
  );
};

export default CategoriesPage;
