import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def init_mongo():
    global _client, _db
    if _client is not None:
        return
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB", "rfid_scans")
    _client = AsyncIOMotorClient(mongo_uri)
    _db = _client[db_name]
    # Indexes
    await _db.scans.create_index("timestamp")
    await _db.scans.create_index("uid")


def get_db() -> AsyncIOMotorDatabase:
    assert _db is not None, "MongoDB not initialized; call init_mongo on startup"
    return _db


