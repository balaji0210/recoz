from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.rbac import get_current_active_user
from app.models import SourceMap, Application

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
    """
    res = await db.execute(select(Application).where(Application.id == app_id))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    content_bytes = await file.read()
    content_str = content_bytes.decode('utf-8')

    # Remove existing map for this file and release if any
    await db.execute(
        select(SourceMap).where(
            SourceMap.application_id == app_id,
            SourceMap.release_version == release_version,
            SourceMap.filename == file.filename
        )
    )

    sm = SourceMap(
        application_id=app_id,
        release_version=release_version,
        filename=file.filename,
        map_content=content_str
    )
    db.add(sm)
    await db.commit()

    return {
        "status": "success",
        "message": f"Source map for {file.filename} (release: {release_version}) uploaded successfully.",
        "id": sm.id
    }
