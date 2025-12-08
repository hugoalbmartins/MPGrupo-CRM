import { supabase } from '../lib/supabase';

export const alertsService = {
  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .contains('user_ids', [user.id])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data || [];
  },

  async getUnreadCount() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { count, error } = await supabase
      .from('alerts')
      .select('*', { count: 'exact', head: true })
      .contains('user_ids', [user.id])
      .not('read_by', 'cs', `{${user.id}}`);

    if (error) throw error;
    return count || 0;
  },

  async markAsRead(alertId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: alert } = await supabase
      .from('alerts')
      .select('read_by')
      .eq('id', alertId)
      .single();

    const readBy = alert?.read_by || [];
    if (!readBy.includes(user.id)) {
      readBy.push(user.id);

      const { error } = await supabase
        .from('alerts')
        .update({ read_by: readBy })
        .eq('id', alertId);

      if (error) throw error;
    }
  },

  subscribeToAlerts(callback) {
    const { data: { user } } = supabase.auth.getUser();

    const subscription = supabase
      .channel('alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }
};
