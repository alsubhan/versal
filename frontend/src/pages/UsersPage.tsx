
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  User, 
  UserPlus, 
  Edit, 
  Trash2, 
  Shield, 
  KeyRound, 
  CheckSquare 
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getUsers, createUser, updateUser, deleteUser, getRoles, createRole, updateRole, deleteRole } from "@/lib/api";

// User type definition
interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Inactive";
  lastLogin: string;
  password?: string;
}

// Permission type
interface Permission {
  id: string;
  name: string;
  description: string;
  module: string;
}

// All available permissions
const allPermissions: Permission[] = [
  // Dashboard permissions
  { id: "dashboard_view", name: "View Dashboard", description: "Can view dashboard", module: "Dashboard" },
  
  // Products permissions
  { id: "products_view", name: "View Products", description: "Can view products", module: "Products" },
  { id: "products_create", name: "Create Products", description: "Can create products", module: "Products" },
  { id: "products_edit", name: "Edit Products", description: "Can edit products", module: "Products" },
  { id: "products_delete", name: "Delete Products", description: "Can delete products", module: "Products" },
  
  // Categories permissions
  { id: "categories_view", name: "View Categories", description: "Can view categories", module: "Categories" },
  { id: "categories_create", name: "Create Categories", description: "Can create categories", module: "Categories" },
  { id: "categories_edit", name: "Edit Categories", description: "Can edit categories", module: "Categories" },
  { id: "categories_delete", name: "Delete Categories", description: "Can delete categories", module: "Categories" },
  
  // Units permissions
  { id: "units_view", name: "View Units", description: "Can view units", module: "Units" },
  { id: "units_create", name: "Create Units", description: "Can create units", module: "Units" },
  { id: "units_edit", name: "Edit Units", description: "Can edit units", module: "Units" },
  { id: "units_delete", name: "Delete Units", description: "Can delete units", module: "Units" },
  
  // Taxes permissions
  { id: "taxes_view", name: "View Taxes", description: "Can view taxes", module: "Taxes" },
  { id: "taxes_create", name: "Create Taxes", description: "Can create taxes", module: "Taxes" },
  { id: "taxes_edit", name: "Edit Taxes", description: "Can edit taxes", module: "Taxes" },
  { id: "taxes_delete", name: "Delete Taxes", description: "Can delete taxes", module: "Taxes" },
  
  // Suppliers permissions
  { id: "suppliers_view", name: "View Suppliers", description: "Can view suppliers", module: "Suppliers" },
  { id: "suppliers_create", name: "Create Suppliers", description: "Can create suppliers", module: "Suppliers" },
  { id: "suppliers_edit", name: "Edit Suppliers", description: "Can edit suppliers", module: "Suppliers" },
  { id: "suppliers_delete", name: "Delete Suppliers", description: "Can delete suppliers", module: "Suppliers" },
  
  // Customers permissions
  { id: "customers_view", name: "View Customers", description: "Can view customers", module: "Customers" },
  { id: "customers_create", name: "Create Customers", description: "Can create customers", module: "Customers" },
  { id: "customers_edit", name: "Edit Customers", description: "Can edit customers", module: "Customers" },
  { id: "customers_delete", name: "Delete Customers", description: "Can delete customers", module: "Customers" },
  
  // Inventory permissions
  { id: "inventory_view", name: "View Inventory", description: "Can view inventory overview", module: "Inventory" },
  { id: "inventory_stock_view", name: "View Stock Overview", description: "Can view stock dashboard and reports", module: "Inventory" },
  { id: "inventory_stock_manage", name: "Manage Stock Levels", description: "Can add, edit, and delete stock levels", module: "Inventory" },
  { id: "inventory_movements_view", name: "View Movements", description: "Can view inventory movements", module: "Inventory" },
  { id: "inventory_movements_create", name: "Create Movements", description: "Can record inventory movements", module: "Inventory" },
  { id: "inventory_locations_view", name: "View Locations", description: "Can view warehouse locations", module: "Inventory" },
  { id: "inventory_locations_manage", name: "Manage Locations", description: "Can add, edit, and delete warehouse locations", module: "Inventory" },
  
  // Purchase Orders permissions
  { id: "purchase_orders_view", name: "View Purchase Orders", description: "Can view purchase orders", module: "Purchase Orders" },
  { id: "purchase_orders_create", name: "Create Purchase Orders", description: "Can create purchase orders", module: "Purchase Orders" },
  { id: "purchase_orders_edit", name: "Edit Purchase Orders", description: "Can edit purchase orders", module: "Purchase Orders" },
  { id: "purchase_orders_delete", name: "Delete Purchase Orders", description: "Can delete purchase orders", module: "Purchase Orders" },
  
  // GRN permissions
  { id: "grn_view", name: "View GRN", description: "Can view good receive notes", module: "Good Receive Notes" },
  { id: "grn_create", name: "Create GRN", description: "Can create good receive notes", module: "Good Receive Notes" },
  { id: "grn_edit", name: "Edit GRN", description: "Can edit good receive notes", module: "Good Receive Notes" },
  { id: "grn_delete", name: "Delete GRN", description: "Can delete good receive notes", module: "Good Receive Notes" },
  
  // Sale Orders permissions
  { id: "sale_orders_view", name: "View Sale Orders", description: "Can view sale orders", module: "Sale Orders" },
  { id: "sale_orders_create", name: "Create Sale Orders", description: "Can create sale orders", module: "Sale Orders" },
  { id: "sale_orders_edit", name: "Edit Sale Orders", description: "Can edit sale orders", module: "Sale Orders" },
  { id: "sale_orders_delete", name: "Delete Sale Orders", description: "Can delete sale orders", module: "Sale Orders" },
  
  // Sale Invoices permissions
  { id: "sale_invoices_view", name: "View Sale Invoices", description: "Can view sale invoices", module: "Sale Invoices" },
  { id: "sale_invoices_create", name: "Create Sale Invoices", description: "Can create sale invoices", module: "Sale Invoices" },
  { id: "sale_invoices_edit", name: "Edit Sale Invoices", description: "Can edit sale invoices", module: "Sale Invoices" },
  { id: "sale_invoices_delete", name: "Delete Sale Invoices", description: "Can delete sale invoices", module: "Sale Invoices" },
  
  // Credit Notes permissions
  { id: "credit_notes_view", name: "View Credit Notes", description: "Can view credit notes", module: "Credit Notes" },
  { id: "credit_notes_create", name: "Create Credit Notes", description: "Can create credit notes", module: "Credit Notes" },
  { id: "credit_notes_edit", name: "Edit Credit Notes", description: "Can edit credit notes", module: "Credit Notes" },
  { id: "credit_notes_delete", name: "Delete Credit Notes", description: "Can delete credit notes", module: "Credit Notes" },
  
  // Reports permissions
  { id: "reports_view", name: "View Reports", description: "Can view reports", module: "Reports" },
  { id: "reports_export", name: "Export Reports", description: "Can export reports", module: "Reports" },
  
  // Barcode permissions
  { id: "barcode_view", name: "View Barcode", description: "Can view barcode printing", module: "Barcode Printing" },
  { id: "barcode_create", name: "Create Barcode", description: "Can create barcodes", module: "Barcode Printing" },
  { id: "barcode_print", name: "Print Barcode", description: "Can print barcodes", module: "Barcode Printing" },
  
  // Backup permissions
  { id: "backup_view", name: "View Backup", description: "Can view backup & restore", module: "Backup & Restore" },
  { id: "backup_create", name: "Create Backup", description: "Can create backups", module: "Backup & Restore" },
  { id: "backup_restore", name: "Restore Backup", description: "Can restore backups", module: "Backup & Restore" },
  
  // User Management permissions
  { id: "users_view", name: "View Users", description: "Can view users", module: "User Management" },
  { id: "users_create", name: "Create Users", description: "Can create users", module: "User Management" },
  { id: "users_edit", name: "Edit Users", description: "Can edit users", module: "User Management" },
  { id: "users_delete", name: "Delete Users", description: "Can delete users", module: "User Management" },
  
  // Role Management permissions
  { id: "roles_view", name: "View Roles", description: "Can view roles and permissions", module: "Role Management" },
  { id: "roles_create", name: "Create Roles", description: "Can create new roles", module: "Role Management" },
  { id: "roles_edit", name: "Edit Roles", description: "Can edit existing roles", module: "Role Management" },
  { id: "roles_delete", name: "Delete Roles", description: "Can delete roles", module: "Role Management" },
  
  // Settings permissions
  { id: "settings_view", name: "View Settings", description: "Can view settings", module: "Settings" },
  { id: "settings_edit", name: "Edit Settings", description: "Can edit settings", module: "Settings" },
];

