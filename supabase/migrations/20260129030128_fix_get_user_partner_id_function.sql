/*
  # Corrigir função get_user_partner_id para suportar relacionamento partners.user_id

  1. Alterações
    - Atualizar função get_user_partner_id para buscar partner_id via JOIN com tabela partners
    - Suportar tanto users.partner_id (legado) quanto partners.user_id (novo método)
    - Garantir que parceiros D2D vejam suas vendas independentemente de quem as criou

  2. Motivo
    - Função atual busca apenas users.partner_id que pode estar NULL
    - Parceiros têm relacionamento via partners.user_id
    - Vendas criadas por admin/BO não aparecem para o parceiro correto

  3. Segurança
    - Mantém RLS policies existentes
    - Apenas ajusta a lógica de busca do partner_id
*/

-- Drop e recriar a função get_user_partner_id com lógica corrigida
CREATE OR REPLACE FUNCTION get_user_partner_id()
RETURNS UUID AS $$
DECLARE
  partner_id_result UUID;
BEGIN
  -- Primeiro tenta buscar via tabela partners (método preferencial)
  SELECT p.id INTO partner_id_result
  FROM partners p
  WHERE p.user_id = auth.uid();
  
  -- Se não encontrou, tenta buscar via users.partner_id (método legado)
  IF partner_id_result IS NULL THEN
    SELECT u.partner_id INTO partner_id_result
    FROM users u
    WHERE u.id = auth.uid();
  END IF;
  
  RETURN partner_id_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que a função seja executável por usuários autenticados
GRANT EXECUTE ON FUNCTION get_user_partner_id() TO authenticated;
