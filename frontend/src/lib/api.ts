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
  const result = await apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(user) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
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
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
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
  const result = await apiFetch('/units', { method: 'POST', body: JSON.stringify(unit) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateUnit(id: string, unit: any) {
  const result = await apiFetch(`/units/${id}`, { method: 'PUT', body: JSON.stringify(unit) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteUnit(id: string) {
  return apiFetch(`/units/${id}`, { method: 'DELETE' });
}

// Taxes API functions
export async function getTaxes() {
  return apiFetch('/taxes');
}

export async function createTax(tax: any) {
  const result = await apiFetch('/taxes', { method: 'POST', body: JSON.stringify(tax) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateTax(id: string, tax: any) {
  const result = await apiFetch(`/taxes/${id}`, { method: 'PUT', body: JSON.stringify(tax) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteTax(id: string) {
  return apiFetch(`/taxes/${id}`, { method: 'DELETE' });
}

// Suppliers API functions
export async function getSuppliers() {
  return apiFetch('/suppliers');
}

export async function createSupplier(supplier: any) {
  const result = await apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(supplier) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateSupplier(id: string, supplier: any) {
  const result = await apiFetch(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(supplier) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteSupplier(id: string) {
  return apiFetch(`/suppliers/${id}`, { method: 'DELETE' });
}

// Customers API functions
export async function getCustomers() {
  return apiFetch('/customers');
}

export async function createCustomer(customer: any) {
  const result = await apiFetch('/customers', { method: 'POST', body: JSON.stringify(customer) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateCustomer(id: string, customer: any) {
  const result = await apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(customer) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteCustomer(id: string) {
  return apiFetch(`/customers/${id}`, { method: 'DELETE' });
}

export async function getCustomerCreditBalance(customerId: string) {
  return apiFetch(`/customers/${customerId}/credit-balance`);
}

// NEW: Get invoices for a specific customer
export async function getCustomerInvoices(customerId: string) {
  console.log('API - getCustomerInvoices called with customerId:', customerId);
  
  // Filter sale invoices by customer ID
  const allInvoices = await getSaleInvoices();
  console.log('API - getSaleInvoices response:', allInvoices);
  
  if (allInvoices && !allInvoices.error) {
    const filteredInvoices = allInvoices.filter((invoice: any) => invoice.customerId === customerId);
    console.log('API - Filtered invoices for customer:', filteredInvoices);
    return filteredInvoices;
  }
  
  console.log('API - No invoices found or error occurred');
  return [];
}

// Credit Notes API functions
export async function getCreditNotes() {
  return apiFetch('/credit-notes');
}

export async function getCreditNote(id: string) {
  return apiFetch(`/credit-notes/${id}`);
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

export async function getPublicSystemSettings(signal?: AbortSignal) {
  // This function doesn't use apiFetch since it doesn't require authentication
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  
  const res = await fetch(`${API_BASE_URL}/public/system-settings`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    signal,
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
  const result = await apiFetch(`/inventory/stock-levels/${id}`, { method: 'PUT', body: JSON.stringify(stockLevel) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
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
  const result = await apiFetch('/inventory/movements', { method: 'POST', body: JSON.stringify(movement) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
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
  const result = await apiFetch('/products', { method: 'POST', body: JSON.stringify(product) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateProduct(id: string, product: any) {
  const result = await apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteProduct(id: string) {
  return apiFetch(`/products/${id}`, { method: 'DELETE' });
}

// Category management API functions
export async function getCategories() {
  return apiFetch('/categories');
}

export async function createCategory(category: any) {
  const result = await apiFetch('/categories', { method: 'POST', body: JSON.stringify(category) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateCategory(id: string, category: any) {
  const result = await apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(category) });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteCategory(id: string) {
  const result = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
  
  // Check if the result is an error response
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

// Purchase Orders API functions
export async function getPurchaseOrders() {
  return apiFetch('/purchase-orders');
}

export async function getPurchaseOrder(id: string) {
  return apiFetch(`/purchase-orders/${id}`);
}

export async function createPurchaseOrder(purchaseOrder: any) {
  const result = await apiFetch('/purchase-orders', { method: 'POST', body: JSON.stringify(purchaseOrder) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updatePurchaseOrder(id: string, purchaseOrder: any) {
  const result = await apiFetch(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(purchaseOrder) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deletePurchaseOrder(id: string) {
  return apiFetch(`/purchase-orders/${id}`, { method: 'DELETE' });
}

// Purchase Order Items API functions
export async function getPurchaseOrderItems(purchaseOrderId: string) {
  return apiFetch(`/purchase-orders/${purchaseOrderId}/items`);
}

export async function createPurchaseOrderItem(purchaseOrderId: string, item: any) {
  return apiFetch(`/purchase-orders/${purchaseOrderId}/items`, { method: 'POST', body: JSON.stringify(item) });
}

export async function updatePurchaseOrderItem(itemId: string, item: any) {
  return apiFetch(`/purchase-orders/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) });
}

export async function deletePurchaseOrderItem(itemId: string) {
  return apiFetch(`/purchase-orders/items/${itemId}`, { method: 'DELETE' });
}

// Sales Orders API functions
export async function getSalesOrders() {
  return apiFetch('/sales-orders');
}

export async function getSalesOrder(id: string) {
  return apiFetch(`/sales-orders/${id}`);
}

export async function createSalesOrder(salesOrder: any) {
  const result = await apiFetch('/sales-orders', { method: 'POST', body: JSON.stringify(salesOrder) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateSalesOrder(id: string, salesOrder: any) {
  const result = await apiFetch(`/sales-orders/${id}`, { method: 'PUT', body: JSON.stringify(salesOrder) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteSalesOrder(id: string) {
  return apiFetch(`/sales-orders/${id}`, { method: 'DELETE' });
}

// Sales Order Items API functions
export async function getSalesOrderItems(salesOrderId: string) {
  return apiFetch(`/sales-orders/${salesOrderId}/items`);
}

export async function createSalesOrderItem(salesOrderId: string, item: any) {
  return apiFetch(`/sales-orders/${salesOrderId}/items`, { method: 'POST', body: JSON.stringify(item) });
}

export async function updateSalesOrderItem(itemId: string, item: any) {
  return apiFetch(`/sales-orders/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) });
}

export async function deleteSalesOrderItem(itemId: string) {
  return apiFetch(`/sales-orders/items/${itemId}`, { method: 'DELETE' });
}

// Sale Invoices API functions
export async function getSaleInvoices() {
  return apiFetch('/sale-invoices');
}

export async function getSaleInvoice(id: string) {
  return apiFetch(`/sale-invoices/${id}`);
}

export async function createSaleInvoice(saleInvoice: any) {
  const result = await apiFetch('/sale-invoices', { method: 'POST', body: JSON.stringify(saleInvoice) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function getOverdueInvoices() {
  return apiFetch('/sale-invoices/overdue');
}

// Customer Payments API functions
export async function getCustomerPayments() {
  return apiFetch('/customer-payments');
}

export async function getCustomerPayment(id: string) {
  return apiFetch(`/customer-payments/${id}`);
}

export async function createCustomerPayment(payment: any) {
  const result = await apiFetch('/customer-payments', { method: 'POST', body: JSON.stringify(payment) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateCustomerPayment(id: string, payment: any) {
  const result = await apiFetch(`/customer-payments/${id}`, { method: 'PUT', body: JSON.stringify(payment) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteCustomerPayment(id: string) {
  const result = await apiFetch(`/customer-payments/${id}`, { method: 'DELETE' });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function getInvoicePayments(invoiceId: string) {
  return apiFetch(`/sale-invoices/${invoiceId}/payments`);
}

export async function addInvoicePayment(invoiceId: string, payment: any) {
  const result = await apiFetch(`/sale-invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(payment) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateSaleInvoice(id: string, saleInvoice: any) {
  const result = await apiFetch(`/sale-invoices/${id}`, { method: 'PUT', body: JSON.stringify(saleInvoice) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteSaleInvoice(id: string) {
  return apiFetch(`/sale-invoices/${id}`, { method: 'DELETE' });
}

// Sale Invoice Items API functions
export async function getSaleInvoiceItems(saleInvoiceId: string) {
  return apiFetch(`/sale-invoices/${saleInvoiceId}/items`);
}

export async function createSaleInvoiceItem(saleInvoiceId: string, item: any) {
  return apiFetch(`/sale-invoices/${saleInvoiceId}/items`, { method: 'POST', body: JSON.stringify(item) });
}

export async function updateSaleInvoiceItem(itemId: string, item: any) {
  return apiFetch(`/sale-invoices/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) });
}

export async function deleteSaleInvoiceItem(itemId: string) {
  return apiFetch(`/sale-invoices/items/${itemId}`, { method: 'DELETE' });
}

// Good Receive Notes API functions
export async function getGoodReceiveNotes() {
  return apiFetch('/good-receive-notes');
}

export async function getGoodReceiveNote(id: string) {
  return apiFetch(`/good-receive-notes/${id}`);
}

export async function createGoodReceiveNote(goodReceiveNote: any) {
  const result = await apiFetch('/good-receive-notes', { method: 'POST', body: JSON.stringify(goodReceiveNote) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function updateGoodReceiveNote(id: string, goodReceiveNote: any) {
  const result = await apiFetch(`/good-receive-notes/${id}`, { method: 'PUT', body: JSON.stringify(goodReceiveNote) });
  
  if (result && result.error) {
    const error = new Error(result.detail);
    (error as any).status = result.status;
    throw error;
  }
  
  return result;
}

export async function deleteGoodReceiveNote(id: string) {
  return apiFetch(`/good-receive-notes/${id}`, { method: 'DELETE' });
}

// Good Receive Note Items API functions
export async function getGoodReceiveNoteItems(goodReceiveNoteId: string) {
  return apiFetch(`/good-receive-notes/${goodReceiveNoteId}/items`);
}

export async function createGoodReceiveNoteItem(goodReceiveNoteId: string, item: any) {
  return apiFetch(`/good-receive-notes/${goodReceiveNoteId}/items`, { method: 'POST', body: JSON.stringify(item) });
}

export async function updateGoodReceiveNoteItem(itemId: string, item: any) {
  return apiFetch(`/good-receive-notes/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) });
}

export async function deleteGoodReceiveNoteItem(itemId: string) {
  return apiFetch(`/good-receive-notes/items/${itemId}`, { method: 'DELETE' });
} 