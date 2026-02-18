import { supabase } from './supabase';

export const authService = {
  supabase,

  async clearInvalidSession() {
    try {
      if (!supabase) return;
      await supabase.auth.signOut();
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  },

  async signIn(emailOrCode, password) {
    if (!supabase) throw new Error('Supabase not initialized');

    let emailToUse = emailOrCode;

    if (emailOrCode.includes('@') && emailOrCode.toLowerCase().endsWith('@noemail.mpgrupo.local')) {
      throw new Error('Este parceiro nao tem email registado. Use o codigo de parceiro para fazer login.');
    }

    if (!emailOrCode.includes('@')) {
      const code = emailOrCode.toUpperCase();

      const { data: userByCode } = await supabase
        .from('users')
        .select('email')
        .eq('user_code', code)
        .maybeSingle();

      if (userByCode?.email) {
        emailToUse = userByCode.email;
      } else {
        const { data: partner, error: partnerError } = await supabase
          .from('partners')
          .select('user_id, users!partners_user_id_fkey(email)')
          .eq('partner_code', code)
          .maybeSingle();

        if (partnerError || !partner) {
          throw new Error('Codigo de utilizador ou parceiro invalido');
        }

        if (!partner.users?.email) {
          throw new Error('Email do parceiro nao encontrado');
        }

        emailToUse = partner.users.email;
      }
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
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
    if (!supabase) throw new Error('Supabase not initialized');

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
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    try {
      if (!supabase) return null;
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        return null;
      }

      if (!session) return null;

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('User data error:', error);
        return null;
      }

      return userData;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },

  async updatePassword(newPassword) {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  },

  async updateUserProfile(userId, updates) {
    if (!supabase) throw new Error('Supabase not initialized');

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
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },
};
