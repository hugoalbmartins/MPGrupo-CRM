/*
# Create clients table and add pending validation to sales

1. New Tables
- `clients` — stores client data extracted from sales, linked to the partner who registered them.
  - `id` (uuid, primary key)
  - `client_nif` (text, indexed) — NIF of the client
  - `client_name` (text) — full name
  - `client_contact` (text) — mobile contact
  - `client_email` (text, nullable) — email
  - `client_iban` (text, nullable) — IBAN
  - `partner_id` (uuid, nullable, FK to partners) — partner who registered this client
  - `partner_name` (text, nullable) — denormalized partner name
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Modified Tables
- `sales` — add two new columns:
  - `pending_validation` (boolean, default false) — marks sales needing admin/BO approval
  - `validation_reason` (text, nullable) — reason for pending validation

3. Security
- Enable RLS on `clients`.
- Partners see clients from their own sales (partner_id matches their user record).
- Admins and BO see all clients.
- Partners can insert clients for their own partner.
- Admins and BO can update/delete any client.

4. Backfill
- Insert clients from sales created since 2025-09-01, deduplicating by NIF.
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_nif text NOT NULL,
  client_name text,
  client_contact text,
  client_email text,
  client_iban text,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  partner_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_nif ON clients(client_nif);
CREATE INDEX IF NOT EXISTS idx_clients_partner_id ON clients(partner_id);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
-- Used in policies via subquery: (SELECT role FROM users WHERE id = auth.uid())

DROP POLICY IF EXISTS "select_clients" ON clients;
CREATE POLICY "select_clients" ON clients FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'bo')
    OR partner_id = (SELECT partner_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_clients" ON clients;
CREATE POLICY "insert_clients" ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'bo')
    OR partner_id = (SELECT partner_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "update_clients" ON clients;
CREATE POLICY "update_clients" ON clients FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'bo')
    OR partner_id = (SELECT partner_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'bo')
    OR partner_id = (SELECT partner_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_clients" ON clients;
CREATE POLICY "delete_clients" ON clients FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'bo')
  );

-- Add pending validation columns to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS pending_validation boolean DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS validation_reason text;

-- Backfill clients from sales since 2025-09-01
INSERT INTO clients (client_nif, client_name, client_contact, client_email, client_iban, partner_id, partner_name)
SELECT DISTINCT ON (client_nif)
  client_nif,
  client_name,
  client_contact,
  client_email,
  client_iban,
  partner_id,
  partner_name
FROM sales
WHERE client_nif IS NOT NULL
  AND client_nif != ''
  AND created_at >= '2025-09-01'
  AND client_nif NOT IN (SELECT client_nif FROM clients)
ORDER BY client_nif, created_at DESC;
