import { supabase } from './supabase';

export const authService = {
  supabase,

  async clearInvalidSession() {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.reload();
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  },

  async signIn(email, password) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) throw new Error('User profile not found');

    return {
      session: authData.session,
      user: userData,
    };
  },

  async signUp(email, password, userMetadata) {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userMetadata,
      },
    });

    if (authError) throw authError;
    return authData;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        if (sessionError.message?.includes('session_not_found')) {
          await this.clearInvalidSession();
          return null;
        }
        throw sessionError;
      }

      if (!session) return null;

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        if (error.message?.includes('session_not_found') || error.code === 'PGRST301') {
          await this.clearInvalidSession();
          return null;
        }
        throw error;
      }

      return userData;
    } catch (error) {
      if (error.message?.includes('session_not_found')) {
        await this.clearInvalidSession();
        return null;
      }
      throw error;
    }
  },

  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  },

  async updateUserProfile(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('User not found or update failed');
    return data;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },
};
