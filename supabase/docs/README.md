# Supabase Documentation

This directory contains all database-related documentation for the Versal Warehouse Management System.

## Directory Structure

```
supabase/docs/
├── schema-enhancements/    # Database schema enhancement documentation
├── README.md              # This file
└── [future: guides/]      # Database guides and tutorials
```

## Schema Enhancements

These documents outline planned or completed database schema improvements:

### 1. [GRN Items Schema Enhancement](./schema-enhancements/GRN_ITEMS_SCHEMA_ENHANCEMENT.md)
- **Purpose**: Enhance `good_receive_note_items` table with product snapshots
- **Status**: Planned/In Progress
- **Key Changes**: 
  - Add product snapshot fields (name, SKU, HSN, tax type, unit)
  - Enhanced pricing fields (discount, tax, total)
  - Audit trail improvements

### 2. [Sale Invoice Items Schema Enhancement](./schema-enhancements/SALE_INVOICE_ITEMS_SCHEMA_ENHANCEMENT.md)
- **Purpose**: Enhance `sale_invoice_items` table with product snapshots
- **Status**: Planned/In Progress
- **Key Changes**:
  - Add product snapshot fields for historical accuracy
  - Reference to original sales order items
  - Enhanced audit trail

### 3. [Credit Notes Schema Enhancement](./schema-enhancements/CREDIT_NOTES_SCHEMA_ENHANCEMENT.md)
- **Purpose**: Enhance credit notes and credit note items tables
- **Status**: Planned/In Progress
- **Key Changes**:
  - Add rounding adjustment fields
  - Product snapshot fields for credit note items
  - Enhanced audit trail and compliance features

### 4. [RLS Enablement Guide](./schema-enhancements/RLS_ENABLEMENT_GUIDE.md)
- **Purpose**: Guide for enabling Row Level Security
- **Status**: Implementation Guide
- **Key Topics**:
  - RLS policy implementation
  - Security best practices
  - Migration procedures

### 5. [Status Actions Documentation](./STATUS_ACTIONS_DOCUMENTATION.md)
- **Purpose**: Defines action permissions for each status across all modules
- **Status**: Implementation Guide
- **Key Topics**:
  - Status-based action permissions matrix
  - Frontend and backend implementation details
  - Workflow control and data integrity

## Documentation Standards

### Schema Enhancement Documents
Each schema enhancement document should include:

1. **Overview**: Clear description of the enhancement
2. **Current vs Enhanced Schema**: Before/after comparison
3. **New Fields**: Detailed field descriptions
4. **Benefits**: Business and technical benefits
5. **Migration Strategy**: Step-by-step implementation plan
6. **TypeScript Interfaces**: Updated type definitions
7. **Best Practices**: Implementation guidelines

### File Naming Convention
- Use UPPERCASE with underscores: `TABLE_NAME_SCHEMA_ENHANCEMENT.md`
- Include the table name in the filename
- Add descriptive suffixes: `_ENHANCEMENT.md`, `_GUIDE.md`, `_MIGRATION.md`

## Related Resources

### Scripts
- [Database Scripts](../scripts/) - Development and maintenance scripts
- [Migrations](../migrations/) - Official Supabase migrations

### Implementation
- Schema enhancements are implemented through scripts in `../scripts/schema-updates/`
- Official migrations are created in `../migrations/` when ready for production
- Verification scripts are available in `../scripts/verification/`

## Contributing

When creating new schema enhancement documentation:

1. **Follow the template** from existing enhancement documents
2. **Include all required sections** (overview, schema comparison, migration strategy)
3. **Update this README** with the new document
4. **Create corresponding scripts** in the appropriate scripts directory
5. **Test thoroughly** before marking as complete

## Status Tracking

### Enhancement Status
- **Planned**: Document created, implementation pending
- **In Progress**: Scripts created, testing in progress
- **Complete**: Migrations applied, documentation updated
- **Deprecated**: Enhancement no longer needed

### Migration Status
- **Draft**: Scripts created but not tested
- **Tested**: Scripts tested in development environment
- **Applied**: Scripts applied to production
- **Migrated**: Converted to official Supabase migration 