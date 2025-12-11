/*
  Adicionar campo IBAN aos parceiros
  
  Alterações:
  1. Adiciona campo iban (text) à tabela partners
     - Para pagamento de comissões aos parceiros
     - Campo opcional
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'iban'
  ) THEN
    ALTER TABLE partners ADD COLUMN iban text;
  END IF;
END $$;
