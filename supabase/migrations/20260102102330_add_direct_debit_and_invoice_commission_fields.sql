/*
  # Add Direct Debit and Electronic Invoice Commission Fields
  
  1. Changes to commission_configurations table
    - Add `direct_debit_bonus` (numeric) - bonus value for direct debit adhesion
    - Add `electronic_invoice_bonus` (numeric) - bonus value for electronic invoice adhesion
  
  2. Changes to sales table
    - Add `has_direct_debit` (boolean) - whether customer adhered to direct debit
    - Add `has_electronic_invoice` (boolean) - whether customer adhered to electronic invoice
    - Add `direct_debit_commission` (numeric) - commission paid for direct debit
    - Add `electronic_invoice_commission` (numeric) - commission paid for electronic invoice
  
  3. Notes
    - These fields allow operators to pay bonuses for customer adhesion to direct debit and electronic invoices
    - The bonus values are configured per commission configuration
    - The actual commission values are stored per sale
*/

-- Add bonus fields to commission_configurations
ALTER TABLE commission_configurations
ADD COLUMN IF NOT EXISTS direct_debit_bonus numeric(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS electronic_invoice_bonus numeric(10,2) DEFAULT 0.00;

-- Add fields to sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS has_direct_debit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_electronic_invoice boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS direct_debit_commission numeric(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS electronic_invoice_commission numeric(10,2) DEFAULT 0.00;