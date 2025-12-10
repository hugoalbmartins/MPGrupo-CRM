import { supabase } from '../lib/supabase';
import { generateStrongPassword, validatePassword } from '../lib/utils-crm';

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

    const { data: { user: authUser }, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password,
      options: {
        data: {
          name: userData.name,
          role: userData.role
        }
      }
    });

    if (signUpError) throw signUpError;

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        position: userData.position,
        partner_id: userData.partner_id || null,
        must_change_password: true
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create user profile:', error);
      console.warn('Auth user created but profile insert failed. Auth user ID:', authUser.id);
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    return { ...data, initial_password: password };
  },

  async update(userId, userData) {
    const updateData = {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      position: userData.position,
      partner_id: userData.partner_id || null
    };

    if (userData.password) {
      if (!validatePassword(userData.password)) {
        throw new Error('Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char');
      }

      const { error: authError } = await supabase.auth.updateUser({
        password: userData.password
      });

      if (authError) throw authError;

      updateData.must_change_password = true;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(userId) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw error;
  },

  generatePassword() {
    return generateStrongPassword();
  }
};
