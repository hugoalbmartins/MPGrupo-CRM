import { supabase } from '../lib/supabase';

let swRegistration = null;

export const notificationService = {
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;

    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
      return swRegistration;
    } catch (error) {
      console.error('SW registration failed:', error);
      return null;
    }
  },

  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';

    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    const result = await Notification.requestPermission();
    return result;
  },

  getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  showNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (swRegistration) {
      swRegistration.showNotification(title, {
        icon: '/logo.png',
        badge: '/favicon.png',
        vibrate: [200, 100, 200],
        tag: 'crm-notification',
        renotify: true,
        ...options
      });
    } else {
      new Notification(title, {
        icon: '/logo.png',
        ...options
      });
    }
  },

  showNewSaleNotification(saleCode, customerName, operatorName) {
    this.showNotification(`Nova Venda - ${operatorName}`, {
      body: `${customerName} - ${saleCode}`,
      tag: `new-sale-${saleCode}`,
      data: { url: '/sales' }
    });
  },

  showSaleEditNotification(saleCode, changedFields) {
    this.showNotification(`Venda Editada - ${saleCode}`, {
      body: `Campos alterados: ${changedFields}`,
      tag: `edit-${saleCode}`,
      data: { url: '/sales' }
    });
  },

  showNoteNotification(saleCode, notePreview) {
    this.showNotification(`Nova Nota - ${saleCode}`, {
      body: notePreview,
      tag: `note-${saleCode}`,
      data: { url: '/alerts' }
    });
  },

  showProposalReminderNotification(count) {
    this.showNotification('Propostas Pendentes', {
      body: `Tem ${count} proposta(s) pendente(s) ha mais de 7 dias.`,
      tag: 'proposal-reminder',
      data: { url: '/sales' }
    });
  },

  async savePushSubscription(subscription) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sub = subscription.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys?.p256dh || '',
        auth_key: sub.keys?.auth || '',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) console.error('Error saving push subscription:', error);
  },

  async removePushSubscription() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id);

    if (error) console.error('Error removing push subscription:', error);
  },

  isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  },

  canInstallPWA() {
    return !!window._deferredPWAPrompt;
  },

  async installPWA() {
    const prompt = window._deferredPWAPrompt;
    if (!prompt) return false;

    prompt.prompt();
    const result = await prompt.userChoice;
    window._deferredPWAPrompt = null;
    return result.outcome === 'accepted';
  }
};
