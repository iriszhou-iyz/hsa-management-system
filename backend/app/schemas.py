from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.models import MerchantCategory, TransactionStatus, TransactionType


class AccountCreate(BaseModel):
    owner_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_name: str
    email: str
    balance_cents: int
    created_at: datetime


class DepositCreate(BaseModel):
    amount_cents: int = Field(..., gt=0, description="Amount to add, in cents")


class CardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    last_four: str
    is_active: bool
    issued_at: datetime


class PurchaseCreate(BaseModel):
    amount_cents: int = Field(..., gt=0, description="Charge amount, in cents")
    merchant_category: MerchantCategory


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    transaction_type: TransactionType
    amount_cents: int
    merchant_category: MerchantCategory | None
    status: TransactionStatus
    decline_reason: str | None
    created_at: datetime
