/*
  # Adicionar campos em falta à tabela sales

  ## Alterações
  1. Adiciona campos para vendas de telecomunicações:
     - service_type: tipo de serviço (M3/M4)
  
  2. Adiciona campos para vendas de energia:
     - power: potência contratada
     - entry_type: tipo de entrada
     - tier: escalão de gás (1-4)
  
  3. Adiciona campos gerais:
     - client_email: email do cliente
     - client_iban: IBAN do cliente
     - installation_address: morada de instalação
     - observations: observações da venda

  ## Notas
  - Todos os campos são opcionais (nullable)
  - Os nomes dos campos usam snake_case para consistência com o resto da base de dados
*/

-- Adicionar campos de telecomunicações
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN service_type text;
  END IF;
END $$;

-- Adicionar campos de energia
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'power'
  ) THEN
    ALTER TABLE sales ADD COLUMN power text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'entry_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN entry_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'tier'
  ) THEN
    ALTER TABLE sales ADD COLUMN tier text;
  END IF;
END $$;

-- Adicionar campos gerais
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_email'
  ) THEN
    ALTER TABLE sales ADD COLUMN client_email text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_iban'
  ) THEN
    ALTER TABLE sales ADD COLUMN client_iban text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'installation_address'
  ) THEN
    ALTER TABLE sales ADD COLUMN installation_address text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'observations'
  ) THEN
    ALTER TABLE sales ADD COLUMN observations text;
  END IF;
END $$;

-- Renomear campos antigos para novos (se existirem)
DO $$
BEGIN
  -- Renomear customer_type para client_type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE sales RENAME COLUMN customer_type TO client_type;
  END IF;

  -- Renomear customer_name para client_name
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_name'
  ) THEN
    ALTER TABLE sales RENAME COLUMN customer_name TO client_name;
  END IF;

  -- Renomear nif para client_nif
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'nif'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_nif'
  ) THEN
    ALTER TABLE sales RENAME COLUMN nif TO client_nif;
  END IF;

  -- Renomear contact para client_contact
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'contact'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_contact'
  ) THEN
    ALTER TABLE sales RENAME COLUMN contact TO client_contact;
  END IF;

  -- Renomear sale_date para date (mais simples)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'sale_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'date'
  ) THEN
    ALTER TABLE sales RENAME COLUMN sale_date TO date;
  END IF;
END $$;

-- Atualizar constraint do client_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'client_type'
  ) THEN
    ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_customer_type_check;
    ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_client_type_check;
    ALTER TABLE sales ADD CONSTRAINT sales_client_type_check CHECK (client_type IN ('particular', 'empresarial'));
  END IF;
END $$;
