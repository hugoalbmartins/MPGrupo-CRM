export function generateStrongPassword(length = 8) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';

  const password = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  const allChars = uppercase + lowercase + digits + special;
  for (let i = 0; i < length - 3; i++) {
    password.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

export function validatePassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/.test(password);
}

export function validateCPE(cpe) {
  return /^PT0002\d{12}[A-Z]{2}$/i.test(cpe);
}

export function validateCUI(cui) {
  return /^PT16\d{14}[A-Z]{2}$/i.test(cui);
}

export function validateNIF(nif) {
  const cleaned = nif.replace(/\D/g, '');

  if (cleaned.length !== 9 || !/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      message: 'NIF inválido: deve ter 9 dígitos'
    };
  }

  if (cleaned[0] === '5') {
    const isValid = validateNIFCheckDigit(cleaned);
    return {
      valid: isValid,
      message: isValid ? '' : 'NIF inválido: dígito de controlo CRC incorreto'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

export function validateNIFCheckDigit(nif) {
  if (nif.length !== 9) return false;

  const multipliers = [9, 8, 7, 6, 5, 4, 3, 2];
  const total = multipliers.reduce((sum, mult, i) => sum + parseInt(nif[i]) * mult, 0);

  let checkDigit = 11 - (total % 11);
  if (checkDigit >= 10) checkDigit = 0;

  return checkDigit === parseInt(nif[8]);
}

export async function generatePartnerCode(partnerType, supabase) {
  try {
    console.log('generatePartnerCode: Starting for type', partnerType);

    const { count, error } = await supabase
      .from('partners')
      .select('*', { count: 'exact', head: true })
      .eq('partner_type', partnerType);

    if (error) {
      console.error('generatePartnerCode: Query error:', error);
      throw error;
    }

    console.log('generatePartnerCode: Found', count, 'existing partners of type', partnerType);
    const number = 1001 + (count || 0);
    const code = `${partnerType}${number}`;
    console.log('generatePartnerCode: Generated code', code);
    return code;
  } catch (error) {
    console.error('generatePartnerCode: Failed:', error);
    throw error;
  }
}

export async function generateSaleCode(partnerId, saleDate, supabase) {
  let namePrefix = 'ADM';
  let queryBuilder = supabase
    .from('sales')
    .select('*', { count: 'exact', head: true });

  if (partnerId) {
    const { data: partner } = await supabase
      .from('partners')
      .select('name')
      .eq('id', partnerId)
      .maybeSingle();

    if (partner) {
      namePrefix = partner.name.substring(0, 3).toUpperCase();
    }
    queryBuilder = queryBuilder.eq('partner_id', partnerId);
  } else {
    queryBuilder = queryBuilder.is('partner_id', null);
  }

  const date = new Date(saleDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString();

  const { count } = await queryBuilder
    .gte('date', startOfMonth)
    .lt('date', endOfMonth);

  const sequence = String((count || 0) + 1).padStart(4, '0');
  return `${namePrefix}${sequence}${month}${year}`;
}

export async function calculateCommission(operator, saleData, supabase) {
  if (operator.commission_mode === 'manual') {
    return 0.0;
  }

  const clientType = saleData.customer_type || saleData.client_type || 'particular';
  const scope = saleData.scope;

  let partnerType = 'D2D';
  if (saleData.isAdminSale && saleData.isCommissioned) {
    partnerType = 'Rev';
  } else if (saleData.partner_id) {
    const { data: partner } = await supabase
      .from('partners')
      .select('partner_type')
      .eq('id', saleData.partner_id)
      .maybeSingle();

    partnerType = partner?.partner_type || 'D2D';
  }

  let serviceType = null;
  let activationType = null;

  if (scope === 'telecomunicacoes') {
    serviceType = saleData.service_type;
    activationType = saleData.activation_type;
  } else if (scope === 'energia') {
    serviceType = saleData.energy_sale_type || operator.energy_type || 'eletricidade';
  }

  let query = supabase
    .from('commission_configurations')
    .select('*')
    .eq('operator_id', operator.id)
    .eq('client_type', clientType)
    .eq('partner_type', partnerType);

  if (serviceType) {
    query = query.eq('service_type', serviceType);
  }

  if (activationType) {
    query = query.eq('activation_type', activationType);
  }

  query = query.order('min_sales', { ascending: false });

  const { data: commissionConfigs, error } = await query;

  if (error || !commissionConfigs || commissionConfigs.length === 0) {
    console.warn(`No commission config found for operator: ${operator.name}, client_type: ${clientType}, partner_type: ${partnerType}, service_type: ${serviceType}`);
    return 0.0;
  }

  const searchPartnerId = saleData.partner_id;
  let partnerSalesAtOperator = 0;

  if (searchPartnerId) {
    let countQuery = supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', searchPartnerId)
      .eq('operator_id', operator.id);

    if (scope === 'energia' && serviceType) {
      countQuery = countQuery.eq('scope', 'energia');
    } else if (scope === 'telecomunicacoes') {
      countQuery = countQuery.eq('scope', 'telecomunicacoes');
    }

    const { count } = await countQuery;
    partnerSalesAtOperator = count || 0;
  }

  const applicableTier = commissionConfigs.find(config =>
    partnerSalesAtOperator >= (config.min_sales || 0)
  ) || commissionConfigs[commissionConfigs.length - 1];

  if (!applicableTier) {
    return 0.0;
  }

  let baseCommission = 0;

  if (applicableTier.commission_mode === 'monthly_multiplier') {
    const monthlyValue = parseFloat(saleData.monthly_value || 0);
    const multiplier = parseFloat(applicableTier.commission_value || 0);
    baseCommission = monthlyValue * multiplier;
  } else if (applicableTier.commission_mode === 'fixed_value') {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  } else {
    baseCommission = parseFloat(applicableTier.commission_value || 0);
  }

  let bonuses = 0;
  if (saleData.has_direct_debit && applicableTier.has_direct_debit_bonus) {
    bonuses += parseFloat(applicableTier.direct_debit_value || 0);
  }
  if (saleData.has_electronic_invoice && applicableTier.has_electronic_invoice_bonus) {
    bonuses += parseFloat(applicableTier.electronic_invoice_value || 0);
  }

  return baseCommission + bonuses;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(value || 0);
}

export function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-PT');
}

export function formatDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('pt-PT');
}
