from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

from .mongo import get_db, init_mongo
from .ws import WebSocketManager


class RFIDScanIn(BaseModel):
    uid: str = Field(..., description="RFID card UID as hex string")
    device_id: Optional[str] = Field(None, description="Identifier for the ESP32 device")
    rssi: Optional[int] = Field(None, description="Signal strength if available")
    timestamp: Optional[datetime] = Field(None, description="Client-provided timestamp; default server time")


class RFIDScan(BaseModel):
    id: str
    uid: str
    device_id: Optional[str]
    rssi: Optional[int]
    timestamp: datetime


load_dotenv()

app = FastAPI(title="RFID Scan Service", version="0.1.0")

# CORS (dev-friendly defaults)
origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins_env if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ws_manager = WebSocketManager()


@app.on_event("startup")
async def on_startup():
    await init_mongo()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/scans", response_model=RFIDScan)
async def create_scan(payload: RFIDScanIn, db=Depends(get_db)):
    if not payload.uid:
        raise HTTPException(status_code=400, detail="uid is required")

    scan_doc = {
        "uid": payload.uid.lower(),
        "device_id": payload.device_id,
        "rssi": payload.rssi,
        "timestamp": (payload.timestamp or datetime.now(timezone.utc)),
    }
    result = await db.scans.insert_one(scan_doc)
    saved = await db.scans.find_one({"_id": result.inserted_id})

    # Normalize response
    out = RFIDScan(
        id=str(saved["_id"]),
        uid=saved["uid"],
        device_id=saved.get("device_id"),
        rssi=saved.get("rssi"),
        timestamp=saved["timestamp"],
    )

    # Broadcast to live clients
    await ws_manager.broadcast({
        "type": "scan",
        "data": out.dict(),
    })

    return out


@app.get("/api/scans", response_model=List[RFIDScan])
async def list_scans(limit: int = 50, db=Depends(get_db)):
    if limit <= 0 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    cursor = db.scans.find({}, sort=[("timestamp", -1)], limit=limit)
    items: List[RFIDScan] = []
    async for doc in cursor:
        items.append(
            RFIDScan(
                id=str(doc["_id"]),
                uid=doc["uid"],
                device_id=doc.get("device_id"),
                rssi=doc.get("rssi"),
                timestamp=doc["timestamp"],
            )
        )
    return items


@app.websocket("/ws/scans")
async def scans_ws(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            # Keep the socket alive; ignore any client messages
            await ws.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(ws)


