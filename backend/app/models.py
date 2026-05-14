import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

def _enum_str(enum_cls: type[enum.Enum]) -> SQLEnum:
    return SQLEnum(enum_cls, values_callable=lambda obj: [e.value for e in obj], native_enum=False, length=32)


class TransactionStatus(str, enum.Enum):
    APPROVED = "approved"
    DECLINED = "declined"


class MerchantCategory(str, enum.Enum):
    PHARMACY = "pharmacy"
    HOSPITAL = "hospital"
    CLINIC = "clinic"
    DENTIST = "dentist"
    VISION = "vision"
    THERAPY = "therapy"
    MEDICAL_EQUIPMENT = "medical_equipment"

    RESTAURANT = "restaurant"
    ELECTRONICS = "electronics"
    GROCERY = "grocery"
    ENTERTAINMENT = "entertainment"
    OTHER = "other"


QUALIFIED_CATEGORIES = {
    MerchantCategory.PHARMACY,
    MerchantCategory.HOSPITAL,
    MerchantCategory.CLINIC,
    MerchantCategory.DENTIST,
    MerchantCategory.VISION,
    MerchantCategory.THERAPY,
    MerchantCategory.MEDICAL_EQUIPMENT,
}


class TransactionType(str, enum.Enum):
    DEPOSIT = "DEPOSIT"
    PURCHASE = "PURCHASE"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    balance_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    cards: Mapped[list["Card"]] = relationship(back_populates="account")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    account: Mapped["Account"] = relationship(back_populates="cards")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    transaction_type: Mapped[TransactionType] = mapped_column(_enum_str(TransactionType), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    # Deposits omit merchant; purchases require a category
    merchant_category: Mapped[MerchantCategory | None] = mapped_column(
        _enum_str(MerchantCategory), nullable=True
    )
    status: Mapped[TransactionStatus] = mapped_column(_enum_str(TransactionStatus), nullable=False)
    decline_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    account: Mapped["Account"] = relationship(back_populates="transactions")
