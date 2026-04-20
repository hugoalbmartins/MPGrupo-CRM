import { supabase } from '../lib/supabase';
import { generateStrongPassword, validatePassword } from '../lib/utils-crm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const usersService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }

      const usersWithPartners = await Promise.all((data || []).map(async (user) => {
        if (user.partner_id) {
          const { data: partner } = await supabase
            .from('partners')
            .select('partner_type, name')
            .eq('id', user.partner_id)
            .maybeSingle();

          return { ...user, partner };
        }

        const { data: partner } = await supabase
          .from('partners')
          .select('partner_type, name')
          .eq('user_id', user.id)
          .maybeSingle();

        return { ...user, partner };
      }));

      return usersWithPartners;
    } catch (error) {
      console.error('Unexpected error in getAll:', error);
      throw error;
    }
  },

  async create(userData) {
    const password = userData.password || generateStrongPassword();

    if (!validatePassword(password)) {
      throw new Error('Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const hasRealEmail = userData.email && userData.email.trim() && !userData.email.endsWith('@noemail.mpgrupo.local');
    const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    const emailForAuth = hasRealEmail
      ? userData.email.trim()
      : `user.${uniqueSuffix}@noemail.mpgrupo.local`;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: userData.name,
        email: emailForAuth,
        password,
        role: userData.role,
        position: userData.position,
        partner_id: userData.partner_id || null,
        is_commissioned: userData.is_commissioned || false,
        no_real_email: !hasRealEmail,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create user');
    }

    return result.data;
  },

  async update(userId, userData) {
    if (userData.password && !validatePassword(userData.password)) {
      throw new Error('Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    const currentEmailIsSynthetic = existingUser?.email?.endsWith('@noemail.mpgrupo.local');
    const hasNewRealEmail = userData.email && userData.email.trim() && !userData.email.endsWith('@noemail.mpgrupo.local');
    const emailToSend = hasNewRealEmail ? userData.email.trim() : (currentEmailIsSynthetic ? existingUser.email : userData.email);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-user`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        name: userData.name,
        email: emailToSend,
        password: userData.password || undefined,
        role: userData.role,
        position: userData.position,
        partner_id: userData.partner_id || null,
        is_commissioned: userData.is_commissioned || false,
        no_real_email: !hasNewRealEmail && currentEmailIsSynthetic,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to update user');
    }

    return result.data;
  },

  async delete(userId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user?userId=${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete user');
    }
  },

  generatePassword() {
    return generateStrongPassword();
  },

  async getCurrentUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateEmailAlertPreference(enabled) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('users')
      .update({ email_alerts_enabled: enabled })
      .eq('id', authUser.id);

    if (error) throw error;
    return true;
  },

  async resetPassword(userId, newPassword) {
    if (!validatePassword(newPassword)) {
      throw new Error('Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        new_password: newPassword,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to reset password');
    }

    return result;
  }
};
