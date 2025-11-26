from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re
import secrets
import string

# Password generator
def generate_strong_password(length: int = 8) -> str:
    """Generate a strong password with at least 1 uppercase, 1 digit, 1 special char"""
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = '!@#$%^&*'
    
    # Ensure at least one of each required type
    password = [
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(special),
    ]
    
    # Fill the rest randomly
    all_chars = uppercase + lowercase + digits + special
    password += [secrets.choice(all_chars) for _ in range(length - 3)]
    
    # Shuffle to avoid predictable patterns
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    role: str  # admin, bo, partner, partner_commercial
    position: str
    partner_id: Optional[str] = None
    must_change_password: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Partner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    partner_code: str  # D2D1001, Rev1002, Rev+1003
    partner_type: str  # D2D, Rev, Rev+
    name: str
    email: EmailStr  # Email principal e financeiro
    communication_emails: List[str] = Field(default_factory=list)
    phone: str
    contact_person: str
    street: str
    door_number: str
    postal_code: str
    locality: str
    nif: str
    crc: Optional[str] = None  # Apenas se NIF começar por 5
    documents: List[dict] = Field(default_factory=list)
    user_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CommissionTier(BaseModel):
    min_sales: int
    commission_value: Optional[float] = None  # Para energia
    multiplier: Optional[float] = None  # Para telecomunicações

class Operator(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    scope: str  # telecomunicacoes, energia, solar, dual
    active: bool = True
    hidden: bool = False  # Ocultar para novas vendas
    
    # Comissões por tipo de cliente
    commission_tiers: dict = Field(default_factory=dict)  # {"particular": [...], "empresarial": [...]}
    
    # Tipo de serviço (telecomunicações)
    service_types: List[str] = Field(default_factory=list)  # ["M3", "M4"]
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_code: str  # ALB000311
    date: str
    partner_id: str
    created_by_user_id: str  # Para rastrear vendas de comerciais
    
    # Âmbito
    scope: str  # telecomunicacoes, energia, dual, solar
    
    # Dados do cliente
    client_name: str
    client_nif: str
    client_contact: str
    client_email: Optional[str] = None
    client_iban: Optional[str] = None
    
    # Operadora
    operator_id: str
    
    # Telecomunicações
    service_type: Optional[str] = None  # M3 ou M4
    monthly_value: Optional[float] = None
    requisition: Optional[str] = None
    
    # Energia/Solar
    cpe: Optional[str] = None  # PT0002 + 12 dígitos + 2 letras
    power: Optional[str] = None
    entry_type: Optional[str] = None  # "Alteração de comercializadora", etc
    
    # Dual
    cui: Optional[str] = None  # PT16 + 15 dígitos + 2 letras
    tier: Optional[str] = None  # 1, 2, 3, 4
    
    # Estado
    status: str = "Para registo"  # Para registo, Pendente, Concluido, Ativo, Cancelado
    status_date: Optional[str] = None
    
    # Pagamento
    paid_by_operator: bool = False
    payment_date: Optional[str] = None
    
    # Comissão calculada
    commission: Optional[float] = None
    
    # Observações e notas
    observations: Optional[str] = None
    notes: List[dict] = Field(default_factory=list)
    
    # Documentos
    documents: List[dict] = Field(default_factory=list)
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    @field_validator('cpe')
    def validate_cpe(cls, v):
        if v:
            v = v.upper()
            if not re.match(r'^PT0002\d{12}[A-Z]{2}$', v):
                raise ValueError('CPE deve iniciar com PT0002, seguido de 12 dígitos e terminar com 2 letras')
        return v
    
    @field_validator('cui')
    def validate_cui(cls, v):
        if v:
            v = v.upper()
            if not re.match(r'^PT16\d{15}[A-Z]{2}$', v):
                raise ValueError('CUI deve iniciar com PT16, seguido de 15 dígitos e terminar com 2 letras')
        return v

# Create models
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = None  # Se não fornecido, gera automaticamente
    role: str
    position: str
    partner_id: Optional[str] = None

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

class OperatorCreate(BaseModel):
    name: str
    scope: str
    commission_tiers: dict = Field(default_factory=dict)
    service_types: List[str] = Field(default_factory=list)

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

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class NoteCreate(BaseModel):
    content: str
