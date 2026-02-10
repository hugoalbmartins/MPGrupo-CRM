/*
  # Criar Parceiros Rev+ para Administradores Comissionados
  
  1. Alterações na tabela partners
    - Adicionar campo `is_admin` para identificar parceiros que são administradores
    
  2. Criação de Parceiros
    - Criar parceiros Rev+ nível 1 para todos os administradores comissionados
    - Associar users aos parceiros criados via partner_id
    
  3. Dados
    - Criar parceiro para Hugo Martins (admin comissionado existente)
    - Futuros administradores comissionados devem ter parceiros criados automaticamente
    
  4. Security
    - Manter políticas RLS existentes
*/

-- Adicionar campo is_admin à tabela partners
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partners' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE partners ADD COLUMN is_admin BOOLEAN DEFAULT false;
    COMMENT ON COLUMN partners.is_admin IS 'Indica se este parceiro é um administrador comissionado';
  END IF;
END $$;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_partners_is_admin
ON partners(is_admin)
WHERE is_admin = true;

-- Função para criar parceiro para administrador comissionado
CREATE OR REPLACE FUNCTION create_admin_partner()
RETURNS TRIGGER AS $$
DECLARE
  v_partner_id UUID;
  v_partner_code TEXT;
  v_partner_count INTEGER;
BEGIN
  -- Verifica se é um admin comissionado e ainda não tem parceiro
  IF NEW.is_commissioned = true 
     AND NEW.role = 'admin' 
     AND NEW.partner_id IS NULL THEN
    
    -- Gera código do parceiro
    SELECT COUNT(*) INTO v_partner_count 
    FROM partners 
    WHERE partner_type = 'Rev+';
    
    v_partner_code := 'Rev+' || (1001 + v_partner_count);
    
    -- Cria o parceiro
    INSERT INTO partners (
      name,
      partner_type,
      partner_code,
      email,
      phone,
      contact_person,
      street,
      door_number,
      postal_code,
      locality,
      nif,
      rev_level,
      is_admin
    ) VALUES (
      NEW.name,
      'Rev+',
      v_partner_code,
      NEW.email,
      COALESCE(NEW.contact_phone, '000000000'),
      NEW.name,
      'N/A',
      'N/A',
      '0000-000',
      'N/A',
      '999999990',
      1,
      true
    )
    RETURNING id INTO v_partner_id;
    
    -- Associa o parceiro ao user
    NEW.partner_id := v_partner_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para criar parceiro automaticamente
DROP TRIGGER IF EXISTS trigger_create_admin_partner ON users;
CREATE TRIGGER trigger_create_admin_partner
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_admin_partner();

-- Criar parceiros para administradores comissionados existentes
DO $$
DECLARE
  v_user RECORD;
  v_partner_id UUID;
  v_partner_code TEXT;
  v_partner_count INTEGER;
BEGIN
  FOR v_user IN 
    SELECT id, name, email, contact_phone
    FROM users
    WHERE is_commissioned = true 
      AND role = 'admin'
      AND partner_id IS NULL
  LOOP
    -- Gera código do parceiro
    SELECT COUNT(*) INTO v_partner_count 
    FROM partners 
    WHERE partner_type = 'Rev+';
    
    v_partner_code := 'Rev+' || (1001 + v_partner_count);
    
    -- Cria o parceiro
    INSERT INTO partners (
      name,
      partner_type,
      partner_code,
      email,
      phone,
      contact_person,
      street,
      door_number,
      postal_code,
      locality,
      nif,
      rev_level,
      is_admin
    ) VALUES (
      v_user.name,
      'Rev+',
      v_partner_code,
      v_user.email,
      COALESCE(v_user.contact_phone, '000000000'),
      v_user.name,
      'N/A',
      'N/A',
      '0000-000',
      'N/A',
      '999999990',
      1,
      true
    )
    RETURNING id INTO v_partner_id;
    
    -- Associa o parceiro ao user
    UPDATE users 
    SET partner_id = v_partner_id
    WHERE id = v_user.id;
    
    RAISE NOTICE 'Created partner % for admin %', v_partner_code, v_user.name;
  END LOOP;
END $$;
