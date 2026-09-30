from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
import logging

logger = logging.getLogger("ricoz.database")

# Handle SQLite vs PostgreSQL async drivers
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

connect_args = {}
if "sqlite" in db_url:
    connect_args = {"check_same_thread": False}

async_engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

async def get_db():
    """Dependency for obtaining an asynchronous DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

from sqlalchemy import inspect, text

def _run_migrations(connection):
    inspector = inspect(connection)
    table_names = inspector.get_table_names()
    if "source_maps" in table_names:
        columns = [c["name"] for c in inspector.get_columns("source_maps")]
        if "storage_backend" not in columns:
            connection.execute(text("ALTER TABLE source_maps ADD COLUMN storage_backend VARCHAR(32) DEFAULT 'local'"))
        if "storage_path" not in columns:
            connection.execute(text("ALTER TABLE source_maps ADD COLUMN storage_path TEXT"))
        if "file_size_bytes" not in columns:
            connection.execute(text("ALTER TABLE source_maps ADD COLUMN file_size_bytes INTEGER DEFAULT 0"))

    if "incidents" in table_names:
        inc_cols = [c["name"] for c in inspector.get_columns("incidents")]
        if "investigated_at" not in inc_cols:
            connection.execute(text("ALTER TABLE incidents ADD COLUMN investigated_at TIMESTAMP"))
        if "investigated_by_user_id" not in inc_cols:
            connection.execute(text("ALTER TABLE incidents ADD COLUMN investigated_by_user_id VARCHAR(36)"))
        if "resolved_by_user_id" not in inc_cols:
            connection.execute(text("ALTER TABLE incidents ADD COLUMN resolved_by_user_id VARCHAR(36)"))
        if "resolution_notes" not in inc_cols:
            connection.execute(text("ALTER TABLE incidents ADD COLUMN resolution_notes TEXT"))

async def init_db():
    """Create tables on startup if they don't already exist and apply safe migrations."""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_migrations)
    logger.info("Database tables and migrations initialized successfully.")
