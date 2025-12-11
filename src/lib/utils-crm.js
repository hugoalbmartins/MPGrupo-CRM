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
  return /^PT16\d{15}[A-Z]{2}$/i.test(cui);
}

export function validateNIF(nif) {
  const cleaned = nif.replace(/\D/g, '');

  if (cleaned.length !== 9 || !/^\d+$/.test(cleaned)) {
    return false;
  }

  if (cleaned[0] === '5') {
    return validateNIFCheckDigit(cleaned);
  }

  return true;
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
  const { data: partner } = await supabase
    .from('partners')
    .select('name')
    .eq('id', partnerId)
    .maybeSingle();

  if (!partner) return 'XXX00010';

  const namePrefix = partner.name.substring(0, 3).toUpperCase();
  const date = new Date(saleDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString();

  const { count } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('partner_id', partnerId)
    .gte('sale_date', startOfMonth)
    .lt('sale_date', endOfMonth);

  const sequence = String((count || 0) + 1).padStart(4, '0');
  return `${namePrefix}${sequence}${month}`;
}

export async function calculateCommission(operator, saleData, supabase) {
  if (operator.commission_mode === 'manual') {
    return 0.0;
  }

  const commissionConfig = operator.commission_config || {};
  const customerType = saleData.customer_type || saleData.client_type || 'particular';
  const scope = saleData.scope;

  const customerConfig = commissionConfig[customerType];
  if (!customerConfig) return 0.0;

  let serviceConfig;
  let energySaleType;

  if (scope === 'telecomunicacoes') {
    const serviceType = saleData.service_type || 'M3';
    serviceConfig = customerConfig[serviceType] || customerConfig.default || {};
  } else if (scope === 'energia') {
    energySaleType = saleData.energy_sale_type || operator.energy_type || 'eletricidade';
    serviceConfig = customerConfig[energySaleType] || customerConfig;
  } else {
    serviceConfig = customerConfig;
  }

  const tiers = serviceConfig.tiers || [];
  if (tiers.length === 0) return 0.0;

  let partnerSalesAtOperator = 0;

  if (scope === 'energia' && energySaleType) {
    const { count: energyCount } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', saleData.partner_id)
      .eq('operator_id', operator.id)
      .eq('scope', 'energia')
      .or(`energy_sale_type.eq.${energySaleType},energy_sale_type.eq.dual`);

    partnerSalesAtOperator = energyCount || 0;
  } else {
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', saleData.partner_id)
      .eq('operator_id', operator.id);

    partnerSalesAtOperator = count || 0;
  }

  const sortedTiers = [...tiers].sort((a, b) => (b.min_sales || 0) - (a.min_sales || 0));
  const applicableTier = sortedTiers.find(tier => partnerSalesAtOperator >= (tier.min_sales || 0)) || tiers[0];

  if (scope === 'telecomunicacoes') {
    const multiplier = applicableTier.multiplier || 0;
    const monthlyValue = saleData.monthly_value || 0;
    return multiplier * monthlyValue;
  } else {
    return applicableTier.commission_value || 0;
  }
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
