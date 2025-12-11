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
    try {
      console.log('1. Starting partner creation...');
      console.log('1a. Partner data:', partnerData);

      const { data: { user } } = await supabase.auth.getUser();
      console.log('1b. Current auth user:', user?.id, user?.email);

      const { data: currentUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      console.log('1c. Current user from DB:', currentUser);

      if (!validateNIF(partnerData.nif)) {
        if (partnerData.nif.startsWith('5')) {
          throw new Error('NIF inválido: dígito de controlo CRC incorreto');
        } else {
          throw new Error('NIF inválido: formato incorreto');
        }
      }

      console.log('2. NIF validated successfully');

      console.log('2a. About to call generatePartnerCode...');
      const partnerCode = await generatePartnerCode(partnerData.partner_type, supabase);
      console.log('3. Generated partner code:', partnerCode);

      const userPassword = generateStrongPassword();
      console.log('4. Generated password');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      console.log('5. Session obtained, token length:', session.access_token?.length);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      console.log('6. Calling edge function:', apiUrl);

      const requestBody = {
        name: partnerData.name,
        email: partnerData.email,
        password: userPassword,
        role: 'partner',
        position: 'Parceiro'
      };
      console.log('6a. Request body:', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('7. Edge function response status:', response.status);
      console.log('7a. Response headers:', Object.fromEntries(response.headers.entries()));

      const responseText = await response.text();
      console.log('7b. Raw response:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('8. Edge function response:', result);
      } catch (jsonError) {
        console.error('Failed to parse edge function response:', jsonError);
        console.error('Response was:', responseText);
        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 100)}`);
      }

      if (!response.ok || !result.success) {
        const errorMsg = result.error || `Erro HTTP ${response.status}`;
        console.error('Edge function error:', errorMsg);
        throw new Error(errorMsg);
      }

      const userId = result.data.id;
      console.log('9. User created with ID:', userId);

      console.log('10. Inserting partner record...');
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
          crc: partnerData.crc || null,
          iban: partnerData.iban || null,
          user_id: userId,
          initial_password: userPassword
        })
        .select()
        .maybeSingle();

      if (partnerError) {
        console.error('Partner insert error:', partnerError);
        throw new Error(`Erro ao criar parceiro na base de dados: ${partnerError.message}`);
      }

      if (!partner) {
        console.error('Partner created but not returned');
        throw new Error('Parceiro criado mas não retornado pela base de dados');
      }

      console.log('11. Partner created successfully:', partner.id);
      return { ...partner, initial_password: userPassword };
    } catch (error) {
      console.error('Partner creation failed:', error);
      throw error;
    }
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
      crc: partnerData.crc,
      iban: partnerData.iban
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
