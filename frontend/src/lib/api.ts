import { getSupabaseClient, getFallbackSupabaseClient } from './supabase-config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function apiFetch(path: string, options: RequestInit = {}) {
  let supabase;
  try {
    supabase = await getSupabaseClient();
  } catch (error) {
    console.error('Failed to get Supabase client, using fallback:', error);
    supabase = getFallbackSupabaseClient();
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    // Clone the response so we can read it multiple times
    const responseClone = res.clone();
    
    // Try to get the error text first
    try {
      const errorText = await responseClone.text();
      
      // Try to parse as JSON
      try {
        const errorData = JSON.parse(errorText);
        
        // Return error response instead of throwing
        return {
          error: true,
          status: res.status,
          statusText: res.statusText,
          detail: errorData.detail || errorData.message || errorText,
          data: errorData
        };
      } catch (jsonError) {
        // If JSON parsing fails, use the raw text
        return {
          error: true,
          status: res.status,
          statusText: res.statusText,
          detail: errorText || `HTTP ${res.status}: ${res.statusText}`,
          data: null
        };
      }
    } catch (textError) {
      // If even text reading fails, use status info
      return {
        error: true,
        status: res.status,
        statusText: res.statusText,
        detail: `HTTP ${res.status}: ${res.statusText}`,
        data: null
      };
    }
  }
  
  return res.json();
}

// User management API functions
export async function getUsers() {
  return apiFetch('/users');
}

export async function createUser(user: any) {
  const result = await apiFetch('/users', { method: 'POST', body: JSON.stringify(user) });
  
  // Check if the result is an error response
  if (result && result.error) {
    throw new Error(result.detail);
  }
  
  return result;
}

export async function updateUser(id: string, user: any) {
  return apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(user) });
}

export async function deleteUser(id: string) {
  return apiFetch(`/users/${id}`, { method: 'DELETE' });
}

// Role management API functions
export async function getRoles() {
  return apiFetch('/roles');
}

export async function createRole(role: any) {
  const result = await apiFetch('/roles', { method: 'POST', body: JSON.stringify(role) });
  
  // Check if the result is an error response
  if (result && result.error) {
    throw new Error(result.detail);
  }
  
  return result;
}

export async function updateRole(roleName: string, role: any) {
  const result = await apiFetch(`/roles/${roleName}`, { method: 'PUT', body: JSON.stringify(role) });
  
  // Check if the result is an error response
  if (result && result.error) {
    throw new Error(result.detail);
  }
  
  return result;
}

export async function deleteRole(roleName: string) {
  return apiFetch(`/roles/${roleName}`, { method: 'DELETE' });
}

// Units API functions
export async function getUnits() {
  return apiFetch('/units');
}

export async function createUnit(unit: any) {
  return apiFetch('/units', { method: 'POST', body: JSON.stringify(unit) });
}

export async function updateUnit(id: string, unit: any) {
  return apiFetch(`/units/${id}`, { method: 'PUT', body: JSON.stringify(unit) });
}

export async function deleteUnit(id: string) {
  return apiFetch(`/units/${id}`, { method: 'DELETE' });
}

// Taxes API functions
export async function getTaxes() {
  return apiFetch('/taxes');
}

export async function createTax(tax: any) {
  return apiFetch('/taxes', { method: 'POST', body: JSON.stringify(tax) });
}

export async function updateTax(id: string, tax: any) {
  return apiFetch(`/taxes/${id}`, { method: 'PUT', body: JSON.stringify(tax) });
}

export async function deleteTax(id: string) {
  return apiFetch(`/taxes/${id}`, { method: 'DELETE' });
}

// Suppliers API functions
export async function getSuppliers() {
  return apiFetch('/suppliers');
}

export async function createSupplier(supplier: any) {
  return apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(supplier) });
}

export async function updateSupplier(id: string, supplier: any) {
  return apiFetch(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(supplier) });
}

export async function deleteSupplier(id: string) {
  return apiFetch(`/suppliers/${id}`, { method: 'DELETE' });
}

// Customers API functions
export async function getCustomers() {
  return apiFetch('/customers');
}

export async function createCustomer(customer: any) {
  return apiFetch('/customers', { method: 'POST', body: JSON.stringify(customer) });
}

export async function updateCustomer(id: string, customer: any) {
  return apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(customer) });
}

export async function deleteCustomer(id: string) {
  return apiFetch(`/customers/${id}`, { method: 'DELETE' });
}

