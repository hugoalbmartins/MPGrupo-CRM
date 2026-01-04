import { supabase } from "../lib/supabase";

export const systemSettingsService = {
  async getAlertsSuspensionStatus() {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value, updated_at, updated_by")
        .eq("setting_key", "alerts_suspension")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return {
          suspended: false,
          suspended_at: null,
          suspended_by: null,
        };
      }

      return data.setting_value;
    } catch (error) {
      console.error("Erro ao obter estado de suspensão de alertas:", error);
      throw error;
    }
  },

  async setAlertsSuspension(suspended) {
    try {
      const newValue = {
        suspended,
        suspended_at: suspended ? new Date().toISOString() : null,
        suspended_by: suspended ? (await supabase.auth.getUser()).data.user?.id : null,
      };

      const { data, error } = await supabase
        .from("system_settings")
        .update({
          setting_value: newValue,
        })
        .eq("setting_key", "alerts_suspension")
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Erro ao atualizar suspensão de alertas:", error);
      throw error;
    }
  },
};
