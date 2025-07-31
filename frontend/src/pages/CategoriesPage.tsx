
import { useState, useRef } from "react";
import { CategoryTable } from "@/components/categories/CategoryTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CategoryDialog } from "@/components/categories/CategoryDialog";
import { type Category } from "@/types/category";
import { apiFetch } from '@/lib/api';
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CategoriesPage = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
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
    if (editingCategory) {
      // Edit
      await apiFetch(`/categories/${editingCategory.id}`, {
        method: 'PUT',
        body: JSON.stringify(category),
      });
    } else {
      // Add
      await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify(category),
      });
    }
    setIsDialogOpen(false);
    tableRef.current?.refetch();
  };

  return (
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
      <CategoryTable onEdit={handleEditCategory} ref={tableRef} />
      <CategoryDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        category={editingCategory}
        onSave={handleSaveCategory}
      />
    </div>
  );
};

export default CategoriesPage;
