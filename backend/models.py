from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import re

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # new_sale, status_change, note_added
    sale_id: str
    sale_code: str
    message: str
    user_ids: List[str]  # Users who should see this alert
    read_by: List[str] = []  # Users who have read this alert
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str
    created_by_name: str



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
    partner_type: str  # D2D, Rev, Rev+
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
    initial_password: Optional[str] = None
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
    scope: str  # telecomunicacoes, energia, solar
    energy_type: Optional[str] = None  # eletricidade, gas, dual (only for energia scope)
    active: bool = True
    hidden: bool = False
    commission_config: dict = Field(default_factory=dict)
    documents: List[dict] = Field(default_factory=list)
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OperatorCreate(BaseModel):
    name: str
    scope: str
    energy_type: Optional[str] = None
    commission_config: dict = Field(default_factory=dict)

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_code: str
    date: str
    partner_id: str
    created_by_user_id: str
    scope: str  # telecomunicacoes, energia, solar
    energy_type: Optional[str] = None  # eletricidade, gas, dual (only for energia scope)
    client_type: str  # particular, empresarial
    client_name: str
    client_nif: str
    client_contact: str
    client_email: Optional[str] = None
    client_iban: Optional[str] = None
    installation_address: Optional[str] = None
    operator_id: str
    service_type: Optional[str] = None  # M3, M4
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
    client_type: str  # particular, empresarial
    client_name: str
    client_nif: str
    client_contact: str
    client_email: Optional[str] = None
    client_iban: Optional[str] = None
    installation_address: Optional[str] = None
    operator_id: str
    service_type: Optional[str] = None
    monthly_value: Optional[float] = None
    requisition: Optional[str] = None
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
