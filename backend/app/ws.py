from typing import List
from fastapi import WebSocket
import json


class WebSocketManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast(self, message: dict) -> None:
        data = json.dumps(message, default=str)
        stale: List[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                stale.append(connection)
        for s in stale:
            await self.disconnect(s)


