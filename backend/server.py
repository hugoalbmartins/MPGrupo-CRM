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

# SALES ENDPOINTS
@api_router.post(\"/sales\", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    # Validate date not future
    sale_date = datetime.fromisoformat(sale_data.date.replace('Z', '+00:00'))
    if sale_date > datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail=\"Cannot create sales with future dates\")\n    
    # Validate CPE if provided
    if sale_data.cpe:
        if not validate_cpe(sale_data.cpe):
            raise HTTPException(status_code=400, detail=\"CPE invalid format\")\n        sale_data.cpe = sale_data.cpe.upper()\n    \    # Validate CUI if provided
    if sale_data.cui:\n        if not validate_cui(sale_data.cui):\n            raise HTTPException(status_code=400, detail=\"CUI invalid format\")\n        sale_data.cui = sale_data.cui.upper()\n    \n    # Generate sale code\n    sale_code = await generate_sale_code(sale_data.partner_id, sale_data.date, db)\n    \n    # Determine initial status\n    if current_user['role'] in ['partner', 'partner_commercial']:\n        status = \"Para registo\"\n    else:\n        status = \"Pendente\"\n    \n    sale_dict = sale_data.model_dump()\n    sale_dict['sale_code'] = sale_code\n    sale_dict['created_by_user_id'] = current_user['id']\n    sale_dict['status'] = status\n    sale_dict['status_date'] = datetime.now(timezone.utc).isoformat()\n    \n    sale_obj = Sale(**sale_dict)\n    await db.sales.insert_one(sale_obj.model_dump())\n    \n    return sale_obj\n\n@api_router.get(\"/sales\")\nasync def get_sales(current_user: dict = Depends(get_current_user), status: Optional[str] = None):\n    query = {}\n    \n    if current_user['role'] == 'partner':\n        partner = await db.partners.find_one({\"user_id\": current_user['id']}, {\"_id\": 0})\n        if partner:\n            query[\"partner_id\"] = partner['id']\n    elif current_user['role'] == 'partner_commercial':\n        query[\"created_by_user_id\"] = current_user['id']\n    \n    if status:\n        query[\"status\"] = status\n    \n    sales = await db.sales.find(query, {\"_id\": 0}).sort(\"date\", -1).to_list(10000)\n    return sales\n\n@api_router.get(\"/sales/{sale_id}\")\nasync def get_sale(sale_id: str, current_user: dict = Depends(get_current_user)):\n    sale = await db.sales.find_one({\"id\": sale_id}, {\"_id\": 0})\n    if not sale:\n        raise HTTPException(status_code=404)\n    return sale\n\n@api_router.put(\"/sales/{sale_id}\")\nasync def update_sale(sale_id: str, sale_data: SaleUpdate, current_user: dict = Depends(get_current_user)):\n    if current_user['role'] not in ['admin', 'bo']:\n        raise HTTPException(status_code=403)\n    \n    update_dict = {k: v for k, v in sale_data.model_dump().items() if v is not None}\n    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()\n    \n    await db.sales.update_one({\"id\": sale_id}, {\"$set\": update_dict})\n    sale = await db.sales.find_one({\"id\": sale_id}, {\"_id\": 0})\n    return sale\n\n@api_router.post(\"/sales/{sale_id}/notes\")\nasync def add_note(sale_id: str, note_data: NoteCreate, current_user: dict = Depends(get_current_user)):\n    note = {\n        \"id\": str(uuid.uuid4()),\n        \"content\": note_data.content,\n        \"author\": current_user['name'],\n        \"author_role\": current_user['role'],\n        \"created_at\": datetime.now(timezone.utc).isoformat()\n    }\n    await db.sales.update_one({\"id\": sale_id}, {\"$push\": {\"notes\": note}})\n    return note\n\n@api_router.post(\"/sales/{sale_id}/documents\")\nasync def upload_sale_document(sale_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):\n    file_id = str(uuid.uuid4())\n    file_extension = Path(file.filename).suffix\n    file_path = UPLOAD_DIR / f\"sale_{file_id}{file_extension}\"\n    \n    with file_path.open(\"wb\") as buffer:\n        shutil.copyfileobj(file.file, buffer)\n    \n    document = {\n        \"id\": file_id,\n        \"filename\": file.filename,\n        \"uploaded_by\": current_user['name'],\n        \"uploaded_at\": datetime.now(timezone.utc).isoformat(),\n        \"file_path\": str(file_path)\n    }\n    \n    await db.sales.update_one({\"id\": sale_id}, {\"$push\": {\"documents\": document}})\n    return document\n\n@api_router.get(\"/sales/{sale_id}/documents/{document_id}\")\nasync def download_sale_document(sale_id: str, document_id: str, current_user: dict = Depends(get_current_user)):\n    sale = await db.sales.find_one({\"id\": sale_id}, {\"_id\": 0})\n    if not sale:\n        raise HTTPException(status_code=404)\n    \n    document = next((d for d in sale.get('documents', []) if d['id'] == document_id), None)\n    if not document:\n        raise HTTPException(status_code=404)\n    \n    return FileResponse(path=document['file_path'], filename=document['filename'])\n\n# DASHBOARD ENDPOINTS\n@api_router.get(\"/dashboard/stats\")\nasync def get_dashboard_stats(current_user: dict = Depends(get_current_user)):\n    query = {}\n    \n    if current_user['role'] == 'partner':\n        partner = await db.partners.find_one({\"user_id\": current_user['id']}, {\"_id\": 0})\n        if partner:\n            query[\"partner_id\"] = partner['id']\n    elif current_user['role'] == 'partner_commercial':\n        query[\"created_by_user_id\"] = current_user['id']\n    \n    sales = await db.sales.find(query, {\"_id\": 0}).to_list(10000)\n    \n    # Calculate stats based on user role\n    stats = {\n        \"total_sales\": len(sales),\n        \"telecomunicacoes\": {\"count\": 0, \"monthly_total\": 0},\n        \"energia\": {\"count\": 0},\n        \"solar\": {\"count\": 0},\n        \"dual\": {\"count\": 0},\n        \"by_status\": {},\n        \"by_operator\": {},\n        \"daily_evolution\": [],\n        \"monthly_evolution\": [],\n        \"paid_by_operator\": 0\n    }\n    \n    for sale in sales:\n        scope = sale.get('scope', '')\n        if scope == 'telecomunicacoes':\n            stats['telecomunicacoes']['count'] += 1\n            stats['telecomunicacoes']['monthly_total'] += sale.get('monthly_value', 0) or 0\n        elif scope == 'energia':\n            stats['energia']['count'] += 1\n        elif scope == 'solar':\n            stats['solar']['count'] += 1\n        elif scope == 'dual':\n            stats['dual']['count'] += 1\n        \n        # By status\n        status = sale.get('status', 'Para registo')\n        stats['by_status'][status] = stats['by_status'].get(status, 0) + 1\n        \n        # By operator\n        op_id = sale.get('operator_id')\n        if op_id:\n            stats['by_operator'][op_id] = stats['by_operator'].get(op_id, 0) + 1\n        \n        # Paid by operator\n        if sale.get('paid_by_operator'):\n            stats['paid_by_operator'] += 1\n        \n        # Add commission if allowed\n        if current_user['role'] not in ['partner_commercial', 'bo']:\n            if 'total_commission' not in stats:\n                stats['total_commission'] = 0\n            stats['total_commission'] += sale.get('commission', 0) or 0\n    \n    return stats\n\n# EXPORT ENDPOINT\n@api_router.get(\"/sales/export/excel\")\nasync def export_sales(\n    start_date: Optional[str] = None,\n    end_date: Optional[str] = None,\n    current_user: dict = Depends(get_current_user)\n):\n    if current_user['role'] not in ['admin', 'bo']:\n        raise HTTPException(status_code=403)\n    \n    # Default to current month\n    if not start_date:\n        now = datetime.now(timezone.utc)\n        start_date = now.replace(day=1, hour=0, minute=0, second=0).isoformat()\n    if not end_date:\n        end_date = datetime.now(timezone.utc).isoformat()\n    \n    query = {\n        \"date\": {\n            \"$gte\": start_date,\n            \"$lte\": end_date\n        }\n    }\n    \n    sales = await db.sales.find(query, {\"_id\": 0}).to_list(10000)\n    \n    export_data = []\n    for sale in sales:\n        partner = await db.partners.find_one({\"id\": sale['partner_id']}, {\"_id\": 0})\n        operator = await db.operators.find_one({\"id\": sale['operator_id']}, {\"_id\": 0})\n        \n        row = {\n            'Código Venda': sale.get('sale_code', ''),\n            'Data': sale.get('date', ''),\n            'Parceiro': partner.get('name', '') if partner else '',\n            'Código Parceiro': partner.get('partner_code', '') if partner else '',\n            'Âmbito': sale.get('scope', ''),\n            'Cliente': sale.get('client_name', ''),\n            'NIF Cliente': sale.get('client_nif', ''),\n            'Contacto': sale.get('client_contact', ''),\n            'Operadora': operator.get('name', '') if operator else '',\n            'Status': sale.get('status', ''),\n            'Comissão': sale.get('commission', 0) if current_user['role'] == 'admin' else '',\n            'Pago Operador': 'Sim' if sale.get('paid_by_operator') else 'Não',\n        }\n        \n        if sale.get('cpe'):\n            row['CPE'] = sale['cpe']\n        if sale.get('cui'):\n            row['CUI'] = sale['cui']\n        if sale.get('monthly_value'):\n            row['Mensalidade'] = sale['monthly_value']\n        if sale.get('requisition'):\n            row['Requisição'] = sale['requisition']\n        \n        export_data.append(row)\n    \n    df = pd.DataFrame(export_data)\n    \n    output = BytesIO()\n    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:\n        df.to_excel(writer, index=False, sheet_name='Vendas')\n    \n    output.seek(0)\n    \n    return StreamingResponse(\n        output,\n        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',\n        headers={'Content-Disposition': 'attachment; filename=vendas.xlsx'}\n    )\n\n# USERS ENDPOINT\n@api_router.get(\"/users\", response_model=List[User])\nasync def get_users(current_user: dict = Depends(get_current_user)):\n    if current_user['role'] != 'admin':\n        raise HTTPException(status_code=403)\n    \n    users = await db.users.find({}, {\"_id\": 0, \"password_hash\": 0}).to_list(1000)\n    return [User(**u) for u in users]\n\napp.include_router(api_router)\n\napp.add_middleware(\n    CORSMiddleware,\n    allow_credentials=True,\n    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),\n    allow_methods=[\"*\"],\n    allow_headers=[\"*\"],\n)\n\nlogging.basicConfig(\n    level=logging.INFO,\n    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'\n)\nlogger = logging.getLogger(__name__)\n\n@app.on_event(\"startup\")\nasync def startup_db():\n    # Create initial admin\n    existing = await db.users.find_one({\"email\": \"hugoalbmartins@gmail.com\"}, {\"_id\": 0})\n    if not existing:\n        from utils import hash_password\n        admin_user = User(\n            name=\"Hugo Martins\",\n            email=\"hugoalbmartins@gmail.com\",\n            role=\"admin\",\n            position=\"Gestor de parceiros\",\n            must_change_password=False\n        )\n        doc = admin_user.model_dump()\n        doc['password_hash'] = hash_password(\"12345Hm\")\n        await db.users.insert_one(doc)\n        logger.info(\"Initial admin created\")\n    \n    logger.info(\"Database initialized\")\n\n@app.on_event(\"shutdown\")\nasync def shutdown_db_client():\n    client.close()"
