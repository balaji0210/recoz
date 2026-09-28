import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, List

from app.core.database import get_db
from app.core.rbac import get_current_active_user
from app.models import SourceMap, Application
from app.services.storage import get_storage_backend

router = APIRouter(prefix="/sourcemaps", tags=["Source Maps"])

@router.post("/upload")
async def upload_sourcemap(
    app_id: str = Form(...),
    release_version: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a JavaScript / TypeScript .map file associated with an app release version.
    Saves to the configured storage pipeline (local filesystem or S3/blob backing).
    """
    res = await db.execute(select(Application).where(Application.id == app_id))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    file_size = len(content_bytes)
    storage = get_storage_backend()

    # Sanitize filename
    safe_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', file.filename or "unknown.js.map")
    storage_key = f"{app_id}/{release_version}/{safe_filename}"

    # Save to storage backend (Local disk or S3/Blob)
    saved_path = await storage.save(storage_key, content_bytes)

    # Check if a map already exists for this app, release, and filename
    existing_res = await db.execute(
        select(SourceMap).where(
            SourceMap.application_id == app_id,
            SourceMap.release_version == release_version,
            SourceMap.filename == file.filename
        )
    )
    existing_sm = existing_res.scalar_one_or_none()

    if existing_sm:
        # Delete old storage object if path changed
        if existing_sm.storage_path and existing_sm.storage_path != saved_path:
            await storage.delete(existing_sm.storage_path)
        existing_sm.storage_backend = storage.name
        existing_sm.storage_path = saved_path
        existing_sm.file_size_bytes = file_size
        # Store in-memory string only if small (< 256KB) to prevent DB bloat
        existing_sm.map_content = content_bytes.decode('utf-8', errors='replace') if file_size < 256 * 1024 else None
        sm = existing_sm
    else:
        sm = SourceMap(
            application_id=app_id,
            release_version=release_version,
            filename=file.filename or safe_filename,
            storage_backend=storage.name,
            storage_path=saved_path,
            file_size_bytes=file_size,
            map_content=content_bytes.decode('utf-8', errors='replace') if file_size < 256 * 1024 else None
        )
        db.add(sm)

    await db.commit()
    await db.refresh(sm)

    return {
        "status": "success",
        "message": f"Source map for {file.filename} (release: {release_version}) saved to {storage.name} storage successfully.",
        "id": sm.id,
        "storage_backend": storage.name,
        "storage_path": saved_path,
        "file_size_bytes": file_size
    }

@router.get("")
async def list_sourcemaps(
    app_id: str,
    release_version: Optional[str] = None,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists uploaded source maps with storage metadata for an application."""
    query = select(SourceMap).where(SourceMap.application_id == app_id)
    if release_version:
        query = query.where(SourceMap.release_version == release_version)
    query = query.order_by(desc(SourceMap.created_at))

    res = await db.execute(query)
    maps = res.scalars().all()

    return [
        {
            "id": sm.id,
            "application_id": sm.application_id,
            "release_version": sm.release_version,
            "filename": sm.filename,
            "file_size_bytes": sm.file_size_bytes,
            "storage_backend": sm.storage_backend or "local",
            "storage_path": sm.storage_path,
            "created_at": sm.created_at
        }
        for sm in maps
    ]

@router.get("/{sourcemap_id}")
async def get_sourcemap_detail(
    sourcemap_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves metadata of a specific source map."""
    res = await db.execute(select(SourceMap).where(SourceMap.id == sourcemap_id))
    sm = res.scalar_one_or_none()
    if not sm:
        raise HTTPException(status_code=404, detail="Source map not found")

    return {
        "id": sm.id,
        "application_id": sm.application_id,
        "release_version": sm.release_version,
        "filename": sm.filename,
        "file_size_bytes": sm.file_size_bytes,
        "storage_backend": sm.storage_backend or "local",
        "storage_path": sm.storage_path,
        "created_at": sm.created_at
    }

@router.get("/{sourcemap_id}/content")
async def get_sourcemap_content(
    sourcemap_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Streams or downloads the raw source map content."""
    res = await db.execute(select(SourceMap).where(SourceMap.id == sourcemap_id))
    sm = res.scalar_one_or_none()
    if not sm:
        raise HTTPException(status_code=404, detail="Source map not found")

    if sm.map_content:
        return PlainTextResponse(content=sm.map_content, media_type="application/json")

    if sm.storage_path:
        storage = get_storage_backend()
        try:
            raw_bytes = await storage.load(sm.storage_path)
            return PlainTextResponse(content=raw_bytes.decode('utf-8', errors='replace'), media_type="application/json")
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Source map file not found in storage")

    raise HTTPException(status_code=404, detail="Source map content is not available")

@router.delete("/{sourcemap_id}")
async def delete_sourcemap(
    sourcemap_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Deletes a source map from both storage and database."""
    res = await db.execute(select(SourceMap).where(SourceMap.id == sourcemap_id))
    sm = res.scalar_one_or_none()
    if not sm:
        raise HTTPException(status_code=404, detail="Source map not found")

    if sm.storage_path:
        storage = get_storage_backend()
        await storage.delete(sm.storage_path)

    await db.delete(sm)
    await db.commit()
    return {"status": "success", "message": f"Source map {sm.filename} deleted successfully"}
