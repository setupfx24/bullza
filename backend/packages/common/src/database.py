import os

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

# Pool sizes are per PROCESS, and every process multiplies them: gateway
# (--workers 2) + admin (--workers 2) + b-book + risk = 6 processes. At the
# previous hardcoded 20+10 that is 180 connections against Postgres's default
# max_connections of 100 — the pool could not actually open what it advertised,
# and the overflow surfaced as `FATAL: sorry, too many clients already` across
# every service at once.
#
# Now env-driven so each service can be sized for its real concurrency (the
# engines need a fraction of what the gateway does) without a code change.
# Defaults are unchanged, so behaviour is identical until someone tunes them.
# See docker-compose.yml, which raises the server-side max_connections to match.
_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
_TS_POOL_SIZE = int(os.getenv("TIMESCALE_POOL_SIZE", "10"))
_TS_MAX_OVERFLOW = int(os.getenv("TIMESCALE_MAX_OVERFLOW", "5"))

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=_POOL_SIZE,
    max_overflow=_MAX_OVERFLOW,
    pool_pre_ping=True,
)

timescale_engine = create_async_engine(
    settings.TIMESCALE_URL,
    echo=False,
    pool_size=_TS_POOL_SIZE,
    max_overflow=_TS_MAX_OVERFLOW,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

TimescaleSessionLocal = async_sessionmaker(
    timescale_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_timescale_db() -> AsyncSession:
    async with TimescaleSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
