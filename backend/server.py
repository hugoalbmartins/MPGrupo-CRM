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
from fastapi.responses import StreamingResponse, FileResponse, Response
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
    
    # Validate NIF
    if not validate_nif(partner_data.nif):
        if partner_data.nif.startswith('5'):
            raise HTTPException(status_code=400, detail="NIF inválido: dígito de controlo CRC incorreto")
        else:
            raise HTTPException(status_code=400, detail="NIF inválido: formato incorreto")
    
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
    
    # Validate NIF
    if not validate_nif(partner_data.nif):
        if partner_data.nif.startswith('5'):
            raise HTTPException(status_code=400, detail="NIF inválido: dígito de controlo CRC incorreto")
        else:
            raise HTTPException(status_code=400, detail="NIF inválido: formato incorreto")
    
    # Get current partner to check email change
    old_partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not old_partner:
        raise HTTPException(status_code=404)
    
    update_dict = partner_data.model_dump(exclude={'partner_type'})
    await db.partners.update_one({"id": partner_id}, {"$set": update_dict})
    
    # If email changed, update associated user
    if old_partner.get('email') != partner_data.email and old_partner.get('user_id'):
        await db.users.update_one(
            {"id": old_partner['user_id']},
            {"$set": {"email": partner_data.email}}
        )
    
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

@api_router.post("/operators/{operator_id}/upload")
async def upload_operator_document(
    operator_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can upload documents")
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    uploaded_docs = []
    for file in files:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail=f"Only PDF files allowed: {file.filename}")
        
        file_id = str(uuid.uuid4())
        file_extension = file.filename.split('.')[-1]
        filename = f"{file_id}.{file_extension}"
        file_path = UPLOAD_DIR / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        doc_info = {
            "id": file_id,
            "filename": file.filename,
            "filepath": str(file_path),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": current_user['id']
        }
        uploaded_docs.append(doc_info)
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$push": {"documents": {"$each": uploaded_docs}}}
    )
    
    return {"message": f"{len(uploaded_docs)} document(s) uploaded", "documents": uploaded_docs}

