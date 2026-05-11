import { supabase } from "../lib/supabase";

const SMTP_SETTINGS_KEY = "smtp_config";

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
      console.error("Erro ao obter estado de suspensao de alertas:", error);
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
      console.error("Erro ao atualizar suspensao de alertas:", error);
      throw error;
    }
  },

  async getSmtpConfig() {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value, updated_at")
        .eq("setting_key", SMTP_SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;

      if (!data?.setting_value) {
        return {
          smtp_host: "mail.mpgrupo.pt",
          smtp_port: 465,
          smtp_user: "info@mpgrupo.pt",
          from_email: "info@mpgrupo.pt",
          from_name: "MP Grupo CRM",
          reply_to: "geral@marciopinto.pt",
          bcc_enabled: false,
          bcc_emails: [],
          email_provider: "smtp",
          new_sale_email_enabled: true,
          alert_email_enabled: true,
          commission_report_email_enabled: true,
          operator_notification_email_enabled: true,
          smtp_password_set: false,
        };
      }

      return {
        ...data.setting_value,
        smtp_password_set: data.setting_value.smtp_password_set ?? false,
      };
    } catch (error) {
      console.error("Erro ao obter configuracao SMTP:", error);
      throw error;
    }
  },

  async saveSmtpConfig(config) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("system_settings")
        .update({
          setting_value: config,
          updated_by: user?.id,
        })
        .eq("setting_key", SMTP_SETTINGS_KEY)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Erro ao guardar configuracao SMTP:", error);
      throw error;
    }
  },

  async testSmtpConnection() {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smtp-settings`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Erro ao testar ligacao SMTP:", error);
      throw error;
    }
  },
};
