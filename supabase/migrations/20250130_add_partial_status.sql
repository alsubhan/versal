-- Add 'partial' status to invoice_status enum
-- This allows tracking invoices where customers have made partial payments

-- First, remove the default value from the status column
ALTER TABLE sale_invoices ALTER COLUMN status DROP DEFAULT;

-- Create a new enum type with the additional value
CREATE TYPE invoice_status_new AS ENUM (
    'draft',
    'sent', 
    'partial',
    'paid',
    'overdue',
    'cancelled'
);

-- Update the column to use the new enum type
ALTER TABLE sale_invoices 
    ALTER COLUMN status TYPE invoice_status_new 
    USING status::text::invoice_status_new;

-- Drop the old enum type
DROP TYPE invoice_status;

-- Rename the new enum type to the original name
ALTER TYPE invoice_status_new RENAME TO invoice_status;

-- Restore the default value for the status column
ALTER TABLE sale_invoices ALTER COLUMN status SET DEFAULT 'draft';

-- Add a comment explaining the status values
COMMENT ON TYPE invoice_status IS 'Invoice status: draft, sent, partial, paid, overdue, cancelled';
