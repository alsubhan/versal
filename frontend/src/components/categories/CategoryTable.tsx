import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Edit, Trash, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { type Category, type CategoryWithChildren } from "@/types/category";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface CategoryTableProps {
  onEdit: (category: Category) => void;
}

export const CategoryTable = forwardRef(function CategoryTable(
  { onEdit }: CategoryTableProps,
  ref: React.Ref<{ refetch: () => void }>
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const canEditCategories = hasPermission('categories_edit');
  const canDeleteCategories = hasPermission('categories_delete');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithChildren | null>(null);

  const fetchCategories = () => {
    setLoading(true);
    apiFetch('/categories')
      .then((data) => {
        setCategories(data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useImperativeHandle(ref, () => ({ refetch: fetchCategories }), []);

  useEffect(() => {
    fetchCategories();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleDelete = async (categoryId: string) => {
    try {
      await apiFetch(`/categories/${categoryId}`, { method: 'DELETE' });
      toast({
        title: "Category deleted",
        description: "The category has been successfully deleted.",
      });
      fetchCategories();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };
  
  const confirmDelete = (category: CategoryWithChildren) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };
  const handleConfirmDelete = async () => {
    if (categoryToDelete) {
      await handleDelete(categoryToDelete.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  // Filter categories based on search term (flat search through all levels)
  const filterCategories = (categories: CategoryWithChildren[], term: string): CategoryWithChildren[] => {
    if (!term) return categories;
    return categories.reduce((filtered: CategoryWithChildren[], category) => {
      const matchesSearch = category.name.toLowerCase().includes(term.toLowerCase());
      let filteredChildren: CategoryWithChildren[] = [];
      if (category.children?.length) {
        filteredChildren = filterCategories(category.children, term);
      }
      if (matchesSearch || filteredChildren.length > 0) {
        filtered.push({
          ...category,
          children: filteredChildren.length > 0 ? filteredChildren : category.children
        });
      }
      return filtered;
    }, []);
  };

  const filteredCategories = filterCategories(categories, searchTerm);

  const renderCategoryRows = (categories: CategoryWithChildren[], level = 0) => {
    return categories.flatMap(category => {
      const isExpanded = expandedCategories[category.id];
      const hasChildren = category.children && category.children.length > 0;
      const rows = [
        <TableRow key={category.id}>
          <TableCell className="pl-4">
            <div className="flex items-center" style={{ paddingLeft: `${level * 20}px` }}>
              {hasChildren ? (
                <button 
                  className="mr-2 p-1 rounded-sm hover:bg-gray-100"
                  onClick={() => toggleCategory(category.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6"></div>
              )}
              <span className="font-medium">{category.name}</span>
            </div>
          </TableCell>
          <TableCell>{category.description || '-'}</TableCell>
          <TableCell>{category.parentId ? 'Subcategory' : 'Main Category'}</TableCell>
          <TableCell>
            <Badge 
              variant={category.isActive ? "default" : "secondary"}
              className={category.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}
            >
              {category.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              {canEditCategories ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(category)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You do not have permission to edit categories
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {canDeleteCategories ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => confirmDelete(category)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You do not have permission to delete categories
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </TableCell>
        </TableRow>
      ];
      if (hasChildren && isExpanded) {
        rows.push(...renderCategoryRows(category.children!, level + 1));
      }
      return rows;
    });
  };

  if (loading) {
    // Show skeleton rows for loading state
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead className="w-[30%]">Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCategories.length > 0 ? (
              renderCategoryRows(filteredCategories)
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  No categories found. Add a new category to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
