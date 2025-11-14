from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from io import BytesIO
import pandas as pd
from fastapi.responses import StreamingResponse, FileResponse
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    role: str  # admin, bo, partner
    position: str
    partner_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    position: str
    partner_id: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: User

class Partner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    address: str
    nif: str
    iban: str
    bank_details: str
    user_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartnerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    nif: str
    iban: str
    bank_details: str

class Operator(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # telecom, energy
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OperatorCreate(BaseModel):
    name: str
    type: str

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    value: float
    operator_id: str
    partner_id: str
    commission: Optional[float] = None
    status: str = "Pendente"  # Pendente, Aprovada, Rejeitada
    final_client: str
    sale_type: str  # eletricidade, telecomunicacoes, solar
    cpe: Optional[str] = None
    requisition: Optional[str] = None
    documents: List[dict] = Field(default_factory=list)  # Lista de documentos anexados
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SaleCreate(BaseModel):
    date: str
    value: float
    operator_id: str
    partner_id: str
    final_client: str
    sale_type: str
    cpe: Optional[str] = None

class SaleUpdate(BaseModel):
    commission: Optional[float] = None
    status: Optional[str] = None
    requisition: Optional[str] = None

class DashboardStats(BaseModel):
    total_sales: int
    total_value: float
    total_commission: float
    sales_by_operator: List[dict]
    sales_by_status: List[dict]
    sales_timeline: List[dict]

# Helper functions
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

# Auth endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_data.model_dump(exclude={'password'})
    user_obj = User(**user_dict)
    
    doc = user_obj.model_dump()
    doc['password_hash'] = hash_password(user_data.password)
    
    await db.users.insert_one(doc)
    return user_obj

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'], user['role'])
    user_obj = User(**user)
    
    return LoginResponse(token=token, user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return User(**current_user)

# Partners endpoints
@api_router.post("/partners", response_model=Partner)
async def create_partner(partner_data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    partner_dict = partner_data.model_dump()
    partner_obj = Partner(**partner_dict)
    
    doc = partner_obj.model_dump()
    await db.partners.insert_one(doc)
    return partner_obj

@api_router.get("/partners", response_model=List[Partner])
async def get_partners(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'partner':
        partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
        return [Partner(**partner)] if partner else []
    
    partners = await db.partners.find({}, {"_id": 0}).to_list(1000)
    return [Partner(**p) for p in partners]

@api_router.get("/partners/{partner_id}", response_model=Partner)
async def get_partner(partner_id: str, current_user: dict = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return Partner(**partner)

@api_router.put("/partners/{partner_id}", response_model=Partner)
async def update_partner(partner_id: str, partner_data: PartnerCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] not in ['admin', 'bo']:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    update_dict = partner_data.model_dump()
    await db.partners.update_one({"id": partner_id}, {"$set": update_dict})
    
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    return Partner(**partner)

# Operators endpoints
@api_router.post("/operators", response_model=Operator)
async def create_operator(operator_data: OperatorCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can create operators")
    
    operator_dict = operator_data.model_dump()
    operator_obj = Operator(**operator_dict)
    
    doc = operator_obj.model_dump()
    await db.operators.insert_one(doc)
    return operator_obj

@api_router.get("/operators", response_model=List[Operator])
async def get_operators(current_user: dict = Depends(get_current_user)):
    operators = await db.operators.find({"active": True}, {"_id": 0}).to_list(1000)
    return [Operator(**o) for o in operators]

@api_router.put("/operators/{operator_id}", response_model=Operator)
async def update_operator(operator_id: str, operator_data: OperatorCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update operators")
    
    update_dict = operator_data.model_dump()
    await db.operators.update_one({"id": operator_id}, {"$set": update_dict})
    
    operator = await db.operators.find_one({"id": operator_id}, {"_id": 0})
    return Operator(**operator)

@api_router.delete("/operators/{operator_id}")
async def delete_operator(operator_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can delete operators")
    
    await db.operators.update_one({"id": operator_id}, {"$set": {"active": False}})
    return {"message": "Operator deleted"}

# Sales endpoints
@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    sale_dict = sale_data.model_dump()
    sale_obj = Sale(**sale_dict)
    
    doc = sale_obj.model_dump()
    await db.sales.insert_one(doc)
    return sale_obj

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user['role'] == 'partner':
        partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
        if partner:
            query = {"partner_id": partner['id']}
        else:
            return []
    
    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    return [Sale(**s) for s in sales]

@api_router.get("/sales/{sale_id}", response_model=Sale)
async def get_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return Sale(**sale)

@api_router.put("/sales/{sale_id}", response_model=Sale)
async def update_sale(sale_id: str, sale_data: SaleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'partner':
        raise HTTPException(status_code=403, detail="Partners cannot update sales")
    
    update_dict = {k: v for k, v in sale_data.model_dump().items() if v is not None}
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Only admin can update commission
    if 'commission' in update_dict and current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can update commission")
    
    await db.sales.update_one({"id": sale_id}, {"$set": update_dict})
    
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    return Sale(**sale)

# Dashboard endpoint
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    query = {}
    
    if current_user['role'] == 'partner':
        partner = await db.partners.find_one({"user_id": current_user['id']}, {"_id": 0})
        if partner:
            query = {"partner_id": partner['id']}
        else:
            return DashboardStats(
                total_sales=0,
                total_value=0,
                total_commission=0,
                sales_by_operator=[],
                sales_by_status=[],
                sales_timeline=[]
            )
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    
    total_sales = len(sales)
    total_value = sum(s.get('value', 0) for s in sales)
    
    # Hide commission for BO users
    if current_user['role'] == 'bo':
        total_commission = 0
    else:
        total_commission = sum(s.get('commission', 0) or 0 for s in sales)
    
    # Sales by operator
    operators_dict = {}
    for sale in sales:
        op_id = sale.get('operator_id')
        if op_id:
            if op_id not in operators_dict:
                operator = await db.operators.find_one({"id": op_id}, {"_id": 0})
                if operator:
                    operators_dict[op_id] = {'name': operator['name'], 'count': 0, 'value': 0}
            if op_id in operators_dict:
                operators_dict[op_id]['count'] += 1
                operators_dict[op_id]['value'] += sale.get('value', 0)
    
    sales_by_operator = [{'name': v['name'], 'count': v['count'], 'value': v['value']} for v in operators_dict.values()]
    
    # Sales by status
    status_dict = {}
    for sale in sales:
        status = sale.get('status', 'Pendente')
        if status not in status_dict:
            status_dict[status] = {'name': status, 'count': 0}
        status_dict[status]['count'] += 1
    
    sales_by_status = list(status_dict.values())
    
    # Sales timeline (last 12 months)
    timeline_dict = {}
    for sale in sales:
        try:
            date_str = sale.get('date', '')
            if date_str:
                month = date_str[:7]  # YYYY-MM
                if month not in timeline_dict:
                    timeline_dict[month] = {'month': month, 'count': 0, 'value': 0}
                timeline_dict[month]['count'] += 1
                timeline_dict[month]['value'] += sale.get('value', 0)
        except:
            pass
    
    sales_timeline = sorted(timeline_dict.values(), key=lambda x: x['month'])
    
    return DashboardStats(
        total_sales=total_sales,
        total_value=total_value,
        total_commission=total_commission,
        sales_by_operator=sales_by_operator,
        sales_by_status=sales_by_status,
        sales_timeline=sales_timeline
    )

# Export endpoint
@api_router.get("/sales/export/excel")
async def export_sales(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    operator_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] == 'partner':
        raise HTTPException(status_code=403, detail="Partners cannot export sales")
    
    query = {}
    if start_date:
        query['date'] = {'$gte': start_date}
    if end_date:
        if 'date' in query:
            query['date']['$lte'] = end_date
        else:
            query['date'] = {'$lte': end_date}
    if operator_id:
        query['operator_id'] = operator_id
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    
    # Enrich with partner and operator data
    export_data = []
    for sale in sales:
        partner = await db.partners.find_one({"id": sale['partner_id']}, {"_id": 0})
        operator = await db.operators.find_one({"id": sale['operator_id']}, {"_id": 0})
        
        row = {
            'Data': sale.get('date', ''),
            'Parceiro': partner.get('name', '') if partner else '',
            'NIF': partner.get('nif', '') if partner else '',
            'Operadora': operator.get('name', '') if operator else '',
            'Tipo': sale.get('sale_type', ''),
            'Cliente Final': sale.get('final_client', ''),
            'Valor': sale.get('value', 0),
            'Status': sale.get('status', ''),
        }
        
        # Add CPE or Requisition
        if sale.get('cpe'):
            row['CPE'] = sale['cpe']
        if sale.get('requisition'):
            row['Requisição'] = sale['requisition']
        
        # Hide commission for BO
        if current_user['role'] != 'bo':
            row['Comissão'] = sale.get('commission', 0) or 0
        
        export_data.append(row)
    
    df = pd.DataFrame(export_data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Vendas')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=vendas.xlsx'}
    )

# Users management (admin only)
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can view users")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [User(**u) for u in users]

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
    # Create initial admin user
    existing = await db.users.find_one({"email": "hugoalbmartins@gmail.com"}, {"_id": 0})
    if not existing:
        admin_user = User(
            name="Hugo Martins",
            email="hugoalbmartins@gmail.com",
            role="admin",
            position="Gestor de parceiros"
        )
        doc = admin_user.model_dump()
        doc['password_hash'] = hash_password("12345Hm")
        await db.users.insert_one(doc)
        logger.info("Initial admin user created")
    
    # Create default operators
    operators_to_create = [
        {"name": "Vodafone", "type": "telecom"},
        {"name": "MEO", "type": "telecom"},
        {"name": "NOS", "type": "telecom"},
        {"name": "EDP", "type": "energy"},
        {"name": "Galp", "type": "energy"},
        {"name": "Endesa", "type": "energy"},
    ]
    
    for op_data in operators_to_create:
        existing_op = await db.operators.find_one({"name": op_data["name"]}, {"_id": 0})
        if not existing_op:
            operator = Operator(**op_data)
            await db.operators.insert_one(operator.model_dump())
    
    logger.info("Database initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()