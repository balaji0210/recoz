import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
import jwt
from app.core.config import settings

def hash_password(password: str) -> str:
    """Hash a password securely using SHA-256 with salt or bcrypt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored salt and hash."""
    try:
        salt, key_hex = hashed_password.split('$')
        key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None

def generate_ingest_key() -> tuple[str, str]:
    """
    Generate a plaintext ingest key (prefix + random) and its SHA-256 hash for storage.
    Returns: (raw_key, hashed_key)
    """
    raw_key = f"rz_live_{secrets.token_urlsafe(32)}"
    hashed_key = hash_ingest_key(raw_key)
    return raw_key, hashed_key

def hash_ingest_key(raw_key: str) -> str:
    """Hash an ingest key with SHA-256 for fast constant-time lookup."""
    return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()
