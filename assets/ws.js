/*
  WebSocket helper: optional live updates from backend or ESP32 bridge
  - connect(url), disconnect()
  - on(event, handler) for message, open, close, error
  Message format expected: { type: 'scan' | 'update', data: {...} }
*/

(() => {
  const listeners = { open: [], close: [], error: [], message: [] };
  let socket = null;

  function on(event, handler) {
    if (!listeners[event]) throw new Error(`Unsupported event: ${event}`);
    listeners[event].push(handler);
    return () => {
      const idx = listeners[event].indexOf(handler);
      if (idx >= 0) listeners[event].splice(idx, 1);
    };
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach((h) => {
      try { h(payload); } catch (_) { /* no-op */ }
    });
  }

  function connect(wsUrl) {
    if (socket && socket.readyState === WebSocket.OPEN) return socket;
    if (!/^wss?:\/\//i.test(wsUrl)) throw new Error("WebSocket URL must start with ws:// or wss://");
    socket = new WebSocket(wsUrl);
    socket.addEventListener("open", () => emit("open"));
    socket.addEventListener("close", () => emit("close"));
    socket.addEventListener("error", (e) => emit("error", e));
    socket.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        emit("message", data);
      } catch (err) {
        emit("error", err);
      }
    });
    return socket;
  }

  function disconnect() {
    if (socket) {
      try { socket.close(); } catch (_) {}
      socket = null;
    }
  }

  window.PlayCardWS = { on, connect, disconnect };
})();


