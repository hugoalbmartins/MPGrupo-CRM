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
      .single();

    if (currentUser.role === 'partner') {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? [data] : [];
    }

    if (currentUser.role === 'partner_commercial') {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', currentUser.partner_id)
        .single();

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
      .single();

    if (error) throw error;
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

    const { data: { user: authUser }, error: signUpError } = await supabase.auth.signUp({
      email: partnerData.email,
      password: userPassword,
      options: {
        data: {
          name: partnerData.name,
          role: 'partner'
        }
      }
    });

    if (signUpError) throw signUpError;

    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        name: partnerData.name,
        email: partnerData.email,
        role: 'partner',
        position: 'Parceiro',
        must_change_password: true
      })
      .select()
      .single();

    if (userError) {
      await supabase.auth.admin.deleteUser(authUser.id);
      throw userError;
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
        user_id: authUser.id,
        initial_password: userPassword
      })
      .select()
      .single();

    if (partnerError) {
      await supabase.auth.admin.deleteUser(authUser.id);
      await supabase.from('users').delete().eq('id', authUser.id);
      throw partnerError;
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
      .single();

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
      .single();

    if (error) throw error;

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
