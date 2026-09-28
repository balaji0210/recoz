import pytest
import httpx
import json
import os
import shutil
from app.main import app
from app.services.storage import LocalStorageBackend, get_storage_backend
from app.services.symbolicator import SourceMapSymbolicator, load_symbolicator_for_record
from app.models import SourceMap

SAMPLE_MAP = json.dumps({
    "version": 3,
    "file": "app.min.js",
    "sources": ["src/checkout.ts", "src/auth.ts"],
    "sourcesContent": [
        "export function checkout(cart: any) {\n  if (!cart) throw new Error('Cart empty');\n  return processPayment(cart);\n}",
        "export function login(user: any) {\n  return user.id;\n}"
    ],
    "names": ["checkout", "cart", "Error", "processPayment"],
    "mappings": "AAAA,SAASA,SAASC,GAAI;EAClB,IAAK,CAACA,KAAM,MAAM,IAAIC,MAAM;EAC5B,OAAOC,eAAeF"
})

@pytest.mark.asyncio
async def test_local_storage_backend(tmp_path):
    storage = LocalStorageBackend(base_dir=str(tmp_path / "test_storage"))
    key = "apps/test-app/v1.0.0/main.js.map"
    content = b"test source map content"

    # Save
    saved_key = await storage.save(key, content)
    assert saved_key == key
    assert await storage.exists(key) is True

    # Load
    loaded = await storage.load(key)
    assert loaded == content

    # Directory traversal safety check
    with pytest.raises(ValueError):
        await storage.save("../../../evil.txt", b"danger")

    # Delete
    deleted = await storage.delete(key)
    assert deleted is True
    assert await storage.exists(key) is False

@pytest.mark.asyncio
async def test_sourcemaps_api_pipeline():
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            # Login
            login_res = await client.post("/api/v1/auth/login", json={
                "email": "admin@ricozappmon.io",
                "password": "admin123"
            })
            assert login_res.status_code == 200
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Fetch applications
            apps_res = await client.get("/api/v1/applications", headers=headers)
            app_id = apps_res.json()[0]["id"]

            # 1. Upload source map
            files = {
                "file": ("app.min.js.map", SAMPLE_MAP.encode('utf-8'), "application/json")
            }
            data = {
                "app_id": app_id,
                "release_version": "2.4.0"
            }

            upload_res = await client.post("/api/v1/sourcemaps/upload", headers=headers, data=data, files=files)
            assert upload_res.status_code == 200
            upload_data = upload_res.json()
            assert upload_data["status"] == "success"
            assert upload_data["storage_backend"] in ["local", "s3"]
            assert upload_data["file_size_bytes"] > 0
            sm_id = upload_data["id"]

            # 2. List source maps
            list_res = await client.get(f"/api/v1/sourcemaps?app_id={app_id}&release_version=2.4.0", headers=headers)
            assert list_res.status_code == 200
            maps = list_res.json()
            assert len(maps) >= 1
            assert any(m["id"] == sm_id for m in maps)

            # 3. Get source map detail
            detail_res = await client.get(f"/api/v1/sourcemaps/{sm_id}", headers=headers)
            assert detail_res.status_code == 200
            assert detail_res.json()["release_version"] == "2.4.0"

            # 4. Get source map content
            content_res = await client.get(f"/api/v1/sourcemaps/{sm_id}/content", headers=headers)
            assert content_res.status_code == 200
            assert "sourcesContent" in content_res.text

            # 5. Delete source map
            del_res = await client.delete(f"/api/v1/sourcemaps/{sm_id}", headers=headers)
            assert del_res.status_code == 200

            # Verify 404
            get_after_del = await client.get(f"/api/v1/sourcemaps/{sm_id}", headers=headers)
            assert get_after_del.status_code == 404
