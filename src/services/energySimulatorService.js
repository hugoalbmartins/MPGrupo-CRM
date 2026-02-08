import { supabase } from '../lib/supabase';

export const POTENCIAS_PORTUGAL = [
  1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7, 27.6, 34.5, 41.4
];

export const ESCALOES_GAS = [
  { value: '1', label: 'Escalão 1 (< 500 m³/ano)' },
  { value: '2', label: 'Escalão 2 (500-1000 m³/ano)' },
  { value: '3', label: 'Escalão 3 (1000-5000 m³/ano)' },
  { value: '4', label: 'Escalão 4 (> 5000 m³/ano)' }
];

export const OPERADORAS_PORTUGAL_ERSE = [
  'EDP Comercial',
  'Galp Energia',
  'Endesa Energia',
  'Iberdrola',
  'Goldenergy',
  'Coopernico',
  'Luzboa',
  'Energia Simples',
  'Muon',
  'YCE',
  'Enat Energia',
  'Dourogás',
  'Audax',
  'SU Eletricidade',
  'Ylce',
  'MEO Energia'
];

export const CICLOS_HORARIOS = [
  { value: 'simples', label: 'Simples' },
  { value: 'bi-horario', label: 'Bi-horário' },
  { value: 'tri-horario', label: 'Tri-horário' }
];

export const TARIFAS_EMPTY_TEMPLATE = {
  eletricidade: {
    potencia: Object.fromEntries(POTENCIAS_PORTUGAL.map(p => [p.toString(), 0])),
    simples: { energia: 0 },
    'bi-horario': { vazio: 0, fora_vazio: 0 },
    'tri-horario': { vazio: 0, cheia: 0, ponta: 0 }
  },
  gas: {
    escalao_1: { diario: 0, energia: 0 },
    escalao_2: { diario: 0, energia: 0 },
    escalao_3: { diario: 0, energia: 0 },
    escalao_4: { diario: 0, energia: 0 }
  }
};

