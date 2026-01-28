import { readFileSync } from 'fs';

function loadEnv() {
  const envContent = readFileSync('.env', 'utf-8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

async function triggerRecalculation() {
  console.log('🔄 Iniciando recálculo de todas as comissões...\n');

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/recalculate-commissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('✅ Recálculo concluído com sucesso!\n');
    console.log('📊 Resultados:');
    console.log(`   Total de vendas processadas: ${result.total}`);
    console.log(`   ✅ Atualizadas com sucesso: ${result.success_count}`);
    console.log(`   ⏭️  Ignoradas (sem alteração): ${result.skipped}`);
    console.log(`   ❌ Falhadas: ${result.failed}`);
    console.log('\n' + result.message);

  } catch (error) {
    console.error('❌ Erro ao executar recálculo:', error.message);
    process.exit(1);
  }
}

triggerRecalculation();
