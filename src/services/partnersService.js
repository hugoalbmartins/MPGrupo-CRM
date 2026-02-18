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
      .order('name', { ascending: true });

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

      const nifValidation = validateNIF(partnerData.nif);
      if (!nifValidation.valid) {
        throw new Error(nifValidation.message);
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

      const emailForAuth = partnerData.email && partnerData.email.trim()
        ? partnerData.email.trim()
        : `${partnerCode.toLowerCase()}@noemail.mpgrupo.local`;

      const requestBody = {
        name: partnerData.name,
        email: emailForAuth,
        password: userPassword,
        role: 'partner',
        position: 'Parceiro',
        no_real_email: !partnerData.email || !partnerData.email.trim(),
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

      const responseClone = response.clone();
      let result;
      try {
        result = await response.json();
        console.log('8. Edge function response:', result);
      } catch (jsonError) {
        const responseText = await responseClone.text();
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
          email: emailForAuth,
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

      const linkApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`;
      const linkResponse = await fetch(linkApiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          name: partnerData.name,
          email: emailForAuth,
          role: 'partner',
          position: 'Parceiro',
          partner_id: partner.id,
        })
      });

      const linkResult = await linkResponse.json();
      if (linkResult.success) {
        console.log('12. User linked to partner, user_code:', linkResult.data?.user_code);
      } else {
        console.error('Error linking user to partner:', linkResult.error);
      }

      return { ...partner, initial_password: userPassword };
    } catch (error) {
      console.error('Partner creation failed:', error);
      throw error;
    }
  },

  async update(id, partnerData) {
    const nifValidation = validateNIF(partnerData.nif);
    if (!nifValidation.valid) {
      throw new Error(nifValidation.message);
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/delete-partner?partnerId=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to delete partner');
  },

  async getD2DLevels(partnerId) {
    const { data, error } = await supabase
      .from('partner_d2d_operator_levels')
      .select('*, operators(name)')
      .eq('partner_id', partnerId);

    if (error) throw error;
    return data || [];
  },

  async saveD2DLevels(partnerId, levels) {
    await supabase
      .from('partner_d2d_operator_levels')
      .delete()
      .eq('partner_id', partnerId);

    if (!levels || levels.length === 0) return [];

    const rows = levels
      .filter(l => l.d2d_level)
      .map(l => ({
        partner_id: partnerId,
        operator_id: l.operator_id,
        d2d_level: l.d2d_level,
      }));

    if (rows.length === 0) return [];

    const { data, error } = await supabase
      .from('partner_d2d_operator_levels')
      .insert(rows)
      .select();

    if (error) throw error;
    return data;
  },

  async getOperatorsWithD2DConfigs() {
    const { data, error } = await supabase
      .from('commission_configurations')
      .select('operator_id, d2d_level, operators(id, name)')
      .eq('partner_type', 'D2D')
      .not('d2d_level', 'is', null);

    if (error) throw error;

    const operatorMap = {};
    (data || []).forEach(row => {
      const opId = row.operator_id;
      if (!operatorMap[opId]) {
        operatorMap[opId] = {
          id: opId,
          name: row.operators?.name || opId,
          levels: new Set(),
        };
      }
      operatorMap[opId].levels.add(row.d2d_level);
    });

    return Object.values(operatorMap).map(op => ({
      ...op,
      levels: Array.from(op.levels).sort(),
    }));
  }
};
