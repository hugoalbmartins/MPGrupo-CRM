import { supabase } from '../lib/supabase';
import { generateStrongPassword, validatePassword } from '../lib/utils-crm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const usersService = {
  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(userData) {
    const password = userData.password || generateStrongPassword();

    if (!validatePassword(password)) {
      throw new Error('Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: userData.name,
        email: userData.email,
        password,
        role: userData.role,
        position: userData.position,
        partner_id: userData.partner_id || null,
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

    const response = await fetch(`${SUPABASE_URL}/functions/v1/update-user`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        name: userData.name,
        email: userData.email,
        password: userData.password || undefined,
        role: userData.role,
        position: userData.position,
        partner_id: userData.partner_id || null,
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
  }
};
