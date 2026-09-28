import os
import aiofiles
import logging
import httpx
from abc import ABC, abstractmethod
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("ricoz.storage")

class BaseStorageBackend(ABC):
    name: str = "base"

    @abstractmethod
    async def save(self, key: str, data: bytes) -> str:
        """Saves binary data and returns storage path or identifier."""
        pass

    @abstractmethod
    async def load(self, key: str) -> bytes:
        """Loads binary data for a given key or raises FileNotFoundError."""
        pass

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Deletes object. Returns True if deleted or False if not found."""
        pass

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Checks if object exists in storage."""
        pass


class LocalStorageBackend(BaseStorageBackend):
    name: str = "local"

    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = os.path.abspath(base_dir or settings.STORAGE_LOCAL_DIR)
        os.makedirs(self.base_dir, exist_ok=True)
        logger.info(f"LocalStorageBackend initialized at {self.base_dir}")

    def _resolve_path(self, key: str) -> str:
        # Prevent directory traversal attacks
        clean_key = os.path.normpath(key.lstrip("/\\"))
        if clean_key.startswith(".."):
            raise ValueError("Invalid storage path key: directory traversal detected")
        return os.path.join(self.base_dir, clean_key)

    async def save(self, key: str, data: bytes) -> str:
        file_path = self._resolve_path(key)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(data)
        logger.debug(f"Saved {len(data)} bytes to {file_path}")
        return key

    async def load(self, key: str) -> bytes:
        file_path = self._resolve_path(key)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Storage object not found: {key}")
        async with aiofiles.open(file_path, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> bool:
        file_path = self._resolve_path(key)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

    async def exists(self, key: str) -> bool:
        file_path = self._resolve_path(key)
        return os.path.exists(file_path)


class S3StorageBackend(BaseStorageBackend):
    """
    S3-compatible blob storage backend. Supports AWS S3, MinIO, Cloudflare R2, and GCS.
    Gracefully falls back to local storage if credentials or endpoint are unconfigured.
    """
    name: str = "s3"

    def __init__(self):
        self.bucket = settings.S3_BUCKET
        self.endpoint_url = settings.S3_ENDPOINT_URL
        self.access_key = settings.S3_ACCESS_KEY
        self.secret_key = settings.S3_SECRET_KEY
        self.region = settings.S3_REGION
        self.fallback = LocalStorageBackend()

        self.is_configured = bool(self.bucket and (self.access_key or self.endpoint_url))
        if not self.is_configured:
            logger.warning("S3 credentials not fully configured; S3StorageBackend will use local storage fallback.")

    async def save(self, key: str, data: bytes) -> str:
        if not self.is_configured:
            return await self.fallback.save(key, data)

        try:
            # If boto3 is available, use boto3 client
            try:
                import boto3
                from botocore.config import Config
                s3_kwargs = {
                    "region_name": self.region,
                    "aws_access_key_id": self.access_key,
                    "aws_secret_access_key": self.secret_key,
                }
                if self.endpoint_url:
                    s3_kwargs["endpoint_url"] = self.endpoint_url
                s3 = boto3.client("s3", **s3_kwargs)
                s3.put_object(Bucket=self.bucket, Key=key, Body=data)
                return f"s3://{self.bucket}/{key}"
            except ImportError:
                # Direct REST PUT to S3 / MinIO endpoint
                if self.endpoint_url:
                    target_url = f"{self.endpoint_url.rstrip('/')}/{self.bucket}/{key.lstrip('/')}"
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        res = await client.put(target_url, content=data)
                        if res.is_success:
                            return f"s3://{self.bucket}/{key}"
                logger.warning("boto3 not installed for S3 upload; saving to local storage fallback.")
                return await self.fallback.save(key, data)
        except Exception as e:
            logger.error(f"Error saving to S3: {str(e)}; falling back to local storage.")
            return await self.fallback.save(key, data)

    async def load(self, key: str) -> bytes:
        if not self.is_configured:
            return await self.fallback.load(key)

        try:
            try:
                import boto3
                s3_kwargs = {
                    "region_name": self.region,
                    "aws_access_key_id": self.access_key,
                    "aws_secret_access_key": self.secret_key,
                }
                if self.endpoint_url:
                    s3_kwargs["endpoint_url"] = self.endpoint_url
                s3 = boto3.client("s3", **s3_kwargs)
                clean_key = key.replace(f"s3://{self.bucket}/", "")
                resp = s3.get_object(Bucket=self.bucket, Key=clean_key)
                return resp["Body"].read()
            except ImportError:
                if self.endpoint_url:
                    clean_key = key.replace(f"s3://{self.bucket}/", "")
                    target_url = f"{self.endpoint_url.rstrip('/')}/{self.bucket}/{clean_key.lstrip('/')}"
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        res = await client.get(target_url)
                        if res.is_success:
                            return res.content
                return await self.fallback.load(key)
        except Exception as e:
            logger.error(f"Error loading from S3: {str(e)}; trying local fallback.")
            return await self.fallback.load(key)

    async def delete(self, key: str) -> bool:
        if not self.is_configured:
            return await self.fallback.delete(key)
        try:
            import boto3
            s3 = boto3.client("s3", region_name=self.region, aws_access_key_id=self.access_key, aws_secret_access_key=self.secret_key)
            clean_key = key.replace(f"s3://{self.bucket}/", "")
            s3.delete_object(Bucket=self.bucket, Key=clean_key)
            return True
        except Exception:
            return await self.fallback.delete(key)

    async def exists(self, key: str) -> bool:
        if not self.is_configured:
            return await self.fallback.exists(key)
        try:
            clean_key = key.replace(f"s3://{self.bucket}/", "")
            import boto3
            s3 = boto3.client("s3", region_name=self.region, aws_access_key_id=self.access_key, aws_secret_access_key=self.secret_key)
            s3.head_object(Bucket=self.bucket, Key=clean_key)
            return True
        except Exception:
            return await self.fallback.exists(key)


_storage_instance: Optional[BaseStorageBackend] = None

def get_storage_backend() -> BaseStorageBackend:
    global _storage_instance
    if _storage_instance is None:
        backend_type = settings.STORAGE_BACKEND.lower()
        if backend_type == "s3":
            _storage_instance = S3StorageBackend()
        else:
            _storage_instance = LocalStorageBackend()
    return _storage_instance