@api_router.delete("/operators/{operator_id}/documents/{doc_id}")
async def delete_operator_document(
    operator_id: str,
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    doc = next((d for d in operator.get('documents', []) if d['id'] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = Path(doc['filepath'])
    if file_path.exists():
        file_path.unlink()
    
    await db.operators.update_one(
        {"id": operator_id},
        {"$pull": {"documents": {"id": doc_id}}}
    )
    
    return {"message": "Document deleted"}

@api_router.get("/operators/{operator_id}/documents/{doc_id}/download")
async def download_operator_document(operator_id: str, doc_id: str, current_user: dict = Depends(get_current_user)):
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    doc = next((d for d in operator.get('documents', []) if d['id'] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = Path(doc['filepath'])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        path=file_path,
        filename=doc['filename'],
        media_type='application/pdf',
        headers={"Content-Disposition": f"attachment; filename={doc['filename']}"}
    )

# SALES ENDPOINTS
@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    # Validate date not future
    sale_date = datetime.fromisoformat(sale_data.date.replace('Z', '+00:00'))
    if sale_date > datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cannot create sales with future dates")
    
    # Validate CPE if provided
    if sale_data.cpe:
        if not validate_cpe(sale_data.cpe):
            raise HTTPException(status_code=400, detail="CPE invalid format")
        sale_data.cpe = sale_data.cpe.upper()
    
    # Validate CUI if provided
    if sale_data.cui:
        if not validate_cui(sale_data.cui):
            raise HTTPException(status_code=400, detail="CUI invalid format")
        sale_data.cui = sale_data.cui.upper()
    
    # Generate sale code
    sale_code = await generate_sale_code(sale_data.partner_id, sale_data.date, db)
    
    # Determine initial status
    if current_user['role'] in ['partner', 'partner_commercial']:
        status = "Para registo"
    else:
        status = "Pendente"
    
    # Get operator and set energy_type if applicable
    operator = await db.operators.find_one({"id": sale_data.operator_id}, {"_id": 0})
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    
    # Calculate commission
    commission = 0.0
    if operator:
        commission = await calculate_commission(operator, sale_data.model_dump(), db)
    
    sale_dict = sale_data.model_dump()
    
    # Set energy_type from operator if scope is energia
    if operator.get('scope') == 'energia':
        sale_dict['energy_type'] = operator.get('energy_type', 'eletricidade')
    
    sale_dict['sale_code'] = sale_code
    sale_dict['created_by_user_id'] = current_user['id']
    sale_dict['status'] = status
    sale_dict['status_date'] = datetime.now(timezone.utc).isoformat()
    sale_dict['commission'] = commission
    
    sale_obj = Sale(**sale_dict)
    await db.sales.insert_one(sale_obj.model_dump())
    
    # Create alert for new sale
    partner = await db.partners.find_one({"id": sale_data.partner_id}, {"_id": 0})
    partner_name = partner['name'] if partner else 'Desconhecido'
    await create_alert(
        "new_sale",
        sale_obj.id,
        sale_obj.sale_code,
        f"Nova venda registada: {sale_obj.sale_code} - {partner_name}",
        current_user
    )
    
    return sale_obj

@api_router.get("/sales")
async def get_sales(current_user: dict = Depends(get_current_user), status: Optional[str] = None):
    query = {}
    
    if current_user['role'] == 'partner':
        partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
        if partner:
            query["partner_id"] = partner['id']
    elif current_user['role'] == 'partner_commercial':
        query["created_by_user_id"] = current_user['id']
    
    if status:
        query["status"] = status
    
    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    return sales

@api_router.get("/sales/{sale_id}")
async def get_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404)
    return sale

@api_router.put("/sales/{sale_id}")
async def update_sale(sale_id: str, sale_data: SaleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403)
    
    # Get old sale to check status change
    old_sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    
    update_dict = {k: v for k, v in sale_data.model_dump().items() if v is not None}
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.sales.update_one({"id": sale_id}, {"$set": update_dict})
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    
    # Create alert if status changed to Concluído or Ativo
    if sale_data.status and old_sale['status'] != sale_data.status:
        if sale_data.status in ['Concluido', 'Ativo']:
            await create_alert(
                "status_change",
                sale_id,
                sale['sale_code'],
                f"Status alterado para {sale_data.status}: {sale['sale_code']}",
                current_user
            )
    
    return sale

@api_router.post("/sales/{sale_id}/notes")
async def add_note(sale_id: str, note_data: NoteCreate, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404)
    
    note = {
        "id": str(uuid.uuid4()),
        "content": note_data.content,
        "author": current_user['name'],
        "author_role": current_user['role'],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sales.update_one({"id": sale_id}, {"$push": {"notes": note}})
    
    # Create alert for new note
    await create_alert(
        "note_added",
        sale_id,
        sale['sale_code'],
        f"Nova nota adicionada em {sale['sale_code']} por {current_user['name']}",
        current_user
    )
    
    return note

@api_router.post("/sales/{sale_id}/documents")
async def upload_sale_document(sale_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_id = str(uuid.uuid4())
    file_extension = Path(file.filename).suffix
    file_path = UPLOAD_DIR / f"sale_{file_id}{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    document = {
        "id": file_id,
        "filename": file.filename,
        "uploaded_by": current_user['name'],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "file_path": str(file_path)
    }
    
    await db.sales.update_one({"id": sale_id}, {"$push": {"documents": document}})
    return document

@api_router.get("/sales/{sale_id}/documents/{document_id}")
async def download_sale_document(sale_id: str, document_id: str, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404)
    
    document = next((d for d in sale.get('documents', []) if d['id'] == document_id), None)
    if not document:
        raise HTTPException(status_code=404)
    
    return FileResponse(path=document['file_path'], filename=document['filename'])

@api_router.get("/sales/export/excel")
async def export_sales_to_excel(
    current_user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Export sales to Excel file with optional date filtering"""
    import pandas as pd
    from io import BytesIO
    
    # Build query
    query = {}
    
    # Role-based filtering
    if current_user['role'] == 'partner':
        partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
        if partner:
            query["partner_id"] = partner['id']
    elif current_user['role'] == 'partner_commercial':
        query["created_by_user_id"] = current_user['id']
    
    # Date filtering
    if start_date or end_date:
        query["date"] = {}
        if start_date:
            query["date"]["$gte"] = start_date
        if end_date:
            query["date"]["$lte"] = end_date
    
    # Get sales
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    
    # Get related data
    partners = await db.partners.find({}, {"_id": 0}).to_list(1000)
    operators = await db.operators.find({}, {"_id": 0}).to_list(1000)
    
    # Create dictionaries for lookups
    partner_dict = {p['id']: p['name'] for p in partners}
    operator_dict = {o['id']: o['name'] for o in operators}
    
    # Prepare data for Excel
    export_data = []
    for sale in sales:
        row = {
            'Código': sale.get('sale_code', ''),
            'Data': sale.get('date', '')[:10] if sale.get('date') else '',
            'Parceiro': partner_dict.get(sale.get('partner_id', ''), ''),
            'Âmbito': sale.get('scope', ''),
            'Tipo Cliente': sale.get('client_type', ''),
            'Nome Cliente': sale.get('client_name', ''),
            'NIF Cliente': sale.get('client_nif', ''),
            'Contacto Cliente': sale.get('client_contact', ''),
            'Operadora': operator_dict.get(sale.get('operator_id', ''), ''),
            'Status': sale.get('status', ''),
            'Requisição': sale.get('requisition', ''),
        }
        
        # Add commission if user has permission
        if current_user['role'] not in ['partner_commercial', 'bo']:
            row['Comissão (€)'] = sale.get('commission', 0)
        
        # Add scope-specific fields
        if sale.get('scope') == 'telecomunicacoes':
            row['Tipo Serviço'] = sale.get('service_type', '')
            row['Valor Mensalidade (€)'] = sale.get('monthly_value', 0)
        elif sale.get('scope') in ['energia', 'solar']:
            row['CPE'] = sale.get('cpe', '')
            row['Potência'] = sale.get('power', '')
        elif sale.get('scope') == 'dual':
            row['CPE'] = sale.get('cpe', '')
            row['Potência'] = sale.get('power', '')
            row['CUI'] = sale.get('cui', '')
            row['Escalão'] = sale.get('tier', '')
        
        row['Paga Operador'] = 'Sim' if sale.get('paid_by_operator') else 'Não'
        if sale.get('paid_date'):
            row['Data Pagamento'] = sale.get('paid_date', '')[:10]
        
        row['Observações'] = sale.get('observations', '')
        
        export_data.append(row)
    
    # Create DataFrame
    df = pd.DataFrame(export_data)
    
    # Create Excel file in memory
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Vendas', index=False)
        
        # Get workbook and worksheet
        workbook = writer.book
        worksheet = writer.sheets['Vendas']
        
        # Format header
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4F46E5',
            'font_color': 'white',
            'border': 1
        })
        
        # Apply header format
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
        
        # Auto-adjust column width
        for i, col in enumerate(df.columns):
            max_len = max(df[col].astype(str).apply(len).max(), len(col)) + 2
            worksheet.set_column(i, i, min(max_len, 50))
    
    output.seek(0)
    
    # Generate filename
    filename = f"vendas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )



# ALERTS ENDPOINTS
@api_router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    """Get all alerts for current user"""
    alerts = await db.alerts.find(
        {"user_ids": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return alerts

@api_router.get("/alerts/unread/count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread alerts for current user"""
    count = await db.alerts.count_documents({
        "user_ids": current_user['id'],
        "read_by": {"$ne": current_user['id']}
    })
    
    return {"count": count}

@api_router.post("/alerts/{alert_id}/mark-read")
async def mark_alert_read(alert_id: str, current_user: dict = Depends(get_current_user)):
    """Mark alert as read"""
    await db.alerts.update_one(
        {"id": alert_id},
        {"$addToSet": {"read_by": current_user['id']}}
    )
    
    return {"message": "Alert marked as read"}

async def create_alert(alert_type: str, sale_id: str, sale_code: str, message: str, created_by: dict):
    """Helper function to create alerts and send emails"""
    # Get sale to find partner and commercial
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        return
    
    # Build list of users to notify
    user_ids = []
    
    # Get partner user
    partner = await db.partners.find_one({"id": sale['partner_id']}, {"_id": 0})
    if partner and partner.get('user_id'):
        user_ids.append(partner['user_id'])
    
    # Get commercial user if exists
    if sale.get('created_by_user_id'):
        user_ids.append(sale['created_by_user_id'])
    
    # Get all admins and backoffice
    admin_bo_users = await db.users.find(
        {"role": {"$in": ["admin", "bo"]}},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    
    user_ids.extend([u['id'] for u in admin_bo_users])
    
    # Remove duplicates and creator
    user_ids = list(set(user_ids))
    if created_by['id'] in user_ids:
        user_ids.remove(created_by['id'])
    
    # Create alert
    alert = Alert(
        type=alert_type,
        sale_id=sale_id,
        sale_code=sale_code,
        message=message,
        user_ids=user_ids,
        created_by=created_by['id'],
        created_by_name=created_by['name']
    )
    
    await db.alerts.insert_one(alert.model_dump())
    
    # Send emails to notified users
    users_to_notify = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "email": 1, "name": 1}
    ).to_list(1000)
    
    if users_to_notify:
        emails = [u['email'] for u in users_to_notify]
        await send_alert_email(alert_type, sale, created_by, emails)
    

async def send_alert_email(alert_type: str, sale: dict, created_by: dict, emails: list):
    """Send email notification for alerts"""
    sale_code = sale.get('sale_code', 'N/A')
    partner_id = sale.get('partner_id', '')
    
    # Get partner name
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    partner_name = partner['name'] if partner else 'Desconhecido'
    
    # Get operator name
    operator = await db.operators.find_one({"id": sale.get('operator_id', '')}, {"_id": 0})
    operator_name = operator['name'] if operator else 'Desconhecida'
    
    # Build email content based on alert type
    if alert_type == 'new_sale':
        subject = f"🆕 Nova Venda Registada: {sale_code}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Nova Venda Registada</h1>
            </div>
            <div style="padding: 20px; background-color: #f5f5f5;">
                <p>Uma nova venda foi registada no sistema:</p>
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Código da Venda:</strong> {sale_code}</p>
                    <p><strong>Parceiro:</strong> {partner_name}</p>
                    <p><strong>Operadora:</strong> {operator_name}</p>
                    <p><strong>Cliente:</strong> {sale.get('client_name', 'N/A')}</p>
                    <p><strong>Âmbito:</strong> {sale.get('scope', 'N/A')}</p>
                    <p><strong>Status:</strong> {sale.get('status', 'N/A')}</p>
                    <p><strong>Registado por:</strong> {created_by['name']}</p>
                </div>
                <p style="color: #666; font-size: 12px;">Aceda ao CRM para mais detalhes.</p>
            </div>
        </body>
        </html>
        """
    elif alert_type == 'status_change':
        subject = f"📝 Alteração de Estado: {sale_code}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #10B981; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Estado da Venda Alterado</h1>
            </div>
            <div style="padding: 20px; background-color: #f5f5f5;">
                <p>O estado de uma venda foi alterado:</p>
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Código da Venda:</strong> {sale_code}</p>
                    <p><strong>Parceiro:</strong> {partner_name}</p>
                    <p><strong>Novo Estado:</strong> <span style="color: #10B981; font-weight: bold;">{sale.get('status', 'N/A')}</span></p>
                    <p><strong>Alterado por:</strong> {created_by['name']}</p>
                </div>
                <p style="color: #666; font-size: 12px;">Aceda ao CRM para mais detalhes.</p>
            </div>
        </body>
        </html>
        """
    elif alert_type == 'note_added':
        subject = f"💬 Nova Nota Adicionada: {sale_code}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #F59E0B; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Nova Nota Adicionada</h1>
            </div>
            <div style="padding: 20px; background-color: #f5f5f5;">
                <p>Uma nova nota foi adicionada a uma venda:</p>
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p><strong>Código da Venda:</strong> {sale_code}</p>
                    <p><strong>Parceiro:</strong> {partner_name}</p>
                    <p><strong>Adicionado por:</strong> {created_by['name']}</p>
                </div>
                <p style="color: #666; font-size: 12px;">Aceda ao CRM para ver a nota completa.</p>
            </div>
        </body>
        </html>
        """
    else:
        return
    
    # Send email
    await send_email(emails, subject, html_content)


# DASHBOARD ENDPOINTS
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    year: Optional[int] = None,
    month: Optional[int] = None
):
    role = current_user['role']
    
    # Default to current month/year
    now = datetime.now(timezone.utc)
    if year is None:
        year = now.year
    if month is None:
        month = now.month
    
    # Admin Dashboard - Full global metrics
    if role == 'admin':
        return await get_admin_dashboard(year, month)
    
    # Backoffice Dashboard - Sales metrics without commissions
    elif role == 'bo':
        return await get_bo_dashboard(year, month)
    
    # Partner Dashboard - Own sales with commissions
    elif role == 'partner':
        partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
        if not partner:
            return {"error": "Partner not found"}
        return await get_partner_dashboard(partner['id'], year, month)
    
    # Partner Commercial - Own registered sales without commissions
    elif role == 'partner_commercial':
        return await get_commercial_dashboard(current_user['id'], year, month)
    
    return {"total_sales": 0}

def get_month_range(year: int, month: int):
    """Get start and end datetime for a specific month"""
    start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    # Calculate end date (first day of next month)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    
    return start_date, end_date

async def get_last_12_months_data():
    """Get sales data for last 12 months grouped by month and scope"""
    now = datetime.now(timezone.utc)
    
    # Calculate date 12 months ago
    twelve_months_ago = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for _ in range(11):
        if twelve_months_ago.month == 1:
            twelve_months_ago = twelve_months_ago.replace(year=twelve_months_ago.year - 1, month=12)
        else:
            twelve_months_ago = twelve_months_ago.replace(month=twelve_months_ago.month - 1)
    
    sales = await db.sales.find({
        "date": {"$gte": twelve_months_ago.isoformat()}
    }, {"_id": 0}).to_list(10000)
    
    # Group by month and scope
    monthly_data = {}
    for sale in sales:
        sale_date = datetime.fromisoformat(sale['date'].replace('Z', '+00:00'))
        month_key = f"{sale_date.year}-{sale_date.month:02d}"
        
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                "month": month_key,
                "year": sale_date.year,
                "month_num": sale_date.month,
                "telecomunicacoes": 0,
                "energia": 0,
                "solar": 0,
                "dual": 0
            }
        
        scope = sale.get('scope', '')
        if scope in monthly_data[month_key]:
            monthly_data[month_key][scope] += 1
    
    # Convert to sorted list (last 12 months)
    result = []
    current = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for i in range(12):
        month_key = f"{current.year}-{current.month:02d}"
        if month_key in monthly_data:
            result.append(monthly_data[month_key])
        else:
            result.append({
                "month": month_key,
                "year": current.year,
                "month_num": current.month,
                "telecomunicacoes": 0,
                "energia": 0,
                "solar": 0,
                "dual": 0
            })
        
        # Go back one month
        if current.month == 1:
            current = current.replace(year=current.year - 1, month=12)
        else:
            current = current.replace(month=current.month - 1)
    
    return list(reversed(result))

async def get_admin_dashboard(year: int, month: int):
    """Admin sees everything including all commissions"""
    start_date, end_date = get_month_range(year, month)
    
    # Get sales for selected month
    sales = await db.sales.find({
        "date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    partners = await db.partners.find({}, {"_id": 0}).to_list(1000)
    operators = await db.operators.find({}, {"_id": 0}).to_list(1000)
    
    # Get 12 months data for chart
    last_12_months = await get_last_12_months_data()
    
    stats = {
        "total_sales": len(sales),
        "total_partners": len(partners),
        "telecomunicacoes": {"count": 0, "monthly_total": 0},
        "energia": {"count": 0},
        "solar": {"count": 0},
        "dual": {"count": 0},
        "by_status": {},
        "by_partner": {},
        "by_operator": {},
        "total_commission": 0,
        "commission_to_pay": 0,
        "paid_by_operator": 0,
        "unpaid_by_operator": 0,
        "daily_evolution": [],
        "commission_by_type": {}
    }
    
    for sale in sales:
        scope = sale.get('scope', '')
        commission = sale.get('commission', 0) or 0
        
        # By scope
        if scope == 'telecomunicacoes':
            stats['telecomunicacoes']['count'] += 1
            stats['telecomunicacoes']['monthly_total'] += sale.get('monthly_value', 0) or 0
        elif scope == 'energia':
            stats['energia']['count'] += 1
        elif scope == 'solar':
            stats['solar']['count'] += 1
        elif scope == 'dual':
            stats['dual']['count'] += 1
        
        # By status
        status = sale.get('status', 'Para registo')
        stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
        
        # By partner
        partner_id = sale.get('partner_id')
        if partner_id not in stats['by_partner']:
            stats['by_partner'][partner_id] = {"count": 0, "commission": 0}
        stats['by_partner'][partner_id]['count'] += 1
        stats['by_partner'][partner_id]['commission'] += commission
        
        # By operator
        op_id = sale.get('operator_id')
        if op_id:
            stats['by_operator'][op_id] = stats['by_operator'].get(op_id, 0) + 1
        
        # Commissions
        stats['total_commission'] += commission
        if sale.get('paid_by_operator'):
            stats['paid_by_operator'] += 1
        else:
            stats['unpaid_by_operator'] += 1
            # Commission to pay only for "Ativo" status
            if status == 'Ativo':
                stats['commission_to_pay'] += commission
        
        # Commission by type
        if scope not in stats['commission_by_type']:
            stats['commission_by_type'][scope] = 0
        stats['commission_by_type'][scope] += commission
    
    # Add selected month info and 12 months data
    stats['selected_month'] = month
    stats['selected_year'] = year
    stats['last_12_months'] = last_12_months
    
    return stats

async def get_bo_dashboard(year: int, month: int):
    """BO sees all sales quantities without commission values"""
    start_date, end_date = get_month_range(year, month)
    
    sales = await db.sales.find({
        "date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    partners = await db.partners.find({}, {"_id": 0}).to_list(1000)
    last_12_months = await get_last_12_months_data()
    
    stats = {
        "total_sales": len(sales),
        "telecomunicacoes": {"count": 0, "monthly_total": 0},
        "energia": {"count": 0},
        "solar": {"count": 0},
        "dual": {"count": 0},
        "by_status": {},
        "by_partner": {},
        "daily_evolution": []
    }
    
    for sale in sales:
        scope = sale.get('scope', '')
        
        if scope == 'telecomunicacoes':
            stats['telecomunicacoes']['count'] += 1
            stats['telecomunicacoes']['monthly_total'] += sale.get('monthly_value', 0) or 0
        elif scope == 'energia':
            stats['energia']['count'] += 1
        elif scope == 'solar':
            stats['solar']['count'] += 1
        elif scope == 'dual':
            stats['dual']['count'] += 1
        
        status = sale.get('status', 'Para registo')
        stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
        
        partner_id = sale.get('partner_id')
        if partner_id not in stats['by_partner']:
            stats['by_partner'][partner_id] = {"count": 0}
        stats['by_partner'][partner_id]['count'] += 1
    
    stats['selected_month'] = month
    stats['selected_year'] = year
    stats['last_12_months'] = last_12_months
    
    return stats

async def get_partner_dashboard(partner_id: str, year: int, month: int):
    """Partner sees only their own sales with commission details"""
    start_date, end_date = get_month_range(year, month)
    
    sales = await db.sales.find({
        "partner_id": partner_id,
        "date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Get 12 months data for chart
    last_12_months = await get_last_12_months_data()
    
    stats = {
        "total_sales": len(sales),
        "telecomunicacoes": {"count": 0, "monthly_total": 0},
        "energia": {"count": 0},
        "solar": {"count": 0},
        "dual": {"count": 0},
        "by_status": {},
        "total_commission": 0,
        "commission_pending": 0,
        "commission_paid": 0,
        "commission_by_status": {},
        "commission_by_type": {},
        "monthly_evolution": []
    }
    
    for sale in sales:
        scope = sale.get('scope', '')
        commission = sale.get('commission', 0) or 0
        status = sale.get('status', 'Para registo')
        
        if scope == 'telecomunicacoes':
            stats['telecomunicacoes']['count'] += 1
            stats['telecomunicacoes']['monthly_total'] += sale.get('monthly_value', 0) or 0
        elif scope == 'energia':
            stats['energia']['count'] += 1
        elif scope == 'solar':
            stats['solar']['count'] += 1
        elif scope == 'dual':
            stats['dual']['count'] += 1
        
        stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
        
        # Commission tracking
        stats['total_commission'] += commission
        
        if sale.get('paid_by_operator'):
            stats['commission_paid'] += commission
        else:
            stats['commission_pending'] += commission
        
        if status not in stats['commission_by_status']:
            stats['commission_by_status'][status] = 0
        stats['commission_by_status'][status] += commission
        
        if scope not in stats['commission_by_type']:
            stats['commission_by_type'][scope] = 0
        stats['commission_by_type'][scope] += commission
    
    # Add selected month info and 12 months data
    stats['selected_month'] = month
    stats['selected_year'] = year
    stats['last_12_months'] = last_12_months
    
    return stats

async def get_commercial_dashboard(user_id: str, year: int, month: int):
    """Commercial sees only their own registered sales without commissions"""
    start_date, end_date = get_month_range(year, month)
    
    sales = await db.sales.find({
        "created_by_user_id": user_id,
        "date": {
            "$gte": start_date.isoformat(),
            "$lt": end_date.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    last_12_months = await get_last_12_months_data()
    
    stats = {
        "total_sales": len(sales),
        "telecomunicacoes": {"count": 0, "monthly_total": 0},
        "energia": {"count": 0},
        "solar": {"count": 0},
        "dual": {"count": 0},
        "by_status": {}
    }
    
    for sale in sales:
        scope = sale.get('scope', '')
        
        if scope == 'telecomunicacoes':
            stats['telecomunicacoes']['count'] += 1
            stats['telecomunicacoes']['monthly_total'] += sale.get('monthly_value', 0) or 0
        elif scope == 'energia':
            stats['energia']['count'] += 1
        elif scope == 'solar':
            stats['solar']['count'] += 1
        elif scope == 'dual':
            stats['dual']['count'] += 1
        
        status = sale.get('status', 'Para registo')
        stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
    
    stats['selected_month'] = month
    stats['selected_year'] = year
    stats['last_12_months'] = last_12_months
    
    return stats

# USERS ENDPOINT
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403)
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**u) for u in users]

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update users")
    
    # Check if user exists
    existing_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prepare update data
    update_data = {
        "name": user_data.name,
        "email": user_data.email,
        "role": user_data.role,
        "position": user_data.position,
        "partner_id": user_data.partner_id
    }
    
    # Only update password if provided
    if user_data.password:
        if not validate_password(user_data.password):
            raise HTTPException(status_code=400, detail="Password must be 8+ chars with 1 uppercase, 1 digit, 1 special char")
        update_data['password_hash'] = hash_password(user_data.password)
        update_data['must_change_password'] = True
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return User(**updated_user)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_db():
    # Create initial admin
    existing = await db.users.find_one({"email": "hugoalbmartins@gmail.com"}, {"_id": 0})
    if not existing:
        from utils import hash_password
        admin_user = User(
            name="Hugo Martins",
            email="hugoalbmartins@gmail.com",
            role="admin",
            position="Gestor de parceiros",
            must_change_password=False
        )
        doc = admin_user.model_dump()
        doc['password_hash'] = hash_password("12345Hm*")
        await db.users.insert_one(doc)
        logger.info("Initial admin created")
    else:
        # Update existing admin password
        from utils import hash_password
        await db.users.update_one(
            {"email": "hugoalbmartins@gmail.com"},
            {"$set": {"password_hash": hash_password("12345Hm*"), "must_change_password": False}}
        )
        logger.info("Admin password updated")
    
    logger.info("Database initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
