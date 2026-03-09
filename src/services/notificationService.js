import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'BJEE_mv62Tnt5wGmJHwMCrjHii0ocGmAjFZKJ87to6AG1YdQ8hVNIILMKdMzyajjcdey2tc5BGmIGMLbdXXZ0b0';

let swRegistration = null;
let keepAliveInterval = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const notificationService = {
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;

    try {
      swRegistration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });

      swRegistration.addEventListener('updatefound', () => {
        const newWorker = swRegistration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.resubscribeAfterUpdate();
      });

      this.startKeepAlive();

      return swRegistration;
    } catch (error) {
      console.error('SW registration failed:', error);
      return null;
    }
  },

  startKeepAlive() {
    if (keepAliveInterval) clearInterval(keepAliveInterval);

    keepAliveInterval = setInterval(async () => {
      try {
        if (!swRegistration) {
          swRegistration = await navigator.serviceWorker.ready;
        }

        if (swRegistration?.active) {
          const mc = new MessageChannel();
          swRegistration.active.postMessage({ type: 'KEEP_ALIVE' }, [mc.port2]);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await this.ensurePushSubscription();
        }
      } catch (e) {
        // silent
      }
    }, 5 * 60 * 1000);
  },

  async ensurePushSubscription() {
    try {
      if (!('PushManager' in window)) return;
      if (Notification.permission !== 'granted') return;

      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.ready;
      }

      const existingSub = await swRegistration.pushManager.getSubscription();
      if (existingSub) {
        await this.savePushSubscription(existingSub);
      } else {
        await this.subscribeToPush();
      }
    } catch (e) {
      // silent
    }
  },

  async resubscribeAfterUpdate() {
    try {
      swRegistration = await navigator.serviceWorker.ready;
      const { data: { session } } = await supabase.auth.getSession();
      if (session && Notification.permission === 'granted') {
        await this.subscribeToPush();
      }
    } catch (e) {
      // silent
    }
  },

  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';

    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';

    try {
      const result = await Notification.requestPermission();
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  },

  getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  async subscribeToPush() {
    try {
      if (!('PushManager' in window)) return null;

      const permission = this.getPermissionStatus();
      if (permission !== 'granted') return null;

      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.ready;
      }

      const existingSub = await swRegistration.pushManager.getSubscription();
      if (existingSub) {
        await this.savePushSubscription(existingSub);
        return existingSub;
      }

      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await this.savePushSubscription(subscription);
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
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

  async savePushSubscription(subscription) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sub = subscription.toJSON();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: sub.endpoint,
          subscription: sub,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) console.error('Error saving push subscription:', error);
    } catch (error) {
      console.error('Error saving push subscription:', error);
    }
  },

  async removePushSubscription() {
    try {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existingSub = swRegistration
        ? await swRegistration.pushManager.getSubscription()
        : null;

      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);

      if (error) console.error('Error removing push subscription:', error);
    } catch (error) {
      console.error('Error removing push subscription:', error);
    }
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
