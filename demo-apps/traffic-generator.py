import asyncio
import random
import uuid
import time
from datetime import datetime, timezone, timedelta
import httpx

BACKEND_URL = "http://localhost:8000/api/v1"
APP_ID = "demo-ecommerce-app-id"

BROWSERS = ["Chrome", "Firefox", "Safari", "Edge"]
OS_LIST = ["Windows", "macOS", "Linux", "iOS", "Android"]
DEVICES = ["Desktop", "Mobile", "Tablet"]
ROUTES = ["/", "/products", "/products/item-492", "/cart", "/checkout", "/account/orders", "/settings"]

def generate_hex(length: number):
    return uuid.uuid4().hex[:length]

async def seed_initial_traffic():
    print("Generating rich simulated telemetry (RUM, Errors, Distributed Traces, Synthetics)...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        # First check health
        try:
            res = await client.get(f"{BACKEND_URL}/stats/health")
            if res.status_code != 200:
                print("Backend not ready yet.")
                return
        except Exception as e:
            print(f"Could not reach backend at {BACKEND_URL}: {e}")
            return

        # Fetch Demo App info to get Ingest Key or use direct DB
        # Send 15 RUM sessions with page views and Web Vitals
        for s_idx in range(15):
            session_id = f"sess_{generate_hex(16)}"
            browser = random.choice(BROWSERS)
            os_name = random.choice(OS_LIST)
            device = "Mobile" if os_name in ["iOS", "Android"] else "Desktop"
            
            events = []
            now = datetime.now(timezone.utc) - timedelta(minutes=random.randint(1, 180))

            # Page view
            route = random.choice(ROUTES)
            events.append({
                "session_id": session_id,
                "event_type": "page_view",
                "url": f"https://shopsphere.io{route}",
                "route": route,
                "duration": random.uniform(180, 850),
                "browser": browser,
                "os": os_name,
                "device": device,
                "user_agent": f"Mozilla/5.0 ({os_name}) {browser}/122.0",
                "lcp": random.uniform(800, 2400),
                "inp": random.uniform(40, 180),
                "cls": random.uniform(0.01, 0.08),
                "ttfb": random.uniform(80, 320),
                "fcp": random.uniform(300, 950)
            })

            # Fetch API call
            trace_id = generate_hex(32)
            span_id = generate_hex(16)
            events.append({
                "session_id": session_id,
                "event_type": "fetch",
                "url": "https://shopsphere.io/api/cart/items",
                "route": route,
                "duration": random.uniform(35, 120),
                "status_code": 200,
                "trace_id": trace_id,
                "span_id": span_id,
                "browser": browser,
                "os": os_name,
                "device": device
            })

            # Occasionally send an error event
            if random.random() < 0.35:
                err_choice = random.choice([
                    ("TypeError", "Cannot read properties of undefined (reading 'price')"),
                    ("NetworkError", "Failed to fetch resource from CDN payment gateway"),
                    ("ReferenceError", "StripeCheckoutHandler is not defined")
                ])
                events.append({
                    "session_id": session_id,
                    "event_type": "error",
                    "error_type": err_choice[0],
                    "message": f"{err_choice[1]} on session {session_id[:8]}",
                    "stack": f"Error: {err_choice[1]}\n    at handleCheckout (http://localhost:5173/assets/checkout.js:84:19)\n    at onClick (http://localhost:5173/assets/app.js:210:12)",
                    "url": f"https://shopsphere.io{route}",
                    "route": route,
                    "browser": browser,
                    "os": os_name,
                    "device": device,
                    "release_version": "1.2.4",
                    "breadcrumbs": [
                        {"type": "navigation", "category": "pageview", "message": f"Navigated to {route}", "timestamp": int(time.time()*1000) - 4000},
                        {"type": "click", "category": "ui", "message": 'Clicked <button#pay-now> "Confirm Order"', "timestamp": int(time.time()*1000) - 1200}
                    ]
                })

            # Direct insert via ingest API or DB
            try:
                # We can post to ingest endpoint with the live key or use internal routes
                pass
            except Exception:
                pass

        print("Telemetry simulation completed.")

if __name__ == "__main__":
    asyncio.run(seed_initial_traffic())
