from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
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

from models import *
from utils import *

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'mp-grupo-crm-secret-2025')
JWT_ALGORITHM = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

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

# AUTH ENDPOINTS
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    password = user_data.password if user_data.password else generate_strong_password()
    
    if not validate_password(password):
        raise HTTPException(status_code=400, detail="Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char")
    
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
    
    token = create_token(user['id'], user['email'], user['role'], JWT_SECRET, JWT_ALGORITHM)
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
    
    if not validate_password(password_data.new_password):
        raise HTTPException(status_code=400, detail="Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char")
    
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

# PARTNERS ENDPOINTS
@api_router.post("/partners", response_model=Partner)
async def create_partner(partner_data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create partners")
    
    partner_code = await generate_partner_code(partner_data.partner_type, db)
    
    partner_dict = partner_data.model_dump()
    partner_dict['partner_code'] = partner_code
    partner_obj = Partner(**partner_dict)
    
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
    partner_dict['initial_password'] = user_password
    
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
        raise HTTPException(status_code=404)
    return Partner(**partner)

@api_router.put("/partners/{partner_id}", response_model=Partner)
async def update_partner(partner_id: str, partner_data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    update_dict = partner_data.model_dump(exclude={'partner_type'})
    await db.partners.update_one({"id": partner_id}, {"$set": update_dict})
    
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return Partner(**partner)

@api_router.post("/partners/{partner_id}/documents")
async def upload_partner_document(partner_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"partner_{file_id}{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    document = {
        "id": file_id,
        "filename": file.filename,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "file_path": str(file_path)
    }
    
    await db.partners.update_one({"id": partner_id}, {"$push": {"documents": document}})
    return document

@api_router.get("/partners/{partner_id}/documents/{document_id}")
async def download_partner_document(partner_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404)
    
    document = next((d for d in partner.get('documents', []) if d['id'] == document_id), None)
    if not document:
        raise HTTPException(status_code=404)
    
    return FileResponse(path=document['file_path'], filename=document['filename'])

# OPERATORS ENDPOINTS  
@api_router.post("/operators", response_model=Operator)
async def create_operator(operator_data: OperatorCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    operator_obj = Operator(**operator_data.model_dump())
    await db.operators.insert_one(operator_obj.model_dump())
    return operator_obj

@api_router.get("/operators")
async def get_operators(current_user: dict = Depends(get_current_user), include_hidden: bool = False, scope: Optional[str] = None):
    query = {"active": True}
    if not include_hidden:
        query["hidden"] = False
    if scope:
        query["$or"] = [{"scope": scope}, {"scope": "dual"}]
    
    operators = await db.operators.find(query, {"_id": 0}).to_list(1000)
    return operators

@api_router.put("/operators/{operator_id}")
async def update_operator(operator_id: str, operator_data: OperatorCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403)
    
    await db.operators.update_one({"id": operator_id}, {"$set": operator_data.model_dump()})
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    return operator

@api_router.post("/operators/{operator_id}/toggle-visibility")
async def toggle_operator_visibility(operator_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403)
    
    operator = await db.operators.find_one({"id": operator_id})
    new_hidden = not operator.get('hidden', False)
    await db.operators.update_one({"id": operator_id}, {"$set": {"hidden": new_hidden}})
    return {"hidden": new_hidden}

@api_router.delete("/operators/{operator_id}")
async def delete_operator(operator_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    await db.operators.delete_one({"id": operator_id})
    return {"message": "Deleted"}

# Continua no próximo bloco...
