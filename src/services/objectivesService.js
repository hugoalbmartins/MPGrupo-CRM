import { supabase } from "../lib/supabase";

export const objectivesService = {
  async getAll() {
    const { data, error } = await supabase
      .from("manager_objectives")
      .select(`
        *,
        manager:users!manager_id(id, name, email),
        operator:operators(id, name, scope)
      `)
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByManager(managerId, year, month) {
    const query = supabase
      .from("manager_objectives")
      .select(`
        *,
        operator:operators(id, name, scope)
      `)
      .eq("manager_id", managerId);

    if (year) query.eq("year", year);
    if (month) query.eq("month", month);

    const { data, error } = await query;

    if (error) throw error;

    const sorted = (data || []).sort((a, b) =>
      a.operator?.name?.localeCompare(b.operator?.name || '') || 0
    );

    return sorted;
  },

  async create(objective) {
    const { data, error } = await supabase
      .from("manager_objectives")
      .insert(objective)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from("manager_objectives")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from("manager_objectives")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async upsertObjective(managerId, operatorId, year, month, targets) {
    const { data: existing } = await supabase
      .from("manager_objectives")
      .select("id")
      .eq("manager_id", managerId)
      .eq("operator_id", operatorId)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    if (existing) {
      return this.update(existing.id, targets);
    } else {
      return this.create({
        manager_id: managerId,
        operator_id: operatorId,
        year,
        month,
        ...targets,
      });
    }
  },

  async getObjectiveProgress(managerId, year, month) {
    const objectives = await this.getByManager(managerId, year, month);

    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .or(`created_by_user_id.eq.${managerId},partner_id.in.(
        SELECT id FROM users WHERE manager_id = '${managerId}'
      )`);

    if (salesError) throw salesError;

    const monthlySales = (sales || []).filter(sale => {
      const saleDate = new Date(sale.date);
      return saleDate.getMonth() + 1 === month && saleDate.getFullYear() === year;
    });

    const progress = objectives.map(obj => {
      const operatorSales = monthlySales.filter(s => s.operator_id === obj.operator_id);

      const electricityCount = operatorSales.filter(
        s => s.scope === "energia" && (s.energy_sale_type === "eletricidade" || s.energy_sale_type === "dual")
      ).length;

      const gasCount = operatorSales.filter(
        s => s.scope === "energia" && (s.energy_sale_type === "gas" || s.energy_sale_type === "dual")
      ).length;

      const tvCount = operatorSales.filter(
        s => s.scope === "telecomunicacoes" && s.has_tv
      ).length;

      const fiberCount = operatorSales.filter(
        s => s.scope === "telecomunicacoes" && (s.has_net || s.has_lr)
      ).length;

      return {
        ...obj,
        actual: {
          electricity: electricityCount,
          gas: gasCount,
          tv: tvCount,
          fiber: fiberCount,
        },
        percentage: {
          electricity: obj.electricity_target > 0 ? (electricityCount / obj.electricity_target) * 100 : 0,
          gas: obj.gas_target > 0 ? (gasCount / obj.gas_target) * 100 : 0,
          tv: obj.tv_target > 0 ? (tvCount / obj.tv_target) * 100 : 0,
          fiber: obj.fiber_target > 0 ? (fiberCount / obj.fiber_target) * 100 : 0,
        },
      };
    });

    return progress;
  },
};
