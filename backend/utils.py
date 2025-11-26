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
