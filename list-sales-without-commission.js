import { createClient } from '@supabase/supabase-js';
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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listSalesWithoutCommission() {
  try {
    console.log('\n=== Buscando vendas com código PAR... ===\n');

    const { data: parSales, error: parError } = await supabase
      .from('sales')
      .select('sale_code, customer_name, scope, energy_sale_type, service_type, calculated_commission, manual_commission, operator_id')
      .ilike('sale_code', 'PAR%')
      .order('sale_code', { ascending: true })
      .limit(20);

    if (parError) {
      console.error('Erro ao buscar vendas PAR:', parError);
    } else if (parSales && parSales.length > 0) {
      console.log(`Encontradas ${parSales.length} vendas com código PAR:\n`);
      parSales.forEach(sale => {
        const calcComm = parseFloat(sale.calculated_commission || 0).toFixed(2);
        const manComm = parseFloat(sale.manual_commission || 0).toFixed(2);
        console.log(`  ${sale.sale_code} - ${sale.customer_name}`);
        console.log(`    Scope: ${sale.scope}, Type: ${sale.energy_sale_type || sale.service_type || 'N/A'}`);
        console.log(`    Comissão Calc: €${calcComm}, Manual: €${manComm}`);
        console.log('');
      });
    } else {
      console.log('Nenhuma venda com código PAR encontrada');
    }

    console.log('\n=== Buscando vendas SEM comissão (energia) ===\n');

    const { data: noCommSales, error: noCommError } = await supabase
      .from('sales')
      .select('sale_code, customer_name, scope, energy_sale_type, service_type, calculated_commission, manual_commission, operator_id, partners(name), operators(name)')
      .eq('scope', 'energia')
      .or('calculated_commission.is.null,calculated_commission.eq.0')
      .or('manual_commission.is.null,manual_commission.eq.0')
      .order('created_at', { ascending: false })
      .limit(30);

    if (noCommError) {
      console.error('Erro ao buscar vendas sem comissão:', noCommError);
    } else if (noCommSales && noCommSales.length > 0) {
      console.log(`Encontradas ${noCommSales.length} vendas de energia sem comissão:\n`);
      noCommSales.forEach(sale => {
        const calcComm = parseFloat(sale.calculated_commission || 0).toFixed(2);
        const manComm = parseFloat(sale.manual_commission || 0).toFixed(2);
        console.log(`  ${sale.sale_code} - ${sale.customer_name}`);
        console.log(`    Parceiro: ${sale.partners?.name || 'Admin'}`);
        console.log(`    Operadora: ${sale.operators?.name || 'N/A'}`);
        console.log(`    Energy Type: ${sale.energy_sale_type || 'não definido'}`);
        console.log(`    Comissão Calc: €${calcComm}, Manual: €${manComm}`);
        console.log('');
      });
    } else {
      console.log('Todas as vendas de energia têm comissão atribuída ✅');
    }

    console.log('\n=== Estatísticas gerais ===\n');

    const { count: totalSales } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });

    const { count: salesWithComm } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .or('calculated_commission.gt.0,manual_commission.gt.0');

    const { count: salesWithoutComm } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .or('calculated_commission.is.null,calculated_commission.eq.0')
      .or('manual_commission.is.null,manual_commission.eq.0');

    console.log(`Total de vendas: ${totalSales}`);
    console.log(`Vendas com comissão: ${salesWithComm}`);
    console.log(`Vendas sem comissão: ${salesWithoutComm}`);

  } catch (error) {
    console.error('Erro:', error);
  }
}

listSalesWithoutCommission().then(() => {
  console.log('\n=== Verificação concluída ===\n');
  process.exit(0);
});
