/*
  # Sistema de Auditoria de Vendas

  ## Descrição
  Implementa sistema completo de auditoria para rastrear todas as alterações em vendas.
  Permite visualizar histórico completo de modificações com detalhes de quem, quando e o quê.

  ## Alterações
  1. Cria tabela `sales_audit_log` para registar alterações
  2. Adiciona trigger automático para registar mudanças
  3. Adiciona validações para CPE, CUI e REQ duplicado
  4. Cria índices para performance

  ## Campos do Log
  - ID único do log
  - ID da venda
  - Código da venda
  - Utilizador que fez a alteração
  - Nome do utilizador
  - Tipo de ação (create, update, status_change, note_added)
  - Valores antigos (JSON)
  - Valores novos (JSON)
  - Campos alterados
  - Timestamp

  ## Segurança
  - RLS ativado
  - Admins e BO podem ver todos os logs
  - Partners podem ver logs das suas vendas
  - Logs são read-only (não podem ser editados ou apagados)
*/

-- Criar tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS sales_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_code text NOT NULL,
  user_id uuid,
  user_name text,
  action_type text NOT NULL CHECK (action_type IN ('create', 'update', 'status_change', 'note_added', 'payment_update')),
  old_values jsonb DEFAULT '{}',
  new_values jsonb DEFAULT '{}',
  changed_fields text[] DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_audit_log_sale_id ON sales_audit_log(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_audit_log_created_at ON sales_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_audit_log_user_id ON sales_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_audit_log_action_type ON sales_audit_log(action_type);

-- Ativar RLS
ALTER TABLE sales_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins view all logs"
  ON sales_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "BO view all logs"
  ON sales_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'bo'
    )
  );

CREATE POLICY "Partners view own sales logs"
  ON sales_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN sales s ON s.partner_id = u.partner_id
      WHERE u.id = auth.uid()
        AND u.role IN ('partner', 'partner_commercial')
        AND sales_audit_log.sale_id = s.id
    )
  );

