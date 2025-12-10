import { supabase } from '../lib/supabase';
import { generatePartnerCode, validateNIF, generateStrongPassword } from '../lib/utils-crm';

export const partnersService = {
  async getAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!currentUser) throw new Error('User not found');

    if (currentUser.role === 'partner') {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? [data] : [];
    }

    if (currentUser.role === 'partner_commercial') {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', currentUser.partner_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? [data] : [];
    }

    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .order('partner_code');

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Partner not found');
    return data;
  },

  async create(partnerData) {
    if (!validateNIF(partnerData.nif)) {
      if (partnerData.nif.startsWith('5')) {
        throw new Error('NIF inválido: dígito de controlo CRC incorreto');
      } else {
        throw new Error('NIF inválido: formato incorreto');
      }
    }

    const partnerCode = await generatePartnerCode(partnerData.partner_type, supabase);
    const userPassword = generateStrongPassword();

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: partnerData.email,
      password: userPassword,
      options: {
        data: {
          name: partnerData.name,
          role: 'partner'
        }
      }
    });

    if (signUpError) {
      if (signUpError.message?.includes('already registered') || signUpError.status === 422) {
        throw new Error('Este email já está registado. Por favor, use outro email.');
      }
      throw signUpError;
    }

    if (!authData?.user) throw new Error('Failed to create auth user');

    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        name: partnerData.name,
        email: partnerData.email,
        role: 'partner',
        position: 'Parceiro',
        must_change_password: true
      })
      .select()
      .maybeSingle();

    if (userError) {
      console.error('Failed to create user profile for partner:', userError);
      console.warn('Auth user created but profile insert failed. User ID:', authData.user.id);
      throw new Error(`Failed to create user profile: ${userError.message}`);
    }

    if (!userProfile) {
      throw new Error('User profile created but not returned from database');
    }

    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .insert({
        partner_code: partnerCode,
        partner_type: partnerData.partner_type,
        name: partnerData.name,
        email: partnerData.email,
        communication_emails: partnerData.communication_emails || [],
        phone: partnerData.phone,
        contact_person: partnerData.contact_person,
        street: partnerData.street,
        door_number: partnerData.door_number,
        postal_code: partnerData.postal_code,
        locality: partnerData.locality,
        nif: partnerData.nif,
        crc: partnerData.crc,
        user_id: authData.user.id,
        initial_password: userPassword
      })
      .select()
      .maybeSingle();

    if (partnerError) {
      console.error('Failed to create partner record:', partnerError);
      console.warn('User profile created but partner insert failed. User ID:', authData.user.id);
      await supabase.from('users').delete().eq('id', authData.user.id).then(
        ({ error: delError }) => {
          if (delError) console.error('Failed to cleanup user profile:', delError);
        }
      );
      throw new Error(`Failed to create partner: ${partnerError.message}`);
    }

    if (!partner) {
      throw new Error('Partner created but not returned from database');
    }

    return { ...partner, initial_password: userPassword };
  },

  async update(id, partnerData) {
    if (!validateNIF(partnerData.nif)) {
      if (partnerData.nif.startsWith('5')) {
        throw new Error('NIF inválido: dígito de controlo CRC incorreto');
      } else {
        throw new Error('NIF inválido: formato incorreto');
      }
    }

    const { data: oldPartner } = await supabase
      .from('partners')
      .select('email, user_id')
      .eq('id', id)
      .maybeSingle();

    if (!oldPartner) throw new Error('Partner not found');

    const updateData = {
      name: partnerData.name,
      email: partnerData.email,
      communication_emails: partnerData.communication_emails || [],
      phone: partnerData.phone,
      contact_person: partnerData.contact_person,
      street: partnerData.street,
      door_number: partnerData.door_number,
      postal_code: partnerData.postal_code,
      locality: partnerData.locality,
      nif: partnerData.nif,
      crc: partnerData.crc
    };

    const { data, error } = await supabase
      .from('partners')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Partner update failed');

    if (oldPartner && oldPartner.email !== partnerData.email && oldPartner.user_id) {
      await supabase
        .from('users')
        .update({ email: partnerData.email })
        .eq('id', oldPartner.user_id);
    }

    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
