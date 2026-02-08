/*
  # Adicionar Função RPC para Obter Parceiros com Vendas

  ## Resumo
  Cria função para obter todos os parceiros que têm vendas pagas no mês/ano especificado,
  excluindo vendas que já foram incluídas em autos validados como pagos.

  ## Nova Função
  - `get_partners_with_sales_for_month(p_month, p_year)` - Retorna lista de parceiros com vendas elegíveis

  ## Objetivo
  Facilitar a emissão em massa de autos de comissão para todos os parceiros com vendas no mês
*/

-- Função para obter parceiros com vendas disponíveis para emissão de auto
CREATE OR REPLACE FUNCTION get_partners_with_sales_for_month(
  p_month integer,
  p_year integer
)
RETURNS TABLE(
  partner_id uuid,
  partner_name text,
  sales_count bigint,
  total_commission numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH settled_sales AS (
    -- Obter IDs de vendas que já foram liquidadas em autos pagos
    SELECT DISTINCT jsonb_array_elements_text(cr.sales_included)::uuid as sale_id
    FROM commission_reports cr
    WHERE cr.month = p_month
      AND cr.year = p_year
      AND cr.paid_validated_at IS NOT NULL
  ),
  eligible_sales AS (
    -- Obter vendas pagas que ainda não foram liquidadas
    SELECT
      s.id,
      s.partner_id,
      COALESCE(s.manual_commission, s.calculated_commission, 0)
        + COALESCE(CASE WHEN s.has_direct_debit THEN s.direct_debit_value ELSE 0 END, 0)
        + COALESCE(CASE WHEN s.has_electronic_invoice THEN s.electronic_invoice_value ELSE 0 END, 0) as total_commission
    FROM sales s
    WHERE s.paid_to_operator = true
      AND (
        -- Usar data de ativação se disponível, senão usar data de pagamento, senão usar data da venda
        (EXTRACT(MONTH FROM COALESCE(s.activation_date, s.paid_date, s.date::date)) = p_month
         AND EXTRACT(YEAR FROM COALESCE(s.activation_date, s.paid_date, s.date::date)) = p_year)
      )
      AND NOT EXISTS (
        SELECT 1 FROM settled_sales ss
        WHERE ss.sale_id = s.id
      )
  )
  SELECT
    es.partner_id,
    p.name as partner_name,
    COUNT(es.id)::bigint as sales_count,
    SUM(es.total_commission)::numeric as total_commission
  FROM eligible_sales es
  JOIN partners p ON p.id = es.partner_id
  GROUP BY es.partner_id, p.name
  HAVING COUNT(es.id) > 0
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
