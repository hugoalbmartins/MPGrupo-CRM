import { supabase } from "../lib/supabase";

export const energyPointsService = {
  async getPointsBySaleId(saleId) {
    try {
      const { data, error } = await supabase
        .from("sales_energy_points")
        .select("*")
        .eq("sale_id", saleId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Erro ao buscar pontos de energia:", error);
      throw error;
    }
  },

  async createPoint(pointData) {
    try {
      const { data, error } = await supabase
        .from("sales_energy_points")
        .insert([pointData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Erro ao criar ponto de energia:", error);
      throw error;
    }
  },

  async createMultiplePoints(pointsData) {
    try {
      const { data, error } = await supabase
        .from("sales_energy_points")
        .insert(pointsData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Erro ao criar pontos de energia:", error);
      throw error;
    }
  },

  async updatePoint(pointId, updates) {
    try {
      const { data, error } = await supabase
        .from("sales_energy_points")
        .update(updates)
        .eq("id", pointId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Erro ao atualizar ponto de energia:", error);
      throw error;
    }
  },

  async deletePoint(pointId) {
    try {
      const { error } = await supabase
        .from("sales_energy_points")
        .delete()
        .eq("id", pointId);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao deletar ponto de energia:", error);
      throw error;
    }
  },

  async deletePointsBySaleId(saleId) {
    try {
      const { error } = await supabase
        .from("sales_energy_points")
        .delete()
        .eq("sale_id", saleId);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao deletar pontos de energia:", error);
      throw error;
    }
  },

  async replacePointsForSale(saleId, pointsData) {
    try {
      await this.deletePointsBySaleId(saleId);

      if (pointsData && pointsData.length > 0) {
        const pointsWithSaleId = pointsData.map(point => ({
          ...point,
          sale_id: saleId
        }));
        return await this.createMultiplePoints(pointsWithSaleId);
      }

      return [];
    } catch (error) {
      console.error("Erro ao substituir pontos de energia:", error);
      throw error;
    }
  }
};