export const energySimulatorService = {
  async getActiveOperators(tipoEnergia = null) {
    try {
      let query = supabase
        .from('operadoras')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (tipoEnergia) {
        query = query.contains('tipos_energia', [tipoEnergia]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching active operators:', error);
      throw error;
    }
  },

  async getAllOperators() {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .select('*')
        .order('nome');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all operators:', error);
      throw error;
    }
  },

  async getOperatorById(id) {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching operator:', error);
      throw error;
    }
  },

  async createOperator(operator) {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .insert([{
          nome: operator.nome,
          logotipo_url: operator.logotipo_url || null,
          tipos_energia: operator.tipos_energia || [],
          ciclos_disponiveis: operator.ciclos_disponiveis || [],
          tarifas: operator.tarifas || TARIFAS_EMPTY_TEMPLATE,
          ativa: operator.ativa !== undefined ? operator.ativa : true
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating operator:', error);
      throw error;
    }
  },

  async updateOperator(id, updates) {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating operator:', error);
      throw error;
    }
  },

  async deleteOperator(id) {
    try {
      const { error } = await supabase
        .from('operadoras')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting operator:', error);
      throw error;
    }
  },

  async uploadLogo(file, operadoraId) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${operadoraId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('operadoras-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('operadoras-logos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  },

  async getDiscountsByOperator(operadoraId, tipoEnergia = null) {
    try {
      let query = supabase
        .from('configuracoes_descontos')
        .select('*')
        .eq('operadora_id', operadoraId);

      if (tipoEnergia) {
        query = query.eq('tipo_energia', tipoEnergia);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching discounts:', error);
      throw error;
    }
  },

  async getAllDiscounts() {
    try {
      const { data, error } = await supabase
        .from('configuracoes_descontos')
        .select(`
          *,
          operadoras:operadora_id (
            id,
            nome
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all discounts:', error);
      throw error;
    }
  },

  async upsertDiscount(discount) {
    try {
      const { operadoras, ...discountData } = discount;

      const { data, error } = await supabase
        .from('configuracoes_descontos')
        .upsert([discountData], {
          onConflict: 'operadora_id,tipo_energia'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error upserting discount:', error);
      throw error;
    }
  },

  async deleteDiscount(id) {
    try {
      const { error } = await supabase
        .from('configuracoes_descontos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting discount:', error);
      throw error;
    }
  },

  calcularCustoAtual(formData) {
    let custoEletricidade = 0;
    let custoGas = 0;

    if (formData.tipo_energia === 'eletricidade' || formData.tipo_energia === 'dual') {
      const dias = parseFloat(formData.eletricidade.dias) || 0;
      const valorPotenciaDia = parseFloat(formData.eletricidade.valor_potencia_dia) || 0;
      const ciclo = formData.eletricidade.ciclo;

      custoEletricidade += valorPotenciaDia * dias;

      if (ciclo === 'simples') {
        const kwh = parseFloat(formData.eletricidade.consumos.energia) || 0;
        const preco = parseFloat(formData.eletricidade.precos.energia) || 0;
        custoEletricidade += kwh * preco;
      } else if (ciclo === 'bi-horario') {
        const kwhVazio = parseFloat(formData.eletricidade.consumos.vazio) || 0;
        const precoVazio = parseFloat(formData.eletricidade.precos.vazio) || 0;
        const kwhForaVazio = parseFloat(formData.eletricidade.consumos.fora_vazio) || 0;
        const precoForaVazio = parseFloat(formData.eletricidade.precos.fora_vazio) || 0;
        custoEletricidade += (kwhVazio * precoVazio) + (kwhForaVazio * precoForaVazio);
      } else if (ciclo === 'tri-horario') {
        const kwhVazio = parseFloat(formData.eletricidade.consumos.vazio) || 0;
        const precoVazio = parseFloat(formData.eletricidade.precos.vazio) || 0;
        const kwhCheia = parseFloat(formData.eletricidade.consumos.cheia) || 0;
        const precoCheia = parseFloat(formData.eletricidade.precos.cheia) || 0;
        const kwhPonta = parseFloat(formData.eletricidade.consumos.ponta) || 0;
        const precoPonta = parseFloat(formData.eletricidade.precos.ponta) || 0;
        custoEletricidade += (kwhVazio * precoVazio) + (kwhCheia * precoCheia) + (kwhPonta * precoPonta);
      }
    }

    if (formData.tipo_energia === 'gas' || formData.tipo_energia === 'dual') {
      const dias = parseFloat(formData.gas.dias) || 0;
      const valorDiario = parseFloat(formData.gas.valor_diario) || 0;
      const kwh = parseFloat(formData.gas.consumo_kwh) || 0;
      const precoKwh = parseFloat(formData.gas.preco_kwh) || 0;

      custoGas = (valorDiario * dias) + (kwh * precoKwh);
    }

    return {
      eletricidade: custoEletricidade,
      gas: custoGas,
      total: custoEletricidade + custoGas
    };
  },

  aplicarDescontos(valorPotencia, valorEnergia, desconto, temDD, temFE) {
    let descontoPotencia = 0;
    let descontoEnergia = 0;

    if (temDD && temFE) {
      descontoPotencia = parseFloat(desconto.desconto_dd_fe_potencia) || 0;
      descontoEnergia = parseFloat(desconto.desconto_dd_fe_energia) || 0;
    } else if (temDD) {
      descontoPotencia = parseFloat(desconto.desconto_dd_potencia) || 0;
      descontoEnergia = parseFloat(desconto.desconto_dd_energia) || 0;
    } else if (temFE) {
      descontoPotencia = parseFloat(desconto.desconto_fe_potencia) || 0;
      descontoEnergia = parseFloat(desconto.desconto_fe_energia) || 0;
    } else {
      descontoPotencia = parseFloat(desconto.desconto_base_potencia) || 0;
      descontoEnergia = parseFloat(desconto.desconto_base_energia) || 0;
    }

    const valorPotenciaComDesconto = valorPotencia * (1 - descontoPotencia / 100);
    const valorEnergiaComDesconto = valorEnergia * (1 - descontoEnergia / 100);

    return {
      potencia: valorPotenciaComDesconto,
      energia: valorEnergiaComDesconto,
      total: valorPotenciaComDesconto + valorEnergiaComDesconto,
      descontoPotencia,
      descontoEnergia
    };
  },

  verificarCampanhaAplicavel(desconto, temDD, temFE) {
    const temCampanha = (desconto.desconto_mensal_temporario || 0) > 0 &&
                        (desconto.duracao_meses_desconto || 0) > 0;

    if (!temCampanha) return false;

    if (desconto.desconto_temp_requer_dd && !temDD) return false;
    if (desconto.desconto_temp_requer_fe && !temFE) return false;

    return true;
  },

  async simularComparacoes(formData) {
    try {
      const custoAtual = this.calcularCustoAtual(formData);

      const operadoras = await this.getActiveOperators();
      const resultados = [];

      const temDD = formData.tem_debito_direto || false;
      const temFE = formData.tem_fatura_eletronica || false;

      for (const operadora of operadoras) {
        if (formData.operadora_atual === operadora.nome) continue;

        const tiposEnergia = operadora.tipos_energia || [];
        if (formData.tipo_energia === 'eletricidade' && !tiposEnergia.includes('eletricidade')) continue;
        if (formData.tipo_energia === 'gas' && !tiposEnergia.includes('gas')) continue;
        if (formData.tipo_energia === 'dual' && (!tiposEnergia.includes('eletricidade') || !tiposEnergia.includes('gas'))) continue;

        if (formData.tipo_energia === 'eletricidade' || formData.tipo_energia === 'dual') {
          const ciclo = formData.eletricidade.ciclo;
          const ciclosDisponiveis = operadora.ciclos_disponiveis || [];
          if (!ciclosDisponiveis.includes(ciclo)) continue;
        }

        let custoNovaOperadora = { eletricidade: 0, gas: 0, total: 0 };
        let detalhesCalculo = {};

        if (formData.tipo_energia === 'eletricidade' || formData.tipo_energia === 'dual') {
          const tarifasElet = operadora.tarifas?.eletricidade;
          if (!tarifasElet) continue;

          const potencia = formData.eletricidade.potencia;
          const dias = parseFloat(formData.eletricidade.dias) || 0;
          const ciclo = formData.eletricidade.ciclo;

          const precoPotencia = parseFloat(tarifasElet.potencia?.[potencia]) || 0;
          let custoPotencia = precoPotencia * dias;

          let custoEnergia = 0;
          if (ciclo === 'simples') {
            const kwh = parseFloat(formData.eletricidade.consumos.energia) || 0;
            const precoKwh = parseFloat(tarifasElet.simples?.energia) || 0;
            custoEnergia = kwh * precoKwh;
          } else if (ciclo === 'bi-horario') {
            const kwhVazio = parseFloat(formData.eletricidade.consumos.vazio) || 0;
            const precoVazio = parseFloat(tarifasElet['bi-horario']?.vazio) || 0;
            const kwhForaVazio = parseFloat(formData.eletricidade.consumos.fora_vazio) || 0;
            const precoForaVazio = parseFloat(tarifasElet['bi-horario']?.fora_vazio) || 0;
            custoEnergia = (kwhVazio * precoVazio) + (kwhForaVazio * precoForaVazio);
          } else if (ciclo === 'tri-horario') {
            const kwhVazio = parseFloat(formData.eletricidade.consumos.vazio) || 0;
            const precoVazio = parseFloat(tarifasElet['tri-horario']?.vazio) || 0;
            const kwhCheia = parseFloat(formData.eletricidade.consumos.cheia) || 0;
            const precoCheia = parseFloat(tarifasElet['tri-horario']?.cheia) || 0;
            const kwhPonta = parseFloat(formData.eletricidade.consumos.ponta) || 0;
            const precoPonta = parseFloat(tarifasElet['tri-horario']?.ponta) || 0;
            custoEnergia = (kwhVazio * precoVazio) + (kwhCheia * precoCheia) + (kwhPonta * precoPonta);
          }

          const descontos = await this.getDiscountsByOperator(operadora.id, 'eletricidade');
          const desconto = descontos[0] || {};

          const comDesconto = this.aplicarDescontos(custoPotencia, custoEnergia, desconto, temDD, temFE);
          custoNovaOperadora.eletricidade = comDesconto.total;

          detalhesCalculo.eletricidade = {
            custoPotenciaSemDesconto: custoPotencia,
            custoEnergiaSemDesconto: custoEnergia,
            custoPotenciaComDesconto: comDesconto.potencia,
            custoEnergiaComDesconto: comDesconto.energia,
            descontoPotencia: comDesconto.descontoPotencia,
            descontoEnergia: comDesconto.descontoEnergia,
            campanhaAplicavel: this.verificarCampanhaAplicavel(desconto, temDD, temFE),
            campanha: desconto
          };
        }

        if (formData.tipo_energia === 'gas' || formData.tipo_energia === 'dual') {
          const tarifasGas = operadora.tarifas?.gas;
          if (!tarifasGas) continue;

          const escalao = formData.gas.escalao;
          const dias = parseFloat(formData.gas.dias) || 0;
          const kwh = parseFloat(formData.gas.consumo_kwh) || 0;

          const tarifaEscalao = tarifasGas[`escalao_${escalao}`];
          if (!tarifaEscalao) continue;

          const precoDiario = parseFloat(tarifaEscalao.diario) || 0;
          const precoEnergia = parseFloat(tarifaEscalao.energia) || 0;

          let custoDiario = precoDiario * dias;
          let custoEnergia = kwh * precoEnergia;

          const descontos = await this.getDiscountsByOperator(operadora.id, 'gas');
          const desconto = descontos[0] || {};

          const comDesconto = this.aplicarDescontos(custoDiario, custoEnergia, desconto, temDD, temFE);
          custoNovaOperadora.gas = comDesconto.total;

          detalhesCalculo.gas = {
            custoDiarioSemDesconto: custoDiario,
            custoEnergiaSemDesconto: custoEnergia,
            custoDiarioComDesconto: comDesconto.potencia,
            custoEnergiaComDesconto: comDesconto.energia,
            descontoDiario: comDesconto.descontoPotencia,
            descontoEnergia: comDesconto.descontoEnergia,
            campanhaAplicavel: this.verificarCampanhaAplicavel(desconto, temDD, temFE),
            campanha: desconto
          };
        }

        custoNovaOperadora.total = custoNovaOperadora.eletricidade + custoNovaOperadora.gas;

        const poupanca = custoAtual.total - custoNovaOperadora.total;

        if (poupanca > 0) {
          resultados.push({
            operadora,
            custoAtual,
            custoNovaOperadora,
            poupanca,
            poupancaMensal: poupanca,
            poupancaAnual: poupanca * 12,
            poupancaPercentual: (poupanca / custoAtual.total) * 100,
            detalhesCalculo
          });
        }
      }

      resultados.sort((a, b) => b.poupanca - a.poupanca);

      return {
        custoAtual,
        resultados: resultados.slice(0, 3),
        todosResultados: resultados
      };
    } catch (error) {
      console.error('Error simulating comparisons:', error);
      throw error;
    }
  }
};
