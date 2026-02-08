import { supabase } from '../lib/supabase';

export const simulatorService = {
  async getOperators() {
    const { data, error } = await supabase
      .from('simulator_operators')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getAllOperators() {
    const { data, error } = await supabase
      .from('simulator_operators')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createOperator(operator) {
    const { data, error } = await supabase
      .from('simulator_operators')
      .insert([operator])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOperator(id, updates) {
    const { data, error } = await supabase
      .from('simulator_operators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteOperator(id) {
    const { error } = await supabase
      .from('simulator_operators')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getElectricityPlans(operatorId = null) {
    let query = supabase
      .from('simulator_electricity_plans')
      .select('*, simulator_operators(name)')
      .eq('active', true)
      .order('operator_id')
      .order('name');

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAllElectricityPlans() {
    const { data, error } = await supabase
      .from('simulator_electricity_plans')
      .select('*, simulator_operators(name)')
      .order('operator_id')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createElectricityPlan(plan) {
    const { data, error } = await supabase
      .from('simulator_electricity_plans')
      .insert([plan])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateElectricityPlan(id, updates) {
    const { data, error } = await supabase
      .from('simulator_electricity_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteElectricityPlan(id) {
    const { error } = await supabase
      .from('simulator_electricity_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getGasPlans(operatorId = null) {
    let query = supabase
      .from('simulator_gas_plans')
      .select('*, simulator_operators(name)')
      .eq('active', true)
      .order('operator_id')
      .order('name');

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAllGasPlans() {
    const { data, error } = await supabase
      .from('simulator_gas_plans')
      .select('*, simulator_operators(name)')
      .order('operator_id')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createGasPlan(plan) {
    const { data, error } = await supabase
      .from('simulator_gas_plans')
      .insert([plan])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateGasPlan(id, updates) {
    const { data, error } = await supabase
      .from('simulator_gas_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteGasPlan(id) {
    const { error } = await supabase
      .from('simulator_gas_plans')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getSettings() {
    const { data, error } = await supabase
      .from('simulator_settings')
      .select('*');

    if (error) throw error;

    const settings = {};
    (data || []).forEach(item => {
      settings[item.key] = item.value;
    });
    return settings;
  },

  async updateSetting(key, value) {
    const { data, error } = await supabase
      .from('simulator_settings')
      .upsert({ key, value }, { onConflict: 'key' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  calculateElectricityCost(consumption, tariffType, settings) {
    const { vazio = 0, fora_vazio = 0, ponta = 0, cheia = 0 } = consumption;
    const prices = settings || {};

    let total = 0;

    if (tariffType === 'simples') {
      total = (vazio + fora_vazio + ponta + cheia) * parseFloat(prices.erse_simples || 0.15);
    } else if (tariffType === 'bi-horario') {
      total = vazio * parseFloat(prices.erse_bi_vazio || 0.12) +
              (fora_vazio + ponta + cheia) * parseFloat(prices.erse_bi_fora_vazio || 0.18);
    } else if (tariffType === 'tri-horario') {
      total = vazio * parseFloat(prices.erse_tri_vazio || 0.11) +
              cheia * parseFloat(prices.erse_tri_cheia || 0.16) +
              (ponta + fora_vazio) * parseFloat(prices.erse_tri_ponta || 0.22);
    }

    return total;
  },

  calculateElectricityPlanCost(plan, consumption, power) {
    const { vazio = 0, fora_vazio = 0, ponta = 0, cheia = 0 } = consumption;

    const powerCost = parseFloat(power) * parseFloat(plan.power_price_per_kva || 0);

    let energyCost = 0;
    energyCost += vazio * parseFloat(plan.vazio_price || 0);
    energyCost += fora_vazio * parseFloat(plan.fora_vazio_price || 0);
    energyCost += ponta * parseFloat(plan.ponta_price || 0);
    energyCost += cheia * parseFloat(plan.cheia_price || 0);

    const totalBeforeDiscount = powerCost + energyCost;
    const discount = parseFloat(plan.discount_percentage || 0) / 100;
    const totalAfterDiscount = totalBeforeDiscount * (1 - discount);

    return totalAfterDiscount;
  },

  calculateGasCost(consumption, settings) {
    const monthlyConsumption = parseFloat(consumption) || 0;
    const prices = settings || {};

    const tier1Price = parseFloat(prices.erse_gas_tier1 || 0.08);
    const tier2Price = parseFloat(prices.erse_gas_tier2 || 0.07);
    const tier3Price = parseFloat(prices.erse_gas_tier3 || 0.06);

    let total = 0;

    if (monthlyConsumption <= 500) {
      total = monthlyConsumption * tier1Price;
    } else if (monthlyConsumption <= 5000) {
      total = 500 * tier1Price + (monthlyConsumption - 500) * tier2Price;
    } else {
      total = 500 * tier1Price + 4500 * tier2Price + (monthlyConsumption - 5000) * tier3Price;
    }

    return total;
  },

  calculateGasPlanCost(plan, consumption) {
    const monthlyConsumption = parseFloat(consumption) || 0;

    const tier1Price = parseFloat(plan.tier1_price || 0);
    const tier2Price = parseFloat(plan.tier2_price || 0);
    const tier3Price = parseFloat(plan.tier3_price || 0);
    const fixedCost = parseFloat(plan.fixed_cost || 0);

    let energyCost = 0;

    if (monthlyConsumption <= 500) {
      energyCost = monthlyConsumption * tier1Price;
    } else if (monthlyConsumption <= 5000) {
      energyCost = 500 * tier1Price + (monthlyConsumption - 500) * tier2Price;
    } else {
      energyCost = 500 * tier1Price + 4500 * tier2Price + (monthlyConsumption - 5000) * tier3Price;
    }

    const totalBeforeDiscount = fixedCost + energyCost;
    const discount = parseFloat(plan.discount_percentage || 0) / 100;
    const totalAfterDiscount = totalBeforeDiscount * (1 - discount);

    return totalAfterDiscount;
  }
};
