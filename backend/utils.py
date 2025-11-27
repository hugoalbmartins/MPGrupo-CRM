import bcrypt
import jwt
import secrets
import string
import re
from datetime import datetime, timezone, timedelta

def generate_strong_password(length: int = 8) -> str:
    """Generate password: 8 chars, 1 uppercase, 1 digit, 1 special"""
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = '!@#$%^&*'
    
    password = [
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]
    
    all_chars = uppercase + lowercase + digits + special
    password += [secrets.choice(all_chars) for _ in range(length - 3)]
    
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)

def validate_password(password: str) -> bool:
    """Validate password meets requirements"""
    return bool(re.match(r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$', password))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str, secret: str, algorithm: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, secret, algorithm=algorithm)

async def generate_partner_code(partner_type: str, db) -> str:
    """Generate: D2D1001, Rev1002, Rev+1003"""
    count = await db.partners.count_documents({"partner_type": partner_type})
    number = 1001 + count
    return f"{partner_type}{number}"

async def generate_sale_code(partner_id: str, sale_date: str, db) -> str:
    """Generate: ALB000311"""
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        return "XXX00010"
    
    name_prefix = partner['name'][:3].upper()
    date_obj = datetime.fromisoformat(sale_date.replace('Z', '+00:00'))
    month = date_obj.strftime('%m')
    
    start_of_month = date_obj.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if date_obj.month == 12:
        end_of_month = start_of_month.replace(year=start_of_month.year + 1, month=1)
    else:
        end_of_month = start_of_month.replace(month=start_of_month.month + 1)
    
    count = await db.sales.count_documents({
        "partner_id": partner_id,
        "date": {
            "$gte": start_of_month.isoformat(),
            "$lt": end_of_month.isoformat()
        }
    })
    
    sequence = str(count + 1).zfill(4)
    return f"{name_prefix}{sequence}{month}"

def validate_cpe(cpe: str) -> bool:
    """PT0002 + 12 digits + 2 letters"""
    return bool(re.match(r'^PT0002\d{12}[A-Z]{2}$', cpe.upper()))

def validate_cui(cui: str) -> bool:
    """PT16 + 15 digits + 2 letters"""
    return bool(re.match(r'^PT16\d{15}[A-Z]{2}$', cui.upper()))

def validate_nif(nif: str) -> bool:
    """Validate Portuguese NIF with check digit"""
    # Remove any spaces or non-digits
    nif = re.sub(r'\D', '', nif)
    
    # Must be exactly 9 digits
    if len(nif) != 9 or not nif.isdigit():
        return False
    
    # If starts with 5, validate check digit (CRC)
    if nif[0] == '5':
        return validate_nif_check_digit(nif)
    
    # For other NIFs, just check format
    return True

def validate_nif_check_digit(nif: str) -> bool:
    """Validate NIF check digit (CRC) for NIFs starting with 5"""
    if len(nif) != 9:
        return False
    
    # Multipliers for the first 8 digits
    multipliers = [9, 8, 7, 6, 5, 4, 3, 2]
    
    # Calculate sum
    total = sum(int(nif[i]) * multipliers[i] for i in range(8))
    
    # Calculate check digit
    remainder = total % 11
    check_digit = 11 - remainder
    
    # If check digit is 10 or 11, it becomes 0
    if check_digit >= 10:
        check_digit = 0
    
    # Compare with the 9th digit
    return check_digit == int(nif[8])

async def calculate_commission(operator, sale_data, db) -> float:
    """Calculate commission based on operator config and sale data"""
    commission_config = operator.get('commission_config', {})
    client_type = sale_data.get('client_type', 'particular')
    scope = sale_data.get('scope')
    
    # Get client type config
    client_config = commission_config.get(client_type, {})
    if not client_config:
        return 0.0
    
    # For telecomunicacoes, check service type (M3/M4)
    if scope == 'telecomunicacoes':
        service_type = sale_data.get('service_type', 'M3')
        service_config = client_config.get(service_type, {})
        if not service_config:
            service_config = client_config.get('default', {})
    else:
        service_config = client_config
    
    # Get tiers
    tiers = service_config.get('tiers', [])
    if not tiers:
        return 0.0
    
    # Count sales for THIS PARTNER at THIS OPERATOR
    # Each operator has its own tier progression per partner
    partner_id = sale_data.get('partner_id')
    partner_sales_at_operator = await db.sales.count_documents({
        'partner_id': partner_id,
        'operator_id': operator['id']
    })
    
    # Find applicable tier based on partner's sales count at this operator
    # Sort tiers by min_sales descending, find the first one that matches
    applicable_tier = tiers[0]  # Default to first tier
    for tier in sorted(tiers, key=lambda x: x.get('min_sales', 0), reverse=True):
        if partner_sales_at_operator >= tier.get('min_sales', 0):
            applicable_tier = tier
            break
    
    # Calculate commission
    if scope == 'telecomunicacoes':
        # Multiplier × monthly value
        multiplier = applicable_tier.get('multiplier', 0)
        monthly_value = sale_data.get('monthly_value', 0) or 0
        return multiplier * monthly_value
    else:
        # Fixed commission value
        return applicable_tier.get('commission_value', 0)


import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

async def send_email(to_emails: list, subject: str, html_content: str):
    """Send email using SMTP configuration from environment variables"""
    try:
        smtp_host = os.environ.get('SMTP_HOST', 'mail.marciopinto.pt')
        smtp_port = int(os.environ.get('SMTP_PORT', '465'))
        smtp_user = os.environ.get('SMTP_USER', 'crm-noreply@marciopinto.pt')
        smtp_password = os.environ.get('SMTP_PASSWORD', '')
        smtp_from = os.environ.get('SMTP_FROM', 'crm-noreply@marciopinto.pt')
        smtp_from_name = os.environ.get('SMTP_FROM_NAME', 'MP Grupo CRM')
        
        # Create message
        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = f"{smtp_from_name} <{smtp_from}>"
        message['To'] = ', '.join(to_emails)
        
        # Attach HTML content
        html_part = MIMEText(html_content, 'html', 'utf-8')
        message.attach(html_part)
        
        # Send email via SSL/TLS
        await aiosmtplib.send(
            message,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            use_tls=True,
            start_tls=False
        )
        
        print(f"✅ Email sent successfully to: {', '.join(to_emails)}")
        return True
        
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")
        return False
