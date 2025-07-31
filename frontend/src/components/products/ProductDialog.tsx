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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { type Category } from "@/types/category";
import { type Tax } from "@/types/tax";
import { type Unit } from "@/types/unit";
import { type Supplier } from "@/types/supplier";

// Mock data fetching - Using consistent data across the app
const fetchCategories = (): Category[] => [
  { id: "1", name: "Electronics", description: "Electronic items", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", name: "Clothing", description: "Clothing items", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", name: "Food & Beverages", description: "Food items", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", name: "Stationery", description: "Office supplies", isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

const fetchSubcategories = (): Record<string, Category[]> => ({
  "1": [
    { id: "101", name: "Mobile Phones", description: "Smartphones", parentId: "1", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "102", name: "Laptops", description: "Portable computers", parentId: "1", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "103", name: "Accessories", description: "Electronic accessories", parentId: "1", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ],
  "2": [
    { id: "201", name: "Men's Wear", description: "Clothing for men", parentId: "2", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "202", name: "Women's Wear", description: "Clothing for women", parentId: "2", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "203", name: "Kids' Wear", description: "Clothing for children", parentId: "2", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ],
  "3": [
    { id: "301", name: "Packaged Foods", description: "Packaged food items", parentId: "3", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "302", name: "Beverages", description: "Drinks", parentId: "3", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "303", name: "Snacks", description: "Light food items", parentId: "3", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ],
  "4": [
    { id: "401", name: "Pens & Pencils", description: "Writing instruments", parentId: "4", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "402", name: "Notebooks", description: "Paper notebooks", parentId: "4", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    { id: "403", name: "Office Supplies", description: "General office items", parentId: "4", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  ],
});

const fetchTaxes = (): Tax[] => [
  { id: "1", name: "GST 5%", rate: 5, isDefault: false, appliedTo: "both", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", name: "GST 12%", rate: 12, isDefault: false, appliedTo: "both", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", name: "GST 18%", rate: 18, isDefault: true, appliedTo: "both", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "4", name: "GST 28%", rate: 28, isDefault: false, appliedTo: "both", isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

const fetchUnits = (): Unit[] => [
  { id: "1", name: "Piece", abbreviation: "Pc", createdAt: new Date(), updatedAt: new Date() },
  { id: "2", name: "Kilogram", abbreviation: "Kg", createdAt: new Date(), updatedAt: new Date() },
  { id: "3", name: "Liter", abbreviation: "L", createdAt: new Date(), updatedAt: new Date() },
  { id: "4", name: "Box", abbreviation: "Box", createdAt: new Date(), updatedAt: new Date() },
  { id: "5", name: "Carton", abbreviation: "Ctn", createdAt: new Date(), updatedAt: new Date() },
];

const fetchSuppliers = (): Supplier[] => [
  { id: "1", name: "ABC Suppliers", contactName: "John Doe", email: "john@abc.com", phone: "1234567890", address: "123 Main St", paymentTerms: "Net 30", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "2", name: "XYZ Distributors", contactName: "Jane Smith", email: "jane@xyz.com", phone: "0987654321", address: "456 Oak Ave", paymentTerms: "Net 15", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "3", name: "123 Traders", contactName: "Bob Johnson", email: "bob@123.com", phone: "5551234567", address: "789 Pine Rd", paymentTerms: "COD", isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

// Define the Product interface to match the expected format
interface Product {
  id: string;
  // Add other fields as needed
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export const ProductDialog: React.FC<ProductDialogProps> = ({ open, onOpenChange, product }) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [availableSubcategories, setAvailableSubcategories] = useState<Array<Category>>([]);
  const { currency } = useCurrencyStore();
  
  // State for tax type selections
  const [saleTaxType, setSaleTaxType] = useState<"inclusive" | "exclusive">("exclusive");
  const [purchaseTaxType, setPurchaseTaxType] = useState<"inclusive" | "exclusive">("exclusive");
  
  // Fetch data from our mock API functions
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, Category[]>>({});
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  useEffect(() => {
    // In a real app, these would be API calls
    setCategories(fetchCategories());
    setSubcategories(fetchSubcategories());
    setTaxes(fetchTaxes());
    setUnits(fetchUnits());
    setSuppliers(fetchSuppliers());
  }, []);
  
  // Update subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      setAvailableSubcategories(subcategories[selectedCategory] || []);
    } else {
      setAvailableSubcategories([]);
    }
  }, [selectedCategory, subcategories]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {product 
              ? "Edit the details of this product."
              : "Create a new product in your inventory. Fill in all required fields."}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="other">Other Details</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skuCode">SKU Code *</Label>
                <Input id="skuCode" placeholder="PRD001" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="eanCode">EAN Code</Label>
                <Input id="eanCode" placeholder="123456789012" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">SKU Name *</Label>
              <Input id="name" placeholder="Product name" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select onValueChange={setSelectedCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select disabled={!selectedCategory}>
                  <SelectTrigger id="subcategory">
                    <SelectValue placeholder={selectedCategory ? "Select subcategory" : "Select a category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubcategories.map(subcategory => (
                      <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Short description of the product"
                className="min-h-20"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier/Vendor</Label>
              <Select>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          
          <TabsContent value="pricing" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price *</Label>
                <Input id="costPrice" type="number" placeholder="0.00" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mrp">MRP *</Label>
                <Input id="mrp" type="number" placeholder="0.00" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="retailPrice">Retail Price *</Label>
                <Input id="retailPrice" type="number" placeholder="0.00" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="wholesalePrice">Wholesale Price *</Label>
                <Input id="wholesalePrice" type="number" placeholder="0.00" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount %</Label>
                <Input id="discount" type="number" placeholder="0" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="saleTax" className="flex items-center justify-between">
                  Sale Tax
                  <span className="text-xs text-gray-500">
                    ({formatCurrency(0, currency)})
                  </span>
                </Label>
                <div className="space-y-2">
                  <Select>
                    <SelectTrigger id="saleTax">
                      <SelectValue placeholder="Select tax" />
                    </SelectTrigger>
                    <SelectContent>
                      {taxes.map(tax => (
                        <SelectItem key={tax.id} value={tax.id}>{tax.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex items-center gap-4 pt-2">
                    <Label className="text-sm font-normal">Tax Type:</Label>
                    <RadioGroup 
                      value={saleTaxType} 
                      onValueChange={(value) => setSaleTaxType(value as "inclusive" | "exclusive")}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="inclusive" id="saleTaxInclusive" />
                        <Label htmlFor="saleTaxInclusive" className="font-normal">Inclusive</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="exclusive" id="saleTaxExclusive" />
                        <Label htmlFor="saleTaxExclusive" className="font-normal">Exclusive</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="purchaseTax" className="flex items-center justify-between">
                Purchase Tax
                <span className="text-xs text-gray-500">
                  ({formatCurrency(0, currency)})
                </span>
              </Label>
              <div className="space-y-2">
                <Select>
                  <SelectTrigger id="purchaseTax">
                    <SelectValue placeholder="Select tax" />
                  </SelectTrigger>
                  <SelectContent>
                    {taxes.map(tax => (
                      <SelectItem key={tax.id} value={tax.id}>{tax.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-4 pt-2">
                  <Label className="text-sm font-normal">Tax Type:</Label>
                  <RadioGroup 
                    value={purchaseTaxType} 
                    onValueChange={(value) => setPurchaseTaxType(value as "inclusive" | "exclusive")}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="inclusive" id="purchaseTaxInclusive" />
                      <Label htmlFor="purchaseTaxInclusive" className="font-normal">Inclusive</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="exclusive" id="purchaseTaxExclusive" />
                      <Label htmlFor="purchaseTaxExclusive" className="font-normal">Exclusive</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="overridePrice" />
              <Label htmlFor="overridePrice">Allow Override Price (while selling)</Label>
            </div>
          </TabsContent>
          
          <TabsContent value="inventory" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name} ({unit.abbreviation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="initialQty">Initial Quantity *</Label>
                <Input id="initialQty" type="number" placeholder="0" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouseRack">Warehouse Rack</Label>
                <Input id="warehouseRack" placeholder="A1-01" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input id="reorderLevel" type="number" placeholder="10" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Unit Conversion</Label>
              <div className="border rounded-md p-4">
                <div className="grid grid-cols-3 gap-4">
                  <Input placeholder="Box" />
                  <span className="flex items-center justify-center">=</span>
                  <Input type="number" placeholder="0" />
                </div>
                <Button variant="outline" size="sm" className="mt-2">
                  + Add Conversion
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="serialized" />
              <Label htmlFor="serialized">Serialized Product (Track each item separately)</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox id="trackInventory" defaultChecked={true} />
              <Label htmlFor="trackInventory">Track Inventory</Label>
            </div>
          </TabsContent>
          
          <TabsContent value="other" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" placeholder="Product brand" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" placeholder="Manufacturer name" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="warrantyPeriod">Warranty Period</Label>
              <div className="flex gap-2">
                <Input id="warrantyPeriod" type="number" placeholder="0" />
                <Select defaultValue="days">
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="productTags" className="flex justify-between">
                Tags
                <span className="text-xs text-gray-500 font-normal">
                  (For searching and filtering products)
                </span>
              </Label>
              <Input id="productTags" placeholder="Enter tags, separated by commas" />
              <p className="text-xs text-gray-500 mt-1">
                Tags help in searching and filtering products. Example: premium, imported, seasonal
              </p>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox id="isActive" defaultChecked />
              <Label htmlFor="isActive">Product Active</Label>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button>{product ? "Save Changes" : "Save Product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