-- Função para criar log de auditoria
CREATE OR REPLACE FUNCTION create_sales_audit_log(
  p_sale_id uuid,
  p_sale_code text,
  p_action_type text,
  p_old_values jsonb,
  p_new_values jsonb,
  p_changed_fields text[],
  p_description text
)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
BEGIN
  -- Obter utilizador atual
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT name INTO v_user_name
    FROM users
    WHERE id = v_user_id;
  END IF;

  -- Inserir log
  INSERT INTO sales_audit_log (
    sale_id,
    sale_code,
    user_id,
    user_name,
    action_type,
    old_values,
    new_values,
    changed_fields,
    description
  ) VALUES (
    p_sale_id,
    p_sale_code,
    v_user_id,
    COALESCE(v_user_name, 'Sistema'),
    p_action_type,
    COALESCE(p_old_values, '{}'::jsonb),
    COALESCE(p_new_values, '{}'::jsonb),
    COALESCE(p_changed_fields, '{}'::text[]),
    p_description
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função trigger para auditoria automática de vendas
CREATE OR REPLACE FUNCTION sales_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_changed_fields text[] := '{}';
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
  v_description text;
  v_action_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'create';
    v_description := 'Venda criada';
    v_new_values := to_jsonb(NEW);
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Detectar campos alterados
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changed_fields := array_append(v_changed_fields, 'status');
      v_old_values := jsonb_set(v_old_values, '{status}', to_jsonb(OLD.status));
      v_new_values := jsonb_set(v_new_values, '{status}', to_jsonb(NEW.status));
      v_action_type := 'status_change';
      v_description := 'Estado alterado de "' || OLD.status || '" para "' || NEW.status || '"';
    END IF;

    IF OLD.requisition IS DISTINCT FROM NEW.requisition THEN
      v_changed_fields := array_append(v_changed_fields, 'requisition');
      v_old_values := jsonb_set(v_old_values, '{requisition}', to_jsonb(OLD.requisition));
      v_new_values := jsonb_set(v_new_values, '{requisition}', to_jsonb(NEW.requisition));
    END IF;

    IF OLD.paid_to_operator IS DISTINCT FROM NEW.paid_to_operator THEN
      v_changed_fields := array_append(v_changed_fields, 'paid_to_operator');
      v_old_values := jsonb_set(v_old_values, '{paid_to_operator}', to_jsonb(OLD.paid_to_operator));
      v_new_values := jsonb_set(v_new_values, '{paid_to_operator}', to_jsonb(NEW.paid_to_operator));
      v_action_type := 'payment_update';
      v_description := 'Estado de pagamento alterado';
    END IF;

    IF OLD.manual_commission IS DISTINCT FROM NEW.manual_commission THEN
      v_changed_fields := array_append(v_changed_fields, 'manual_commission');
      v_old_values := jsonb_set(v_old_values, '{manual_commission}', to_jsonb(OLD.manual_commission));
      v_new_values := jsonb_set(v_new_values, '{manual_commission}', to_jsonb(NEW.manual_commission));
    END IF;

    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      v_changed_fields := array_append(v_changed_fields, 'notes');
      v_action_type := 'note_added';
      v_description := 'Nova nota adicionada';
    END IF;

    -- Se não foi detectado tipo específico, é update genérico
    IF v_action_type IS NULL THEN
      v_action_type := 'update';
      v_description := 'Venda atualizada - campos: ' || array_to_string(v_changed_fields, ', ');
    END IF;

    -- Só criar log se houve alterações
    IF array_length(v_changed_fields, 1) > 0 THEN
      PERFORM create_sales_audit_log(
        NEW.id,
        NEW.sale_code,
        v_action_type,
        v_old_values,
        v_new_values,
        v_changed_fields,
        v_description
      );
    END IF;
  END IF;

  -- Para INSERT, criar log
  IF TG_OP = 'INSERT' THEN
    PERFORM create_sales_audit_log(
      NEW.id,
      NEW.sale_code,
      v_action_type,
      v_old_values,
      v_new_values,
      v_changed_fields,
      v_description
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS sales_audit_log_trigger ON sales;
CREATE TRIGGER sales_audit_log_trigger
  AFTER INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION sales_audit_trigger();

-- Função para validar CPE (formato PT0000000000000)
CREATE OR REPLACE FUNCTION validate_cpe(cpe_value text)
RETURNS boolean AS $$
BEGIN
  IF cpe_value IS NULL OR cpe_value = '' THEN
    RETURN true;
  END IF;
  
  -- Validar formato: PT seguido de 13 dígitos
  RETURN cpe_value ~* '^PT[0-9]{13}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para validar CUI (formato PT 0000 0000 0000 0000)
CREATE OR REPLACE FUNCTION validate_cui(cui_value text)
RETURNS boolean AS $$
DECLARE
  v_clean_cui text;
BEGIN
  IF cui_value IS NULL OR cui_value = '' THEN
    RETURN true;
  END IF;
  
  -- Remover espaços para validação
  v_clean_cui := replace(cui_value, ' ', '');
  
  -- Validar formato: PT seguido de 16 dígitos
  RETURN v_clean_cui ~* '^PT[0-9]{16}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para verificar REQ duplicado em telecomunicações
CREATE OR REPLACE FUNCTION check_duplicate_requisition(
  p_requisition text,
  p_scope text,
  p_sale_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_count integer;
BEGIN
  -- Só validar se for telecomunicações e tiver requisição
  IF p_scope != 'telecomunicacoes' OR p_requisition IS NULL OR p_requisition = '' THEN
    RETURN false;
  END IF;

  -- Verificar se já existe
  SELECT COUNT(*)
  INTO v_count
  FROM sales
  WHERE requisition = p_requisition
    AND scope = 'telecomunicacoes'
    AND (p_sale_id IS NULL OR id != p_sale_id);

  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;
