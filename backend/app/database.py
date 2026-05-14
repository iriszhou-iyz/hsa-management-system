import os
from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Keep SQLite outside `app/` so `uvicorn --reload --reload-dir app` does not watch DB churn.
_backend_dir = Path(__file__).resolve().parent.parent
_instance_dir = _backend_dir / "instance"
_instance_dir.mkdir(parents=True, exist_ok=True)
_default_sqlite = _instance_dir / "hsa.db"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{_default_sqlite.resolve().as_posix()}",
)

class Base(DeclarativeBase):
    pass

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "").lower() in ("1", "true", "yes"),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
