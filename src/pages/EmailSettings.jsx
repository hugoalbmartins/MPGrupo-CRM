import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemSettingsService } from '../services/systemSettingsService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/sonner';
import { Mail, Server, Shield, Send, CircleCheck as CheckCircle, Circle as XCircle, Loader as Loader2, Eye, EyeOff, Settings, ToggleLeft } from 'lucide-react';

const DEFAULT_CONFIG = {
  smtp_host: 'mail.mpgrupo.pt',
  smtp_port: 465,
  smtp_user: 'info@mpgrupo.pt',
  from_email: 'info@mpgrupo.pt',
  from_name: 'MP Grupo CRM',
  reply_to: 'geral@marciopinto.pt',
  bcc_enabled: false,
  bcc_emails: [],
  email_provider: 'smtp',
  new_sale_email_enabled: true,
  alert_email_enabled: true,
  commission_report_email_enabled: true,
  operator_notification_email_enabled: true,
};

export default function EmailSettings({ user }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [showPassword, setShowPassword] = useState(false);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [bccInput, setBccInput] = useState('');

  const { data: smtpConfig, isLoading } = useQuery({
    queryKey: ['smtpConfig'],
    queryFn: () => systemSettingsService.getSmtpConfig(),
  });

  useEffect(() => {
    if (smtpConfig) {
      setConfig({ ...DEFAULT_CONFIG, ...smtpConfig });
    }
  }, [smtpConfig]);

  const saveMutation = useMutation({
    mutationFn: (newConfig) => systemSettingsService.saveSmtpConfig(newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smtpConfig'] });
      toast.success('Configuracao guardada com sucesso');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    const toSave = { ...config };
    delete toSave.smtp_password_set;
    saveMutation.mutate(toSave);
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addBccEmail = () => {
    const email = bccInput.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Email invalido');
      return;
    }
    if ((config.bcc_emails || []).includes(email)) {
      toast.error('Email ja existe na lista');
      return;
    }
    updateConfig('bcc_emails', [...(config.bcc_emails || []), email]);
    setBccInput('');
  };

  const removeBccEmail = (email) => {
    updateConfig('bcc_emails', (config.bcc_emails || []).filter(e => e !== email));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-800 rounded w-48" />
          <div className="h-64 bg-dark-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail className="w-5 h-5" style={{ color: '#06b6d4' }} />
          Configuracao de Email
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(6, 182, 212, 0.5)' }}>
          Configure o servidor SMTP, credenciais e definicoes de envio de email do CRM
        </p>
      </div>

      {/* SMTP Server Configuration */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Server className="w-4 h-4" style={{ color: '#06b6d4' }} />
          <h2 className="text-sm font-semibold text-white">Servidor SMTP</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-400">Host SMTP *</Label>
            <Input
              value={config.smtp_host}
              onChange={(e) => updateConfig('smtp_host', e.target.value)}
              className="bg-dark-900 border-dark-700 text-white mt-1"
              placeholder="mail.mpgrupo.pt"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Porta *</Label>
            <Input
              type="number"
              value={config.smtp_port}
              onChange={(e) => updateConfig('smtp_port', parseInt(e.target.value) || 465)}
              className="bg-dark-900 border-dark-700 text-white mt-1"
              placeholder="465"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-400">Utilizador SMTP *</Label>
            <Input
              value={config.smtp_user}
              onChange={(e) => updateConfig('smtp_user', e.target.value)}
              className="bg-dark-900 border-dark-700 text-white mt-1"
              placeholder="info@mpgrupo.pt"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Password SMTP</Label>
            <div className="relative mt-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="bg-dark-900 border-dark-700 text-white pr-10"
                placeholder={config.smtp_password_set ? 'Password configurada (deixe vazio para manter)' : 'Introduza a password SMTP'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {config.smtp_password_set && (
              <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Password configurada nas variaveis de ambiente
              </p>
            )}
            {!config.smtp_password_set && (
              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Password nao configurada - emails podem falhar
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Email Identity */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Send className="w-4 h-4" style={{ color: '#06b6d4' }} />
          <h2 className="text-sm font-semibold text-white">Identidade de Envio</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-slate-400">Email de Envio (From) *</Label>
            <Input
              value={config.from_email}
              onChange={(e) => updateConfig('from_email', e.target.value)}
              className="bg-dark-900 border-dark-700 text-white mt-1"
              placeholder="info@mpgrupo.pt"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Nome de Envio *</Label>
            <Input
              value={config.from_name}
              onChange={(e) => updateConfig('from_name', e.target.value)}
              className="bg-dark-900 border-dark-700 text-white mt-1"
              placeholder="MP Grupo CRM"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-slate-400">Email de Resposta (Reply-To)</Label>
          <Input
            value={config.reply_to || ''}
            onChange={(e) => updateConfig('reply_to', e.target.value)}
            className="bg-dark-900 border-dark-700 text-white mt-1"
            placeholder="geral@marciopinto.pt"
          />
        </div>
      </div>

      {/* BCC Configuration */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4" style={{ color: '#06b6d4' }} />
          <h2 className="text-sm font-semibold text-white">BCC (Copia Oculta)</h2>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={config.bcc_enabled || false}
            onCheckedChange={(v) => updateConfig('bcc_enabled', v)}
          />
          <Label className="text-sm text-slate-300">Ativar BCC em todos os envios</Label>
        </div>

        {config.bcc_enabled && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={bccInput}
                onChange={(e) => setBccInput(e.target.value)}
                className="bg-dark-900 border-dark-700 text-white flex-1"
                placeholder="email@exemplo.pt"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBccEmail(); } }}
              />
              <Button size="sm" onClick={addBccEmail} variant="outline" className="gap-1">
                Adicionar
              </Button>
            </div>
            {(config.bcc_emails || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(config.bcc_emails || []).map(email => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                    style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}
                  >
                    {email}
                    <button onClick={() => removeBccEmail(email)} className="hover:text-red-400 ml-1">
                      <XCircle className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Toggle Settings */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
        <div className="flex items-center gap-2 mb-2">
          <ToggleLeft className="w-4 h-4" style={{ color: '#06b6d4' }} />
          <h2 className="text-sm font-semibold text-white">Definicoes de Envio</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.08)' }}>
            <div>
              <p className="text-sm text-white">Email de Nova Venda</p>
              <p className="text-[10px] text-slate-500">Notificacao enviada quando e registada uma nova venda</p>
            </div>
            <Switch
              checked={config.new_sale_email_enabled ?? true}
              onCheckedChange={(v) => updateConfig('new_sale_email_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.08)' }}>
            <div>
              <p className="text-sm text-white">Email de Alertas</p>
              <p className="text-[10px] text-slate-500">Notificacoes de alertas do sistema</p>
            </div>
            <Switch
              checked={config.alert_email_enabled ?? true}
              onCheckedChange={(v) => updateConfig('alert_email_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.08)' }}>
            <div>
              <p className="text-sm text-white">Email de Relatorio de Comissoes</p>
              <p className="text-[10px] text-slate-500">Relatorios mensais de comissoes enviados aos parceiros</p>
            </div>
            <Switch
              checked={config.commission_report_email_enabled ?? true}
              onCheckedChange={(v) => updateConfig('commission_report_email_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(6, 182, 212, 0.03)', border: '1px solid rgba(6, 182, 212, 0.08)' }}>
            <div>
              <p className="text-sm text-white">Email de Notificacao da Operadora</p>
              <p className="text-[10px] text-slate-500">Notificacao enviada para a operadora quando e registada uma venda</p>
            </div>
            <Switch
              checked={config.operator_notification_email_enabled ?? true}
              onCheckedChange={(v) => updateConfig('operator_notification_email_enabled', v)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-[10px] text-slate-500">
          Nota: A password SMTP e gerida separadamente nas variaveis de ambiente do servidor por seguranca.
        </p>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="gap-2"
          style={{ background: '#06b6d4', color: '#080c14' }}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Settings className="w-4 h-4" />
          )}
          Guardar Configuracao
        </Button>
      </div>
    </div>
  );
}
