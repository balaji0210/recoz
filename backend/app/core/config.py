from typing import List, Union, Optional
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "RicozAppMon"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ricoz-appmon-super-secure-secret-key-2026-production-grade")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database (PostgreSQL or SQLite fallback for development)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./ricozappmon.db")
    SYNC_DATABASE_URL: str = os.getenv("SYNC_DATABASE_URL", "sqlite:///./ricozappmon.db")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:8000",
        "*"
    ]
    
    # Ingestion Configuration
    RUM_BATCH_MAX_SIZE: int = 100
    RUM_MAX_PAYLOAD_BYTES: int = 1024 * 1024  # 1MB
    RATE_LIMIT_PER_MINUTE: int = 1200
    
    # Data Retention (Days)
    RAW_DATA_RETENTION_DAYS: int = 30
    ROLLUP_RETENTION_DAYS: int = 90
    
    # Storage Backend Configuration (for Source Maps and Artifacts)
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")  # "local" or "s3"
    STORAGE_LOCAL_DIR: str = os.getenv("STORAGE_LOCAL_DIR", "./storage/sourcemaps")
    S3_BUCKET: str = os.getenv("S3_BUCKET", "ricoz-sourcemaps")
    S3_ENDPOINT_URL: Optional[str] = os.getenv("S3_ENDPOINT_URL", None)
    S3_ACCESS_KEY: Optional[str] = os.getenv("S3_ACCESS_KEY", None)
    S3_SECRET_KEY: Optional[str] = os.getenv("S3_SECRET_KEY", None)
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()
