from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from io import BytesIO
import pandas as pd
from fastapi.responses import StreamingResponse, FileResponse
import shutil
import re
import secrets
import string
import calendar

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'mp-grupo-crm-secret-2025')
JWT_ALGORITHM = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Upload directory
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Helper functions
def generate_strong_password(length: int = 8) -> str:
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

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def generate_partner_code(partner_type: str) -> str:
    """Generate partner code: D2D1001, Rev1002, Rev+1003"""
    prefix = partner_type
    # Count existing partners of this type
    count = await db.partners.count_documents({"partner_type": partner_type})
    number = 1001 + count
    return f"{prefix}{number}"

async def generate_sale_code(partner_id: str, sale_date: str) -> str:
    """Generate sale code: ALB000311 (3 letters + 4 digits + month)"""
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        return "XXX00010"
    
    # Get first 3 letters of partner name
    name_prefix = partner['name'][:3].upper()
    
    # Get month from date
    date_obj = datetime.fromisoformat(sale_date.replace('Z', '+00:00'))
    month = date_obj.strftime('%m')
    
    # Count sales for this partner in this month
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

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    role: str
    position: str
    partner_id: Optional[str] = None
    must_change_password: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = None
    role: str
    position: str
    partner_id: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: User
    must_change_password: bool
    suggested_password: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class Partner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    partner_code: str
    partner_type: str
    name: str
    email: EmailStr
    communication_emails: List[str] = Field(default_factory=list)
    phone: str
    contact_person: str
    street: str
    door_number: str
    postal_code: str
    locality: str
    nif: str
    crc: Optional[str] = None
    documents: List[dict] = Field(default_factory=list)
    user_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartnerCreate(BaseModel):
    partner_type: str
    name: str
    email: EmailStr
    communication_emails: List[str] = Field(default_factory=list)
    phone: str
    contact_person: str
    street: str
    door_number: str
    postal_code: str
    locality: str
    nif: str
    crc: Optional[str] = None

class Operator(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    scope: str
    active: bool = True
    hidden: bool = False
    commission_config: dict = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OperatorCreate(BaseModel):
    name: str
    scope: str
    commission_config: dict = Field(default_factory=dict)

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_code: str
    date: str
    partner_id: str
    created_by_user_id: str
    scope: str
    client_name: str
    client_nif: str
    client_contact: str
    client_email: Optional[str] = None
    client_iban: Optional[str] = None
    operator_id: str
    service_type: Optional[str] = None
    monthly_value: Optional[float] = None
    requisition: Optional[str] = None
    cpe: Optional[str] = None
    power: Optional[str] = None
    entry_type: Optional[str] = None
    cui: Optional[str] = None
    tier: Optional[str] = None
    status: str = "Para registo"
    status_date: Optional[str] = None
    paid_by_operator: bool = False
    payment_date: Optional[str] = None
    commission: Optional[float] = None
    observations: Optional[str] = None
    notes: List[dict] = Field(default_factory=list)
    documents: List[dict] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaleCreate(BaseModel):
    date: str
    partner_id: str
    scope: str
    client_name: str
    client_nif: str
    client_contact: str
    client_email: Optional[str] = None
    client_iban: Optional[str] = None
    operator_id: str
    service_type: Optional[str] = None
    monthly_value: Optional[float] = None
    cpe: Optional[str] = None
    power: Optional[str] = None
    entry_type: Optional[str] = None
    cui: Optional[str] = None
    tier: Optional[str] = None
    observations: Optional[str] = None

class SaleUpdate(BaseModel):
    status: Optional[str] = None
    status_date: Optional[str] = None
    requisition: Optional[str] = None
    paid_by_operator: Optional[bool] = None
    payment_date: Optional[str] = None
    observations: Optional[str] = None

class NoteCreate(BaseModel):
    content: str

# Auth endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Generate password if not provided
    password = user_data.password if user_data.password else generate_strong_password()
    
    # Validate password strength
    if not re.match(r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$', password):
        raise HTTPException(status_code=400, detail="Password must be 8+ chars with 1 uppercase, 1 digit, 1 special")
    
    user_dict = user_data.model_dump(exclude={'password'})
    user_obj = User(**user_dict)
    
    doc = user_obj.model_dump()
    doc['password_hash'] = hash_password(password)
    
    await db.users.insert_one(doc)
    return user_obj

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'], user['role'])
    user_obj = User(**user)
    
    return LoginResponse(
        token=token,
        user=user_obj,
        must_change_password=user.get('must_change_password', False),
        suggested_password=generate_strong_password() if user.get('must_change_password') else None
    )

@api_router.post("/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    if password_data.new_password != password_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    if not re.match(r'^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$', password_data.new_password):
        raise HTTPException(status_code=400, detail="Password must be 8+ chars with 1 uppercase, 1 digit, 1 special")
    
    if not verify_password(password_data.current_password, current_user['password_hash']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = hash_password(password_data.new_password)
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"password_hash": new_hash, "must_change_password": False}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

@api_router.get("/auth/generate-password")
async def get_generated_password(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    return {"password": generate_strong_password()}

# Partners endpoints
@api_router.post("/partners", response_model=Partner)
async def create_partner(partner_data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create partners")
    
    # Generate partner code
    partner_code = await generate_partner_code(partner_data.partner_type)
    
    partner_dict = partner_data.model_dump()
    partner_dict['partner_code'] = partner_code
    partner_obj = Partner(**partner_dict)
    
    # Create associated user
    user_password = generate_strong_password()
    user_data = {
        "id": str(uuid.uuid4()),
        "name": partner_data.name,
        "email": partner_data.email,
        "role": "partner",
        "position": "Parceiro",
        "partner_id": partner_obj.id,
        "must_change_password": True,
        "password_hash": hash_password(user_password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_data)
    
    partner_dict = partner_obj.model_dump()
    partner_dict['user_id'] = user_data['id']
    
    await db.partners.insert_one(partner_dict)
    
    return Partner(**partner_dict)

@api_router.get("/partners", response_model=List[Partner])
async def get_partners(current_user: dict = Depends(get_current_user)):
    if current_user['role'] in ['partner', 'partner_commercial']:
        if current_user['role'] == 'partner':
            partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
            return [Partner(**partner)] if partner else []
        else:
            partner = await db.partners.find_one({"id": current_user['partner_id']}, {"_id": 0})
            return [Partner(**partner)] if partner else []
    
    partners = await db.partners.find({}, {"_id": 0}).sort("partner_code", 1).to_list(1000)
    return [Partner(**p) for p in partners]

@api_router.get("/partners/{partner_id}", response_model=Partner)
async def get_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return Partner(**partner)

@api_router.put("/partners/{partner_id}", response_model=Partner)
async def update_partner(partner_id: str, partner_data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    update_dict = partner_data.model_dump(exclude={'partner_type'})
    await db.partners.update_one({"id": partner_id}, {"$set": update_dict})
    
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return Partner(**partner)

# Continua no próximo ficheiro devido ao tamanho...
