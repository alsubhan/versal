
import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { type Category } from "@/types/category";
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Trash } from 'lucide-react';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  onSave?: (category: Partial<Category>) => Promise<void>;
}

export const CategoryDialog: React.FC<CategoryDialogProps> = ({ 
  open, 
  onOpenChange,
  category,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parentId: "",
    isActive: true
  });
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  const { user } = useAuth();
  const userRole = user?.user_metadata?.role;
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (open) {
      setLoadingParents(true);
      apiFetch('/categories')
        .then((data) => {
          setParentCategories(data.filter((cat: Category) => !category || cat.id !== category.id));
          setLoadingParents(false);
        })
        .catch(() => setLoadingParents(false));
    }
  }, [open, category]);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || "",
        parentId: category.parentId || "",
        isActive: category.isActive
      });
    } else {
      setFormData({
        name: "",
        description: "",
        parentId: "",
        isActive: true
      });
    }
  }, [category]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, isActive: checked }));
  };
  
  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, parentId: value === "none" ? null : value }));
  };
  
  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive"
      });
      return;
    }
    
    if (onSave) {
      await onSave(formData);
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Add New Category"}</DialogTitle>
          <DialogDescription>
            {category 
              ? "Update the details of this category" 
              : "Create a new category or subcategory for your products"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input 
              id="name" 
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter category name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of this category"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent Category</Label>
            <Select 
              value={formData.parentId || "none"} 
              onValueChange={handleSelectChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Main Category)</SelectItem>
                {parentCategories.map(parent => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="isActive" 
              checked={formData.isActive}
              onCheckedChange={handleCheckboxChange}
            />
            <Label htmlFor="isActive">Active Category</Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {category ? "Save Changes" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