// Role definition interface
interface Role {
  name: string;
  description: string;
  permissions: string[];
}

const UsersPage = () => {
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const canManageUsers = hasPermission('users_manage') || hasPermission('users_create') || hasPermission('users_edit') || hasPermission('users_delete');
  const canCreateUsers = hasPermission('users_create');
  const canEditUsers = hasPermission('users_edit');
  const canDeleteUsers = hasPermission('users_delete');
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState("users");
  const [loading, setLoading] = useState(false);
  
  // User dialog state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("Active");
  
  // Role dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  
  // Confirmation dialogs state
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [deleteRoleDialogOpen, setDeleteRoleDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  
  // Group permissions by module
  const groupedPermissions = allPermissions.reduce((acc, permission) => {
    if (!acc[permission.module]) {
      acc[permission.module] = [];
    }
    acc[permission.module].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Fetch users and roles from API
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const confirmDeleteUser = (user: UserData) => {
    setUserToDelete(user);
    setDeleteUserDialogOpen(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (userToDelete) {
      try {
        await deleteUser(userToDelete.id);
        toast({
          title: "User deleted",
          description: "The user has been successfully deleted."
        });
        fetchUsers();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
      setDeleteUserDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const confirmDeleteRole = (role: Role) => {
    setRoleToDelete(role);
    setDeleteRoleDialogOpen(true);
  };

  const handleConfirmDeleteRole = async () => {
    if (roleToDelete) {
      try {
        await deleteRole(roleToDelete.name);
        toast({
          title: "Role deleted",
          description: "The role has been successfully deleted."
        });
        fetchRoles();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
      setDeleteRoleDialogOpen(false);
      setRoleToDelete(null);
    }
  };
  
  const handleEditUser = (user: UserData) => {
    setCurrentUser(user);
    setSelectedRole(user.role);
    setSelectedStatus(user.status);
    setUserDialogOpen(true);
  };
  
  const handleAddUser = () => {
    setCurrentUser(null);
    setSelectedRole("");
    setSelectedStatus("Active");
    setUserDialogOpen(true);
  };
  
  const handleSaveUser = async (userData: UserData) => {
    try {
      if (currentUser) {
        // Update existing user
        await updateUser(currentUser.id, userData);
        toast({
          title: "User updated",
          description: "The user has been successfully updated."
        });
      } else {
        // Add new user
        await createUser(userData);
        toast({
          title: "User created",
          description: "The new user has been successfully created."
        });
      }
      setUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  const handleAddRole = () => {
    setCurrentRole(null);
    setSelectedPermissions([]); // Reset selected permissions for new role
    setRoleDialogOpen(true);
  };
  
  const handleEditRole = (role: Role) => {
    setCurrentRole(role);
    setSelectedPermissions(role.permissions); // Set selected permissions for editing
    setRoleDialogOpen(true);
  };
  
  const handleSaveRole = async (roleData: Role) => {
    try {
      if (currentRole) {
        // Update existing role
        await updateRole(currentRole.name, roleData);
        toast({
          title: "Role updated",
          description: "The role has been successfully updated."
        });
      } else {
        // Add new role
        await createRole(roleData);
        toast({
          title: "Role created",
          description: "The new role has been successfully created."
        });
      }
      setRoleDialogOpen(false);
      setSelectedPermissions([]); // Reset permissions after saving
      fetchRoles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Users & Access Control</h1>
      </div>

      <div className="flex space-x-2 border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "users"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "roles"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("roles")}
        >
          Roles
        </button>
      </div>

      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage user accounts and access permissions
            </CardDescription>
              </div>
              {canCreateUsers ? (
                <Button className="flex items-center gap-2" onClick={handleAddUser}>
                  <UserPlus size={18} />
                  Add User
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button className="flex items-center gap-2" disabled>
                          <UserPlus size={18} />
                          Add User
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You do not have permission to add users
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8">
                      <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p className="mt-2 text-gray-500">Loading users...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-gray-500">No users found. Add a new user to get started.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="bg-secondary p-1 rounded-full">
                            <User size={16} />
                          </div>
                          {user.name}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            user.status === "Active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-secondary text-foreground"
                          }`}
                        >
                          {user.status}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(user.lastLogin)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {canEditUsers ? (
                            <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                              <Edit size={16} />
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button variant="ghost" size="icon" disabled>
                                      <Edit size={16} />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  You do not have permission to edit users
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {canDeleteUsers ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDeleteUser(user)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button variant="ghost" size="icon" disabled>
                                      <Trash2 size={16} />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  You do not have permission to delete users
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {activeTab === "roles" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Role Management</CardTitle>
                  <CardDescription>
                    Define user roles and their permissions
                  </CardDescription>
                </div>
                {canManageUsers ? (
                  <Button onClick={handleAddRole}>
                    <Shield size={16} className="mr-2" /> Create New Role
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button disabled>
                            <Shield size={16} className="mr-2" /> Create New Role
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        You do not have permission to create roles
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="mt-2 text-gray-500">Loading roles...</p>
                  </div>
                ) : roles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No roles defined. Create a new role to get started.</p>
                  </div>
                ) : (
                  roles.map((role) => (
                    <div key={role.name} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium flex items-center gap-2">
                            <Shield size={18} className="text-primary" />
                            {role.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {role.description}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {canManageUsers ? (
                            <Button variant="outline" size="sm" onClick={() => handleEditRole(role)}>
                              Edit Role
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button variant="outline" size="sm" disabled>
                                      Edit Role
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  You do not have permission to edit roles
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {canManageUsers ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => confirmDeleteRole(role)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 size={14} className="mr-1" />
                              Delete
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button variant="outline" size="sm" disabled>
                                      <Trash2 size={14} className="mr-1" />
                                      Delete
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  You do not have permission to delete roles
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Permissions:</p>
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((permissionId) => {
                            const permission = allPermissions.find(p => p.id === permissionId);
                            return permission ? (
                              <span
                                key={permissionId}
                                className="bg-primary/10 text-primary text-xs px-2 py-1 rounded"
                              >
                                {permission.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              {currentUser 
                ? "Update user details and permissions." 
                : "Create a new user account with appropriate permissions."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Full Name
              </Label>
              <Input
                id="name"
                defaultValue={currentUser?.name || ""}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                defaultValue={currentUser?.email || ""}
                className="col-span-3"
              />
            </div>
            
            {!currentUser && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  className="col-span-3"
                />
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role
              </Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.name} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              const formData: UserData = {
                id: currentUser?.id || "",
                name: (document.getElementById("name") as HTMLInputElement).value,
                email: (document.getElementById("email") as HTMLInputElement).value,
                role: selectedRole,
                status: selectedStatus as "Active" | "Inactive",
                lastLogin: currentUser?.lastLogin || new Date().toISOString(),
                password: currentUser ? undefined : (document.getElementById("password") as HTMLInputElement)?.value
              };
              handleSaveUser(formData);
            }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentRole ? `Edit Role: ${currentRole.name}` : "Create New Role"}</DialogTitle>
            <DialogDescription>
              {currentRole 
                ? "Modify role details and permissions." 
                : "Define a new role with specific permissions."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roleName" className="text-right">
                Role Name
              </Label>
              <Input
                id="roleName"
                defaultValue={currentRole?.name || ""}
                className="col-span-3"
                readOnly={!!currentRole} // Prevent editing existing role names
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roleDescription" className="text-right">
                Description
              </Label>
              <Input
                id="roleDescription"
                defaultValue={currentRole?.description || ""}
                className="col-span-3"
              />
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Permissions</h3>
              
              {/* Global Select All */}
              <div className="mb-4 p-3 bg-secondary rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="select-all-permissions"
                    checked={selectedPermissions.length === allPermissions.length && allPermissions.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedPermissions(allPermissions.map(p => p.id));
                      } else {
                        setSelectedPermissions([]);
                      }
                    }}
                  />
                  <Label htmlFor="select-all-permissions" className="font-medium">
                    Select All Permissions
                  </Label>
                </div>
              </div>
              
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([module, permissions]) => (
                  <div key={module} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-lg">{module}</h4>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id={`select-all-${module.toLowerCase().replace(/\s+/g, '-')}`}
                          checked={permissions.every(p => selectedPermissions.includes(p.id)) && permissions.length > 0}
                          onCheckedChange={(checked) => {
                            const modulePermissionIds = permissions.map(p => p.id);
                            if (checked) {
                              // Add all module permissions that aren't already selected
                              const newPermissions = [...selectedPermissions];
                              modulePermissionIds.forEach(id => {
                                if (!newPermissions.includes(id)) {
                                  newPermissions.push(id);
                                }
                              });
                              setSelectedPermissions(newPermissions);
                            } else {
                              // Remove all module permissions
                              setSelectedPermissions(selectedPermissions.filter(id => !modulePermissionIds.includes(id)));
                            }
                          }}
                        />
                        <Label htmlFor={`select-all-${module.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm font-medium">
                          Select All {module}
                        </Label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={permission.id}
                            checked={selectedPermissions.includes(permission.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPermissions([...selectedPermissions, permission.id]);
                              } else {
                                setSelectedPermissions(selectedPermissions.filter(id => id !== permission.id));
                              }
                            }}
                          />
                          <Label htmlFor={permission.id} className="flex-1">
                            {permission.name}
                            <p className="text-xs text-muted-foreground">{permission.description}</p>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRoleDialogOpen(false);
              setSelectedPermissions([]);
            }}>
              Cancel
            </Button>
            <Button onClick={() => {
              const name = (document.getElementById("roleName") as HTMLInputElement).value;
              const description = (document.getElementById("roleDescription") as HTMLInputElement).value;
              
              const roleData: Role = {
                name,
                description,
                permissions: selectedPermissions
              };
              
              handleSaveRole(roleData);
            }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user "{userToDelete?.name}"? This action cannot be undone and will permanently remove the user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteUserDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteUser}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Role Confirmation Dialog */}
      <AlertDialog open={deleteRoleDialogOpen} onOpenChange={setDeleteRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name}"? This action cannot be undone and will permanently remove the role and its permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteRoleDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteRole}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
