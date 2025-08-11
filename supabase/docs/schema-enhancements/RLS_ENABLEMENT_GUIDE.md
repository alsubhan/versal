# Row Level Security (RLS) Enablement Guide

## Overview
This guide explains how to safely enable Row Level Security (RLS) for the following tables that were previously RLS disabled:

- `inventory_movements`
- `locations` 
- `roles`
- `sale_invoice_items`
- `sale_invoices`
- `user_roles` (view - RLS inherited from underlying tables)

## Tables and Their RLS Policies

### 1. inventory_movements
**Policy**: All authenticated users access
**Reasoning**: Follows the same pattern as `inventory_transactions` table, allowing all authenticated users to view and manage inventory movements.

### 2. locations
**Policies**: 
- Admin and manager access (full CRUD)
- Staff read access (view only)
**Reasoning**: Locations are sensitive business data that should be managed by admin/manager roles, but viewable by all staff.

### 3. sale_invoices
**Policy**: All authenticated users access
**Reasoning**: Follows the same pattern as other invoice tables (`sales_orders`, `purchase_orders`), allowing all authenticated users to manage invoices.

### 4. sale_invoice_items
**Policy**: All authenticated users access
**Reasoning**: Follows the same pattern as other invoice item tables (`sales_order_items`, `purchase_order_items`).

### 5. roles
**Policies**: 
- Authenticated users can read roles (needed for permission checking)
- Admin only write access (insert, update, delete)
**Reasoning**: Role information needs to be readable by all authenticated users for permission checking, but only admins should be able to modify roles.

### 6. user_roles (View)
**Policy**: Inherited from underlying tables
**Reasoning**: Since this is a view, RLS policies are inherited from the tables it references (typically profiles and roles tables).

## Safety Measures

### Before Applying
1. **Backup your database** - Always create a backup before applying RLS changes
2. **Test in development** - Apply these changes to a development environment first
3. **Verify existing data** - Ensure all existing data is accessible with the new policies

### During Application
1. **Monitor application logs** - Watch for any access denied errors
2. **Test all user roles** - Verify that admin, manager, and staff users can access appropriate data
3. **Check API endpoints** - Ensure all frontend API calls still work

### After Application
1. **Verify data access** - Confirm all users can access their required data
2. **Monitor performance** - RLS policies can impact query performance
3. **Update documentation** - Document the new security model

## Migration Files

### Main Migration: `20250131_enable_rls_missing_tables.sql`
This file:
- Enables RLS on all specified tables
- Creates appropriate policies based on existing patterns
- Includes verification queries to confirm changes
- Uses conditional logic for tables that may not exist

### Rollback Migration: `20250131_enable_rls_missing_tables_rollback.sql`
This file:
- Drops all created policies
- Disables RLS on all tables
- Can be used to quickly revert changes if issues arise

## How to Apply

### Option 1: Using Supabase CLI
```bash
# Apply the migration
supabase db push

# If you need to rollback
supabase db reset
```

### Option 2: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `20250131_enable_rls_missing_tables.sql`
4. Execute the script
5. Verify the results using the verification queries

## Verification Queries

After applying the migration, run these queries to verify everything is working:

```sql
-- Check RLS status
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename;

-- Check policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('inventory_movements', 'locations', 'sale_invoices', 'sale_invoice_items', 'roles')
ORDER BY tablename, policyname;
```

## Troubleshooting

### Common Issues

1. **"Access denied" errors**
   - Check if the user has the correct role
   - Verify the `get_user_role()` function is working
   - Ensure the user is authenticated

2. **Missing data**
   - Verify RLS policies are correctly applied
   - Check if data exists but is being filtered out
   - Test with different user roles

3. **Performance issues**
   - Monitor query execution plans
   - Consider adding indexes if needed
   - Review policy complexity

### Rollback Process
If you encounter issues:
1. Stop the application
2. Run the rollback migration
3. Investigate the issue
4. Fix the problem
5. Re-apply the migration

## Security Considerations

### Benefits
- **Data isolation**: Users can only access data they're authorized to see
- **Audit compliance**: Better tracking of data access
- **Reduced attack surface**: Limits potential data breaches

### Risks
- **Over-restriction**: Policies might be too restrictive
- **Performance impact**: RLS adds overhead to queries
- **Complexity**: More complex to debug and maintain

## Next Steps

After successfully enabling RLS:
1. **Monitor application performance**
2. **Review and refine policies** as needed
3. **Document any custom policies** for future reference
4. **Train team members** on the new security model
5. **Consider implementing additional security measures** (audit logs, etc.)

## Support

If you encounter issues:
1. Check the Supabase documentation on RLS
2. Review the application logs for specific error messages
3. Test with different user roles to isolate the problem
4. Consider rolling back and applying changes incrementally 