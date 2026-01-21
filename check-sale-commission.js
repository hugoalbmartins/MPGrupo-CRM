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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkSaleCommission(saleCode) {
  try {
    console.log(`\n=== Verificando venda ${saleCode} ===\n`);

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('sale_code', saleCode)
      .maybeSingle();

    if (saleError) {
      console.error('Erro ao buscar venda:', saleError);
      return;
    }

    if (!sale) {
      console.log('❌ Venda não encontrada');
      return;
    }

    console.log('📋 Dados da venda:');
    console.log('  - ID:', sale.id);
    console.log('  - Código:', sale.sale_code);
    console.log('  - Scope:', sale.scope);
    console.log('  - Cliente:', sale.customer_name, `(${sale.customer_type || 'particular'})`);
    console.log('  - NIF:', sale.client_nif);
    console.log('  - Operadora ID:', sale.operator_id);
    console.log('  - Parceiro ID:', sale.partner_id || 'Admin (sem parceiro)');
    console.log('  - Service Type:', sale.service_type);
    console.log('  - Energy Sale Type:', sale.energy_sale_type);
    console.log('  - Activation Type:', sale.activation_type);
    console.log('  - Monthly Value:', sale.monthly_value);
    console.log('  - Comissão Calculada:', sale.calculated_commission);
    console.log('  - Comissão Manual:', sale.manual_commission);
    console.log('  - Direct Debit:', sale.has_direct_debit);
    console.log('  - Electronic Invoice:', sale.has_electronic_invoice);

    const { data: operator, error: opError } = await supabase
      .from('operators')
      .select('*')
      .eq('id', sale.operator_id)
      .maybeSingle();

    if (opError) {
      console.error('Erro ao buscar operadora:', opError);
      return;
    }

    if (!operator) {
      console.log('❌ Operadora não encontrada');
      return;
    }

    console.log('\n🏢 Dados da operadora:');
    console.log('  - Nome:', operator.name);
    console.log('  - Commission Mode:', operator.commission_mode);
    console.log('  - Energy Type:', operator.energy_type);

    if (operator.commission_mode === 'manual') {
      console.log('\n⚠️  Operadora tem modo MANUAL - comissões não são calculadas automaticamente');
      return;
    }

    let partnerType = 'D2D';
    if (sale.partner_id) {
      const { data: partner } = await supabase
        .from('partners')
        .select('*')
        .eq('id', sale.partner_id)
        .maybeSingle();

      if (partner) {
        partnerType = partner.partner_type || 'D2D';
        console.log('\n👥 Parceiro:');
        console.log('  - Nome:', partner.name);
        console.log('  - Tipo:', partnerType);
        console.log('  - Código:', partner.partner_code);
      }
    } else {
      console.log('\n👤 Venda Admin (sem parceiro)');
      partnerType = 'Rev';
    }

    const clientType = sale.customer_type || sale.client_type || 'particular';
    let serviceType = null;
    let activationType = null;

    if (sale.scope === 'telecomunicacoes') {
      serviceType = sale.service_type;
      activationType = sale.activation_type;
    } else if (sale.scope === 'energia') {
      serviceType = sale.energy_sale_type || operator.energy_type || 'eletricidade';
    }

    console.log('\n🔍 Procurando configuração de comissão com:');
    console.log('  - operator_id:', operator.id, `(${operator.name})`);
    console.log('  - client_type:', clientType);
    console.log('  - partner_type:', partnerType);
    console.log('  - service_type:', serviceType);
    console.log('  - activation_type:', activationType || 'N/A');

    let query = supabase
      .from('commission_configurations')
      .select('*')
      .eq('operator_id', operator.id)
      .eq('client_type', clientType)
      .eq('partner_type', partnerType);

    if (activationType) {
      query = query.eq('activation_type', activationType);
    }

    const { data: configs, error: configError } = await query;

    if (configError) {
      console.error('Erro ao buscar configurações:', configError);
      return;
    }

    console.log(`\n📊 Encontradas ${configs?.length || 0} configurações`);

    if (configs && configs.length > 0) {
      let filteredConfigs = configs;

      if (serviceType) {
        filteredConfigs = configs.filter(config => {
          if (config.service_type === serviceType) {
            return true;
          }
          if (config.service_types && Array.isArray(config.service_types)) {
            return config.service_types.includes(serviceType);
          }
          return false;
        });
      }

      console.log(`   └─ ${filteredConfigs.length} configurações correspondem ao service_type "${serviceType}"`);

      if (filteredConfigs.length > 0) {
        console.log('\n✅ Configurações encontradas:');
        filteredConfigs.forEach((config, i) => {
          console.log(`\n   Configuração ${i + 1}:`);
          console.log('     - ID:', config.id);
          console.log('     - Service Type:', config.service_type);
          console.log('     - Service Types:', config.service_types);
          console.log('     - Commission Mode:', config.commission_mode);
          console.log('     - Commission Value:', config.commission_value);
          console.log('     - Min Sales:', config.min_sales);
          console.log('     - Direct Debit Bonus:', config.direct_debit_bonus);
          console.log('     - Electronic Invoice Bonus:', config.electronic_invoice_bonus);
        });

        console.log('\n💰 Calculando comissão...');
        const saleData = {
          ...sale,
          energy_sale_type: serviceType,
          isAdminSale: !sale.partner_id,
          isCommissioned: true
        };

        const commission = await calculateCommission(operator, saleData, supabase);
        console.log(`   └─ Comissão calculada: €${commission.toFixed(2)}`);

        if (commission > 0) {
          console.log('\n✅ Esta venda DEVERIA ter comissão de €' + commission.toFixed(2));

          if (parseFloat(sale.calculated_commission || 0) === 0) {
            console.log('⚠️  PROBLEMA: A venda tem comissão 0 mas deveria ter €' + commission.toFixed(2));
            console.log('\n🔧 Atualizando venda...');

            const updateData = {
              calculated_commission: commission
            };

            if (sale.scope === 'energia' && !sale.energy_sale_type && serviceType) {
              updateData.energy_sale_type = serviceType;
            }

            const { error: updateError } = await supabase
              .from('sales')
              .update(updateData)
              .eq('id', sale.id);

            if (updateError) {
              console.error('❌ Erro ao atualizar:', updateError);
            } else {
              console.log('✅ Venda atualizada com sucesso!');
            }
          } else {
            console.log('✓ Venda já tem comissão correta');
          }
        } else {
          console.log('\n⚠️  Comissão calculada é 0');
        }
      } else {
        console.log('\n❌ Nenhuma configuração corresponde ao service_type');
      }
    } else {
      console.log('\n❌ Nenhuma configuração de comissão encontrada para os critérios especificados');
      console.log('\n💡 Verifique se existe uma configuração com:');
      console.log('   - Operadora:', operator.name);
      console.log('   - Tipo de Cliente:', clientType);
      console.log('   - Tipo de Parceiro:', partnerType);
      console.log('   - Tipo de Serviço:', serviceType);
      if (activationType) {
        console.log('   - Tipo de Ativação:', activationType);
      }
    }

  } catch (error) {
    console.error('Erro:', error);
  }
}

checkSaleCommission('PAR00130126').then(() => {
  console.log('\n=== Verificação concluída ===\n');
  process.exit(0);
});