// Credit Notes API functions
export async function getCreditNotes() {
  return apiFetch('/credit-notes');
}

export async function createCreditNote(creditNote: any) {
  return apiFetch('/credit-notes', { method: 'POST', body: JSON.stringify(creditNote) });
}

export async function updateCreditNote(id: string, creditNote: any) {
  return apiFetch(`/credit-notes/${id}`, { method: 'PUT', body: JSON.stringify(creditNote) });
}

export async function deleteCreditNote(id: string) {
  return apiFetch(`/credit-notes/${id}`, { method: 'DELETE' });
}

// Credit Note Items API functions
export async function getCreditNoteItems(creditNoteId: string) {
  return apiFetch(`/credit-notes/${creditNoteId}/items`);
}

export async function createCreditNoteItem(creditNoteId: string, item: any) {
  return apiFetch(`/credit-notes/${creditNoteId}/items`, { method: 'POST', body: JSON.stringify(item) });
}

export async function updateCreditNoteItem(itemId: string, item: any) {
  return apiFetch(`/credit-notes/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) });
}

export async function deleteCreditNoteItem(itemId: string) {
  return apiFetch(`/credit-notes/items/${itemId}`, { method: 'DELETE' });
}

// User Settings API functions
export async function getUserSettings() {
  return apiFetch('/user-settings');
}

export async function createUserSetting(userSetting: any) {
  return apiFetch('/user-settings', { method: 'POST', body: JSON.stringify(userSetting) });
}

export async function updateUserSetting(userSetting: any) {
  return apiFetch('/user-settings', { method: 'PUT', body: JSON.stringify(userSetting) });
}

// System Settings API functions
export async function getSystemSettings() {
  return apiFetch('/system-settings');
}

export async function getPublicSystemSettings() {
  // This function doesn't use apiFetch since it doesn't require authentication
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  
  const res = await fetch(`${API_BASE_URL}/public/system-settings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  return res.json();
}

export async function createSystemSetting(systemSetting: any) {
  return apiFetch('/system-settings', { method: 'POST', body: JSON.stringify(systemSetting) });
}

export async function updateSystemSetting(id: string, systemSetting: any) {
  return apiFetch(`/system-settings/${id}`, { method: 'PUT', body: JSON.stringify(systemSetting) });
}

export async function deleteSystemSetting(id: string) {
  return apiFetch(`/system-settings/${id}`, { method: 'DELETE' });
}

// Inventory API functions

// Stock Levels API functions
export async function getStockLevels() {
  return apiFetch('/inventory/stock-levels');
}

export async function createStockLevel(stockLevel: any) {
  return apiFetch('/inventory/stock-levels', { method: 'POST', body: JSON.stringify(stockLevel) });
}

export async function updateStockLevel(id: string, stockLevel: any) {
  return apiFetch(`/inventory/stock-levels/${id}`, { method: 'PUT', body: JSON.stringify(stockLevel) });
}

export async function deleteStockLevel(id: string) {
  return apiFetch(`/inventory/stock-levels/${id}`, { method: 'DELETE' });
}

// Inventory Transactions (Automatic audit trail)
export async function getInventoryTransactions() {
  return apiFetch('/inventory/transactions');
}

export async function createInventoryTransaction(transaction: any) {
  return apiFetch('/inventory/transactions', { method: 'POST', body: JSON.stringify(transaction) });
}

// Inventory Movements (Manual movements)
export async function getInventoryMovements() {
  return apiFetch('/inventory/movements');
}

export async function createInventoryMovement(movement: any) {
  return apiFetch('/inventory/movements', { method: 'POST', body: JSON.stringify(movement) });
}

// Locations API functions
export async function getLocations() {
  return apiFetch('/inventory/locations');
}

export async function createLocation(location: any) {
  return apiFetch('/inventory/locations', { method: 'POST', body: JSON.stringify(location) });
}

export async function updateLocation(id: string, location: any) {
  return apiFetch(`/inventory/locations/${id}`, { method: 'PUT', body: JSON.stringify(location) });
}

export async function deleteLocation(id: string) {
  return apiFetch(`/inventory/locations/${id}`, { method: 'DELETE' });
}

// Products API functions
export async function getProducts() {
  return apiFetch('/products');
}

export async function createProduct(product: any) {
  return apiFetch('/products', { method: 'POST', body: JSON.stringify(product) });
}

export async function updateProduct(id: string, product: any) {
  return apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) });
}

export async function deleteProduct(id: string) {
  return apiFetch(`/products/${id}`, { method: 'DELETE' });
} 