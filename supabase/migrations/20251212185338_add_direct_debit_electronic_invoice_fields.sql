/*
  # Adicionar Débito Direto e Fatura Eletrónica

  ## Alterações nas Tabelas
  
  ### 1. Operadoras (operators)
    - `pays_direct_debit` (boolean): Indica se a operadora paga por adesão a Débito Direto
    - `pays_electronic_invoice` (boolean): Indica se a operadora paga por adesão a Fatura Eletrónica
  
  ### 2. Vendas (sales)
    - `has_direct_debit` (boolean): Cliente aderiu a Débito Direto
    - `has_electronic_invoice` (boolean): Cliente aderiu a Fatura Eletrónica
    - `direct_debit_value` (numeric): Valor da comissão por DD
    - `electronic_invoice_value` (numeric): Valor da comissão por FE

  ## Notas
  - Os valores de DD e FE são definidos nos patamares de cada operadora (commission_config)
  - Se a venda tiver DD ou FE ativado, o valor é somado à comissão
  - Os campos de morada já existem na tabela sales
*/

-- Adicionar campos às operadoras
ALTER TABLE operators 
ADD COLUMN IF NOT EXISTS pays_direct_debit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pays_electronic_invoice boolean DEFAULT false;

-- Adicionar campos às vendas
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS has_direct_debit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_electronic_invoice boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS direct_debit_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS electronic_invoice_value numeric DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN operators.pays_direct_debit IS 'Indica se a operadora paga comissão por adesão a Débito Direto';
COMMENT ON COLUMN operators.pays_electronic_invoice IS 'Indica se a operadora paga comissão por adesão a Fatura Eletrónica';

COMMENT ON COLUMN sales.has_direct_debit IS 'Cliente aderiu a Débito Direto';
COMMENT ON COLUMN sales.has_electronic_invoice IS 'Cliente aderiu a Fatura Eletrónica';
COMMENT ON COLUMN sales.direct_debit_value IS 'Valor da comissão por adesão a Débito Direto';
COMMENT ON COLUMN sales.electronic_invoice_value IS 'Valor da comissão por adesão a Fatura Eletrónica';
