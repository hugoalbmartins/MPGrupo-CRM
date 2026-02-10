/*
  # Adicionar tipo 'sale_edit' ao check constraint da tabela alerts

  1. Problema
    - O trigger `trigger_sale_edit_alert` tenta criar alertas com tipo 'sale_edit'
    - Mas o check constraint `alerts_type_check` nao inclui esse tipo
    - Isso impede a atualizacao de vendas (incluindo recalculo de comissoes)

  2. Solucao
    - Atualiza o check constraint para incluir 'sale_edit'
*/

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;

ALTER TABLE alerts ADD CONSTRAINT alerts_type_check 
  CHECK (type = ANY (ARRAY['new_sale', 'status_change', 'note_added', 'operator_validation', 'proposal_pending', 'sale_edit']));
