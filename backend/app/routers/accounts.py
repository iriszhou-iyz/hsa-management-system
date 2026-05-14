# http routes for hsa accounts and related actions
# GET    /api/accounts/
# POST   /api/accounts/
# GET    /api/accounts/{id}
# POST   /api/accounts/{id}/deposits
# POST   /api/accounts/{id}/cards
# POST   /api/accounts/{id}/purchases
# GET    /api/accounts/{id}/transactions
#
# uses SQLAlchemy models (app.models) for persistence and python schemas (app.schemas) for request validation and response shape
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Account,
    Card,
    QUALIFIED_CATEGORIES,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.schemas import (
    AccountCreate,
    AccountOut,
    CardOut,
    DepositCreate,
    PurchaseCreate,
    TransactionOut,
)

router = APIRouter(prefix="/accounts", tags=["accounts"])
DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/", response_model=list[AccountOut])
async def list_accounts(db: DbSession) -> list[Account]:
    """Return all accounts (handy for a simple admin / demo UI)."""
    result = await db.execute(select(Account).order_by(Account.created_at.desc()))
    return list(result.scalars().all())


@router.post("/", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(body: AccountCreate, db: DbSession) -> Account:
    # Emails are unique in the DB; reject duplicates instead of surfacing an integrity error.
    existing = await db.execute(select(Account).where(Account.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    account = Account(owner_name=body.owner_name, email=str(body.email))
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(account_id: int, db: DbSession) -> Account:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.post("/{account_id}/deposits", response_model=TransactionOut)
async def deposit(account_id: int, body: DepositCreate, db: DbSession) -> Transaction:
    async with db.begin():
        result = await db.execute(
            select(Account).where(Account.id == account_id).with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        account.balance_cents += body.amount_cents
        tx = Transaction(
            account_id=account.id,
            transaction_type=TransactionType.DEPOSIT,
            amount_cents=body.amount_cents,
            merchant_category=None,
            status=TransactionStatus.APPROVED,
            decline_reason=None,
        )
        db.add(tx)

    await db.refresh(tx)
    return tx


@router.post("/{account_id}/cards", response_model=CardOut, status_code=status.HTTP_201_CREATED)
async def issue_card(account_id: int, db: DbSession) -> Card:
    result = await db.execute(select(Account).where(Account.id == account_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Virtual card: store only last four digits (no full PAN in this demo).
    last_four = f"{secrets.randbelow(10000):04d}"
    card = Card(account_id=account_id, last_four=last_four, is_active=True)
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return card


@router.post("/{account_id}/purchases", response_model=TransactionOut)
async def simulate_purchase(account_id: int, body: PurchaseCreate, db: DbSession) -> Transaction:
    # Eligibility is decided before the DB transaction; balance is checked inside with the row locked.
    qualified = body.merchant_category in QUALIFIED_CATEGORIES

    async with db.begin():
        result = await db.execute(
            select(Account).where(Account.id == account_id).with_for_update()
        )
        account = result.scalar_one_or_none()
        if account is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

        if not qualified:
            # Declined purchases still create a row for an audit trail; balance unchanged.
            tx = Transaction(
                account_id=account.id,
                transaction_type=TransactionType.PURCHASE,
                amount_cents=body.amount_cents,
                merchant_category=body.merchant_category,
                status=TransactionStatus.DECLINED,
                decline_reason="Not a qualified medical expense",
            )
            db.add(tx)
        elif account.balance_cents < body.amount_cents:
            tx = Transaction(
                account_id=account.id,
                transaction_type=TransactionType.PURCHASE,
                amount_cents=body.amount_cents,
                merchant_category=body.merchant_category,
                status=TransactionStatus.DECLINED,
                decline_reason="Insufficient funds",
            )
            db.add(tx)
        else:
            account.balance_cents -= body.amount_cents
            tx = Transaction(
                account_id=account.id,
                transaction_type=TransactionType.PURCHASE,
                amount_cents=body.amount_cents,
                merchant_category=body.merchant_category,
                status=TransactionStatus.APPROVED,
                decline_reason=None,
            )
            db.add(tx)

    await db.refresh(tx)
    return tx


@router.get("/{account_id}/transactions", response_model=list[TransactionOut])
async def list_transactions(account_id: int, db: DbSession) -> list[Transaction]:
    acc = await db.execute(select(Account).where(Account.id == account_id))
    if acc.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    result = await db.execute(
        select(Transaction)
        .where(Transaction.account_id == account_id)
        .order_by(Transaction.created_at.desc())
    )
    return list(result.scalars().all())
