/*
  # Fix Sales Status Constraint

  1. Changes
    - Drop existing sales_status_check constraint
    - Add new constraint with all valid statuses including "Em proposta"
  
  2. Valid Statuses
    - Em proposta (new proposal status)
    - Pendente
    - Para registo
    - Registado
    - Ativo
    - Concluido
    - Cancelado
    - Recusado
*/

-- Drop the existing constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

-- Add the new constraint with all valid statuses
ALTER TABLE sales ADD CONSTRAINT sales_status_check 
  CHECK (status IN (
    'Em proposta',
    'Pendente', 
    'Para registo',
    'Registado',
    'Ativo', 
    'Concluido',
    'Cancelado',
    'Recusado'
  ));