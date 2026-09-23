import time
import asyncio
import random
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Python Auth Microservice")

class LoginRequest(BaseModel):
    username: str
    password: str

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "python-auth"}

@app.post("/auth/verify")
async def verify_token(request: Request, traceparent: Optional[str] = Header(None)):
    # Simulate DB query delay (15-30ms)
    await asyncio.sleep(random.uniform(0.015, 0.030))
    auth_header = request.headers.get("authorization")
    if not auth_header or "invalid" in auth_header:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    
    return {
        "valid": True,
        "user_id": "usr_998877",
        "roles": ["customer", "premium"],
        "traceparent": traceparent
    }

@app.get("/auth/slow-db-query")
async def slow_db_query(traceparent: Optional[str] = Header(None)):
    # Injected slow database query simulation (500ms - 900ms delay)
    start = time.perf_counter()
    await asyncio.sleep(0.65)
    dur = (time.perf_counter() - start) * 1000
    return {
        "status": "query_completed",
        "simulated_query": "SELECT * FROM users JOIN orders ON users.id = orders.user_id WHERE users.active = true",
        "duration_ms": round(dur, 2),
        "traceparent": traceparent
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
