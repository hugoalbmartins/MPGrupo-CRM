# Sistema de Gestão de Propostas

## Visão Geral

O sistema de propostas foi implementado para gerir vendas no estado "Em proposta", permitindo:
- Atribuição automática ou manual de comissões
- Tracking de tempo desde criação
- Alertas automáticos para propostas antigas
- Dashboard dedicado com análises detalhadas

## Funcionalidades Implementadas

### 1. Comissões para Propostas

Vendas com status "Em proposta" podem ter comissões:
- **Automáticas**: Calculadas pelas configurações da operadora
- **Manuais**: Definidas manualmente se a operadora assim indicar

As comissões ficam em estado pendente até a proposta ser concluída.

### 2. Dashboard com Separadores

O dashboard agora possui 3 separadores (para Admins, Gestores Nível 1 e Parceiros):

#### a) Vendas Totais
- Mantém todas as estatísticas atuais
- Gráficos e tabelas de vendas concluídas
- Evolução dos últimos 12 meses

#### b) Vendas Próprias (apenas para admins comissionados)
- Estatísticas de comissões próprias
- Valores brutos, líquidos e retenções
- Vendas registadas como admin

#### c) Propostas em Curso
- **Contadores por idade**:
  - Até 7 dias (verde)
  - 7 a 14 dias (laranja)
  - Mais de 14 dias (vermelho - urgente)
- **Total de comissões pendentes** em propostas
- **Distribuição por tipo** (Telecomunicações, Energia, Solar, Dual)
- **Tabela de parceiros** com propostas ativas

### 3. Contador de Dias

Cada proposta tem um contador automático:
- Calcula dias desde a criação
- Exibe no dashboard por faixas de idade
- Base para sistema de alertas

### 4. Alertas Automáticos

Sistema de alertas a cada 7 dias:
- **7 dias**: Primeiro alerta
- **14 dias**: Segundo alerta (requer atenção)
- **21 dias**: Terceiro alerta
- **28+ dias**: Alertas continuam a cada 7 dias

#### Destinatários dos Alertas
- Vendedor/Parceiro que criou a proposta
- Todos os administradores
- Gestores responsáveis (se aplicável)

## Como Usar

### Criar uma Venda em Proposta

1. Aceda a **Vendas** > **Nova Venda**
2. Preencha os dados normalmente
3. As comissões serão calculadas automaticamente (ou podem ser definidas manualmente)
4. A proposta aparecerá no dashboard de propostas

### Monitorizar Propostas

1. Aceda ao **Dashboard**
2. Clique no separador **"Propostas em Curso"**
3. Visualize:
   - Total de propostas ativas
   - Contadores por idade
   - Comissões pendentes
   - Parceiros com propostas

### Verificar Alertas de Propostas

Alertas são criados automaticamente e podem ser visualizados em:
- **Página de Alertas** (sino no menu superior)
- **Notificações por email** (se configurado)

## Gestão de Alertas

### Execução Manual

Para executar manualmente a verificação de propostas:

```bash
curl -X POST https://[YOUR_PROJECT].supabase.co/functions/v1/check-proposal-alerts \
  -H "Authorization: Bearer [YOUR_ANON_KEY]"
```

Substitua:
- `[YOUR_PROJECT]`: ID do projeto Supabase
- `[YOUR_ANON_KEY]`: Chave anônima do projeto

### Execução Automática

**Recomendação**: Configurar um cron job ou scheduler para executar diariamente:

1. **Via Supabase Dashboard**:
   - Aceda a Database > Extensions
   - Ative a extensão `pg_cron`
   - Configure um job diário:
   ```sql
   SELECT cron.schedule(
     'check-proposals-daily',
     '0 9 * * *', -- Todos os dias às 9h
     $$SELECT check_proposal_alerts()$$
   );
   ```

2. **Via Edge Function Externa**:
   - Use um serviço como GitHub Actions, Vercel Cron, ou similar
   - Configure para chamar a edge function `check-proposal-alerts` diariamente

## Estrutura Técnica

### Tabela de Vendas (sales)
- Campo `status` aceita "Em proposta"
- Comissões calculadas normalmente
- Campo `created_at` usado para cálculo de dias

### Tabela de Alertas (alerts)
- Novo tipo: `proposal_pending`
- Metadata com informações da proposta
- Criados automaticamente pela função `check_proposal_alerts()`

### Edge Function
- **Nome**: `check-proposal-alerts`
- **Função**: Verifica propostas antigas e cria alertas
- **Frequência recomendada**: Diária

### Dashboard Service
- Função `getProposalStats()`: Retorna estatísticas de propostas
- Separado das estatísticas de vendas
- Não filtrado por mês (mostra todas as propostas ativas)

## Notas Importantes

1. **Comissões Pendentes**: Valores em propostas não contam para comissões a pagar até conclusão
2. **Alertas Não Duplicados**: Sistema verifica antes de criar alertas repetidos
3. **Performance**: Queries otimizadas para não impactar performance
4. **Arquivamento**: Quando proposta muda de status, sai automaticamente do dashboard

## Resolução de Problemas

### Alertas não estão sendo criados
- Verifique se a função `check_proposal_alerts()` está sendo executada
- Execute manualmente via edge function
- Verifique logs no Supabase Dashboard

### Dashboard não mostra propostas
- Confirme que existem vendas com status "Em proposta"
- Verifique permissões RLS na tabela `sales`
- Limpe cache do navegador

### Contadores incorretos
- Verifique timezone do servidor
- Confirme formato de datas no campo `created_at`

## Melhorias Futuras

Possíveis extensões:
- Email automático com lista de propostas pendentes
- Relatórios semanais de propostas
- Dashboard de conversão de propostas
- Histórico de duração média de propostas
