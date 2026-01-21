import { createClient } from '@supabase/supabase-js';
import { calculateCommission } from './src/lib/utils-crm.js';
import { readFileSync } from 'fs';

function loadEnv() {
  const envContent = readFileSync('.env', 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      env[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateAllCommissions() {
  try {
    console.log('Iniciando recálculo de comissões para todas as vendas...');

    const { data: allSales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: true });

    if (salesError) {
      throw salesError;
    }

    if (!allSales || allSales.length === 0) {
      console.log('Nenhuma venda encontrada');
      return;
    }

    console.log(`Encontradas ${allSales.length} vendas para processar`);

    const { data: operators, error: operatorsError } = await supabase
      .from('operators')
      .select('*');

    if (operatorsError) {
      throw operatorsError;
    }

    const operatorsMap = {};
    operators.forEach(op => {
      operatorsMap[op.id] = op;
    });

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const sale of allSales) {
      try {
        if (sale.manual_commission && parseFloat(sale.manual_commission) > 0) {
          console.log(`[SKIP] ${sale.sale_code} - tem comissão manual`);
          skippedCount++;
          continue;
        }

        const operator = operatorsMap[sale.operator_id];
        if (!operator) {
          console.warn(`[ERRO] Operadora não encontrada para venda ${sale.sale_code}`);
          failedCount++;
          continue;
        }

        if (operator.commission_mode === 'manual') {
          console.log(`[SKIP] ${sale.sale_code} - operadora ${operator.name} tem modo manual`);
          skippedCount++;
          continue;
        }

        let energySaleType = sale.energy_sale_type;
        if (sale.scope === 'energia' && !energySaleType) {
          if (operator.energy_type) {
            energySaleType = operator.energy_type;
          } else {
            energySaleType = 'eletricidade';
          }
          console.log(`[INFO] Inferindo energy_sale_type para ${sale.sale_code}: ${energySaleType}`);
        }

        const saleData = {
          ...sale,
          energy_sale_type: energySaleType,
          isAdminSale: !sale.partner_id,
          isCommissioned: true
        };

        const newCommission = await calculateCommission(operator, saleData, supabase);
        const oldCommission = parseFloat(sale.calculated_commission || 0);

        if (Math.abs(newCommission - oldCommission) > 0.01) {
          const updateData = {
            calculated_commission: newCommission
          };

          if (sale.scope === 'energia' && !sale.energy_sale_type && energySaleType) {
            updateData.energy_sale_type = energySaleType;
          }

          const { error: updateError } = await supabase
            .from('sales')
            .update(updateData)
            .eq('id', sale.id);

          if (updateError) {
            console.error(`[ERRO] Falha ao atualizar ${sale.sale_code}:`, updateError);
            failedCount++;
          } else {
            console.log(`[OK] ${sale.sale_code}: €${oldCommission.toFixed(2)} -> €${newCommission.toFixed(2)}`);
            successCount++;
          }
        } else {
          console.log(`[SKIP] ${sale.sale_code} - comissão já está correta: €${newCommission.toFixed(2)}`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`[ERRO] Erro ao processar ${sale.sale_code}:`, error.message);
        failedCount++;
      }
    }

    console.log('\n=== RESUMO DO RECÁLCULO ===');
    console.log(`Total de vendas: ${allSales.length}`);
    console.log(`Atualizadas com sucesso: ${successCount}`);
    console.log(`Ignoradas (já corretas ou manuais): ${skippedCount}`);
    console.log(`Falharam: ${failedCount}`);
    console.log('===========================\n');

  } catch (error) {
    console.error('Erro geral no recálculo:', error);
    process.exit(1);
  }
}

recalculateAllCommissions().then(() => {
  console.log('Recálculo concluído!');
  process.exit(0);
});
